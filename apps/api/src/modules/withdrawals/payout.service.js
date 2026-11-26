const WithdrawalRequest = require('./withdrawal.model');
const { Wallet, WalletLedger } = require('../wallets/wallet.model');
const User = require('../users/user.model');
const walletLedger = require('../../services/walletLedger.service');
const RazorpayXProvider = require('../../providers/payments/RazorpayXProvider');
const websocketService = require('../../services/websocket.service');
const { WITHDRAWAL_STATUS, TRANSACTION_TYPES, ROLES } = require('../../config/constants');

class PayoutError extends Error {
  constructor(message, code, statusCode = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * PayoutService manages the dual-mode approval of agent withdrawals:
 * 1. Automatic Instant Bank/UPI Transfer via RazorpayX Payouts.
 * 2. Manual Offline Bank Transfer with UTR recording as fallback.
 *
 * Money Invariant:
 * Every approved withdrawal is funded by the company's wallet on the platform.
 * If a payout fails or is rejected, the company wallet is refunded immediately.
 */
class PayoutService {
  /**
   * Retrieves payout configuration & balances for the company owner approval modal
   */
  async getConfig(companyCode) {
    const isConfigured = RazorpayXProvider.isConfigured();
    const balanceInfo = await RazorpayXProvider.getBalance();

    // Locate company owner wallet to show available balance for payout funding
    const owner = await User.findOne({ companyCode: Number(companyCode), role: ROLES.COMPANY_OWNER });
    let companyWalletBalance = 0;
    if (owner) {
      const wallet = await Wallet.findOne({ userId: owner._id });
      companyWalletBalance = wallet ? wallet.availableBalance : 0;
    }

    return {
      companyCode: Number(companyCode),
      payoutMode: isConfigured ? 'RAZORPAYX' : 'MANUAL',
      razorpayXConfigured: isConfigured,
      razorpayXBalance: balanceInfo.balance,
      isSimulated: Boolean(balanceInfo.isSimulated),
      companyWalletBalance
    };
  }

  /**
   * Finds the user ID whose company wallet will fund the payout
   */
  async _resolveOwnerUserId(actorId, companyCode) {
    if (actorId) {
      const actor = await User.findById(actorId);
      if (actor && (actor.role === ROLES.COMPANY_OWNER || actor.companyCode === Number(companyCode))) {
        return actor._id;
      }
    }
    const owner = await User.findOne({ companyCode: Number(companyCode), role: ROLES.COMPANY_OWNER });
    if (!owner) {
      throw new PayoutError('Company owner account not found for company #' + companyCode, 'OWNER_NOT_FOUND', 404);
    }
    return owner._id;
  }

  /**
   * STEP 1 — the company approves an agent withdrawal (it does NOT pay).
   * The agent's KYC must be VERIFIED. The company wallet is debited to fund the payout and the
   * request moves to PROCESSING / AWAITING_ADMIN_PAYMENT. RBS admin then pays it (adminPay).
   */
  async approve({ withdrawalId, companyCode, actorId, notes = '' }) {
    const withdrawal = await WithdrawalRequest.findOne({
      _id: withdrawalId,
      companyCode: Number(companyCode)
    });

    if (!withdrawal) {
      throw new PayoutError('Withdrawal request not found under your company.', 'NOT_FOUND', 404);
    }
    if (withdrawal.status !== WITHDRAWAL_STATUS.PENDING) {
      throw new PayoutError(`Cannot approve withdrawal with status ${withdrawal.status}.`, 'INVALID_STATUS', 400);
    }

    // KYC gate: the agent's documents must be verified before the company can approve a payout.
    const agent = await User.findById(withdrawal.agentId).select('name kycStatus bankDetails').lean();
    if (!agent) throw new PayoutError('Agent account not found.', 'AGENT_NOT_FOUND', 404);
    if (agent.kycStatus !== 'VERIFIED') {
      throw new PayoutError(
        `Cannot approve: ${agent.name || 'the agent'}'s KYC is ${String(agent.kycStatus || 'NOT_SUBMITTED').replace(/_/g, ' ').toLowerCase()}. Verify the agent's KYC documents before approving the withdrawal.`,
        'KYC_NOT_VERIFIED',
        422
      );
    }
    const hasPayoutTarget = withdrawal.payoutDetails?.accountNumber || withdrawal.payoutDetails?.upiId
      || agent.bankDetails?.accountNumber || agent.bankDetails?.upiId;
    if (!hasPayoutTarget) {
      throw new PayoutError('The agent has no bank account or UPI ID on file for the payout.', 'NO_PAYOUT_DETAILS', 422);
    }

    const ownerUserId = await this._resolveOwnerUserId(actorId, companyCode);
    const amount = Number(withdrawal.amount);
    const attempt = (withdrawal.payout?.attempt || 0) + 1;
    const debitKey = `WDR_FUND_${withdrawal._id}_ATT_${attempt}`;

    // Debit the company wallet to fund the payout (refunded if the admin's payout later fails).
    try {
      await walletLedger.debit({
        userId: ownerUserId,
        amount,
        transactionType: TRANSACTION_TYPES.AGENT_PAYOUT_FUNDING,
        referenceType: 'WITHDRAWAL',
        referenceId: withdrawal._id.toString(),
        description: `Funding agent withdrawal #${withdrawal._id.toString().slice(-6).toUpperCase()} (${withdrawal.payoutDetails?.accountName || agent.name || 'Agent'})`,
        idempotencyKey: debitKey,
        companyCode: Number(companyCode)
      });
    } catch (debitErr) {
      if (debitErr.code === 'INSUFFICIENT_BALANCE') {
        throw new PayoutError(
          `Company wallet balance is insufficient to fund ₹${amount.toLocaleString('en-IN')}. Please deposit funds into your company wallet or lower the withdrawal amount.`,
          'INSUFFICIENT_COMPANY_WALLET_BALANCE',
          402
        );
      }
      throw debitErr;
    }

    const actor = actorId ? await User.findById(actorId).select('name').lean() : null;
    const claimed = await WithdrawalRequest.findOneAndUpdate(
      { _id: withdrawal._id, status: WITHDRAWAL_STATUS.PENDING },
      {
        $set: {
          status: WITHDRAWAL_STATUS.PROCESSING,
          processingStage: 'AWAITING_ADMIN_PAYMENT',
          reviewedBy: actorId,
          reviewedAt: new Date(),
          notes: notes || withdrawal.notes || '',
          'approvals.company.by': actorId,
          'approvals.company.name': actor?.name || '',
          'approvals.company.at': new Date(),
          'approvals.company.kycStatusAtApproval': agent.kycStatus,
          'companyFunding.ownerUserId': ownerUserId,
          'companyFunding.debitKey': debitKey,
          'companyFunding.refunded': false,
          'payout.attempt': attempt
        }
      },
      { new: true }
    );

    if (!claimed) {
      await walletLedger.credit({
        userId: ownerUserId,
        amount,
        transactionType: TRANSACTION_TYPES.AGENT_PAYOUT_FUNDING_REVERSAL,
        referenceType: 'WITHDRAWAL',
        referenceId: withdrawal._id.toString(),
        description: `Reversal of payout funding race for #${withdrawal._id.toString().slice(-6).toUpperCase()}`,
        idempotencyKey: `REVERSE_RACE_${debitKey}`,
        companyCode: Number(companyCode)
      });
      throw new PayoutError('Withdrawal request was processed concurrently.', 'CONCURRENT_UPDATE', 409);
    }

    try {
      websocketService.broadcastUser(claimed.agentId, 'WITHDRAWAL_STATUS_CHANGED', { withdrawalId: claimed._id, status: WITHDRAWAL_STATUS.PROCESSING, processingStage: 'AWAITING_ADMIN_PAYMENT' });
      websocketService.broadcast(`company:${claimed.companyCode}`, 'WITHDRAWAL_STATUS_CHANGED', { withdrawalId: claimed._id, status: WITHDRAWAL_STATUS.PROCESSING, processingStage: 'AWAITING_ADMIN_PAYMENT' });
      websocketService.broadcast('admin:all', 'WITHDRAWAL_AWAITING_PAYMENT', { withdrawalId: claimed._id, companyCode: claimed.companyCode, amount: claimed.amount });
    } catch (e) { /* realtime best-effort */ }

    return claimed;
  }

  /**
   * STEP 2 — RBS admin pays a company-approved withdrawal.
   *  - mode 'manual': admin sends the money offline and records the UTR here.
   *  - mode 'online': pay instantly through RazorpayX (bank / UPI).
   * Also used to retry a PAYOUT_FAILED request (the company wallet is re-debited for the new attempt).
   */
  async adminPay({ withdrawalId, actorId, mode = 'online', utrNumber = '', notes = '' }) {
    const withdrawal = await WithdrawalRequest.findById(withdrawalId);
    if (!withdrawal) throw new PayoutError('Withdrawal request not found.', 'NOT_FOUND', 404);

    const awaiting = withdrawal.status === WITHDRAWAL_STATUS.PROCESSING && withdrawal.processingStage === 'AWAITING_ADMIN_PAYMENT';
    const retrying = withdrawal.status === WITHDRAWAL_STATUS.PAYOUT_FAILED;
    if (!awaiting && !retrying) {
      throw new PayoutError(`This withdrawal is not awaiting payment (status ${withdrawal.status}). The company must approve it first.`, 'NOT_AWAITING_PAYMENT', 409);
    }

    const trimmedUtr = String(utrNumber || '').replace(/\s/g, '').toUpperCase();
    if (mode === 'manual' && !trimmedUtr) {
      throw new PayoutError('Enter the bank UTR / reference number for the manual transfer.', 'UTR_REQUIRED', 400);
    }
    if (mode === 'manual' && !/^[A-Z0-9]{6,30}$/.test(trimmedUtr)) {
      throw new PayoutError('UTR / reference must be 6-30 letters or digits.', 'UTR_INVALID', 400);
    }
    if (mode === 'manual') {
      const dup = await WithdrawalRequest.findOne({ _id: { $ne: withdrawal._id }, utrNumber: trimmedUtr }).select('_id').lean();
      if (dup) throw new PayoutError(`UTR ${trimmedUtr} is already recorded on another withdrawal.`, 'UTR_DUPLICATE', 409);
    }
    // Never mark an agent "paid" through a simulated RazorpayX payout in production.
    if (mode !== 'manual' && !RazorpayXProvider.isConfigured() && process.env.NODE_ENV === 'production') {
      throw new PayoutError('Razorpay payouts are not set up yet (RAZORPAYX_ACCOUNT_NUMBER missing on the server). Pay manually and enter the UTR.', 'RAZORPAYX_NOT_CONFIGURED', 409);
    }

    // A failed payout refunded the company wallet, so re-fund it for this new attempt.
    if (retrying) {
      if (withdrawal.companyFunding?.refunded !== false) {
        const attempt = (withdrawal.payout?.attempt || 0) + 1;
        const ownerUserId = withdrawal.companyFunding?.ownerUserId || await this._resolveOwnerUserId(null, withdrawal.companyCode);
        const debitKey = `WDR_FUND_${withdrawal._id}_ATT_${attempt}`;
        try {
          await walletLedger.debit({
            userId: ownerUserId,
            amount: Number(withdrawal.amount),
            transactionType: TRANSACTION_TYPES.AGENT_PAYOUT_FUNDING,
            referenceType: 'WITHDRAWAL',
            referenceId: withdrawal._id.toString(),
            description: `Re-funding agent withdrawal #${withdrawal._id.toString().slice(-6).toUpperCase()} (retry)`,
            idempotencyKey: debitKey,
            companyCode: withdrawal.companyCode
          });
        } catch (debitErr) {
          if (debitErr.code === 'INSUFFICIENT_BALANCE') {
            throw new PayoutError(`Company #${withdrawal.companyCode} wallet is insufficient to re-fund ₹${Number(withdrawal.amount).toLocaleString('en-IN')}.`, 'INSUFFICIENT_COMPANY_WALLET_BALANCE', 402);
          }
          throw debitErr;
        }
        withdrawal.companyFunding.ownerUserId = ownerUserId;
        withdrawal.companyFunding.debitKey = debitKey;
        withdrawal.companyFunding.refunded = false;
        withdrawal.payout.attempt = attempt;
        withdrawal.payout.failureReason = null;
      }
    }

    const actor = actorId ? await User.findById(actorId).select('name').lean() : null;
    withdrawal.status = WITHDRAWAL_STATUS.PROCESSING;
    withdrawal.approvals = withdrawal.approvals || {};
    withdrawal.approvals.admin = { by: actorId, name: actor?.name || '', at: new Date(), mode: mode === 'manual' ? 'MANUAL' : 'ONLINE' };
    if (notes) withdrawal.notes = notes;

    if (mode === 'manual') {
      withdrawal.processingStage = 'DISBURSING';
      await withdrawal.save();
      return await this._completePayout({ withdrawal, utr: trimmedUtr, provider: 'MANUAL', notes });
    }

    withdrawal.processingStage = 'DISBURSING';
    await withdrawal.save();
    return await this._disburseRazorpayX(withdrawal);
  }

  /** Initiate a RazorpayX payout for a withdrawal that is funded and awaiting disbursement. */
  async _disburseRazorpayX(withdrawal) {
    const attempt = withdrawal.payout?.attempt || 1;
    try {
      const agent = await User.findById(withdrawal.agentId);
      const contact = await RazorpayXProvider.createContact({
        name: withdrawal.payoutDetails?.accountName || agent?.name || 'Agent',
        email: agent?.email,
        phone: agent?.phone,
        referenceId: `AGT_${withdrawal.agentId}`
      });
      const fundAccount = await RazorpayXProvider.createFundAccount({
        contactId: contact.id,
        payoutDetails: withdrawal.payoutDetails
      });
      const mode = withdrawal.payoutDetails?.method === 'upi' ? 'UPI' : (withdrawal.amount > 500000 ? 'NEFT' : 'IMPS');
      const idempotencyKey = `RZPX_${withdrawal._id}_ATT_${attempt}`;
      const payout = await RazorpayXProvider.createPayout({
        fundAccountId: fundAccount.id,
        amount: withdrawal.amount,
        mode,
        purpose: 'payout',
        referenceId: idempotencyKey,
        notes: { withdrawalId: String(withdrawal._id), agentId: String(withdrawal.agentId), companyCode: String(withdrawal.companyCode) }
      });

      withdrawal.payout.provider = 'RAZORPAYX';
      withdrawal.payout.payoutId = payout.id;
      withdrawal.payout.fundAccountId = fundAccount.id;
      withdrawal.payout.mode = mode;
      withdrawal.payout.idempotencyKey = idempotencyKey;
      withdrawal.payout.initiatedAt = new Date();
      withdrawal.payout.status = payout.status;
      await withdrawal.save();

      if (payout.status === 'processed') return await this.handlePayoutProcessed(payout, withdrawal);
      if (payout.status === 'rejected' || payout.status === 'failed') return await this.handlePayoutFailed(payout, payout.failure_reason || 'Payout was rejected by bank/RazorpayX', withdrawal._id);

      try {
        websocketService.broadcastUser(withdrawal.agentId, 'WITHDRAWAL_STATUS_CHANGED', { withdrawalId: withdrawal._id, status: WITHDRAWAL_STATUS.PROCESSING, processingStage: 'DISBURSING', payoutStatus: payout.status });
      } catch (e) { /* ignore */ }
      return withdrawal;
    } catch (payoutErr) {
      console.error('[PayoutService] Automatic payout initiation failed:', payoutErr);
      return await this.handlePayoutFailed({ id: withdrawal.payout?.payoutId || `err_${Date.now()}`, failure_reason: payoutErr.message }, payoutErr.message, withdrawal._id);
    }
  }

  /** RBS RazorpayX balance / mode for the admin pay dialog. */
  async getAdminConfig() {
    const isConfigured = RazorpayXProvider.isConfigured();
    const balanceInfo = await RazorpayXProvider.getBalance();
    const isProd = process.env.NODE_ENV === 'production';
    return {
      payoutMode: isConfigured ? 'RAZORPAYX' : 'MANUAL',
      razorpayXConfigured: isConfigured,
      razorpayXBalance: balanceInfo.balance,
      isSimulated: Boolean(balanceInfo.isSimulated),
      // Razorpay is always offered; it is usable when live keys + account exist, or as a test payout outside production.
      onlineAvailable: isConfigured || !isProd,
      razorpayKeysConfigured: Boolean(RazorpayXProvider.keyId && RazorpayXProvider.keySecret),
      razorpayXAccountConfigured: Boolean(RazorpayXProvider.accountNumber)
    };
  }

  /**
   * Finalizes an approved payout: releases agent's reserved escrow balance, writes ledger row, updates status.
   */
  async _completePayout({ withdrawal, utr, provider = 'RAZORPAYX', notes = '' }) {
    const finalUtr = utr || `UTR_${Date.now()}`;
    const settlementKey = `WDR_SETTLE_${withdrawal._id}`;

    // Release agent's reserved balance (escrow)
    const agentWallet = await Wallet.findOneAndUpdate(
      { userId: withdrawal.agentId, reservedBalance: { $gte: withdrawal.amount } },
      { $inc: { reservedBalance: -withdrawal.amount } },
      { new: true }
    );

    // Record agent's immutable ledger row
    if (agentWallet) {
      try {
        await WalletLedger.create({
          walletId: agentWallet._id,
          userId: withdrawal.agentId,
          companyId: withdrawal.companyId || null,
          companyCode: withdrawal.companyCode,
          entryType: 'DEBIT',
          amount: withdrawal.amount,
          balanceAfter: agentWallet.availableBalance,
          transactionType: TRANSACTION_TYPES.WITHDRAWAL_SETTLED,
          referenceType: 'WITHDRAWAL',
          referenceId: withdrawal._id.toString(),
          description: `Disbursed ₹${withdrawal.amount.toLocaleString('en-IN')} to ${withdrawal.payoutDetails?.accountName || 'Bank'} (UTR: ${finalUtr})`,
          idempotencyKey: settlementKey
        });
      } catch (e) {
        if (!e.message?.includes('E11000')) throw e;
      }
    }

    // Update Withdrawal Request to APPROVED (paid)
    withdrawal.status = WITHDRAWAL_STATUS.APPROVED;
    withdrawal.processingStage = null;
    withdrawal.utrNumber = finalUtr;
    withdrawal.paymentReference = finalUtr;
    withdrawal.disbursedAt = new Date();
    withdrawal.payout.status = 'processed';
    withdrawal.payout.utr = finalUtr;
    withdrawal.payout.provider = provider || withdrawal.payout?.provider || 'RAZORPAYX';
    withdrawal.payout.processedAt = new Date();
    if (notes) withdrawal.notes = notes;
    await withdrawal.save();

    // WhatsApp the agent that the money was paid.
    require('../notifications/notification.service').fire('payoutPaid', withdrawal);

    // Realtime Notifications
    try {
      websocketService.broadcastUser(withdrawal.agentId, 'WITHDRAWAL_STATUS_CHANGED', {
        withdrawalId: withdrawal._id,
        status: WITHDRAWAL_STATUS.APPROVED,
        amount: withdrawal.amount,
        utrNumber: finalUtr
      });
      websocketService.broadcast(`company:${withdrawal.companyCode}`, 'WITHDRAWAL_SETTLED', {
        withdrawalId: withdrawal._id,
        status: WITHDRAWAL_STATUS.APPROVED,
        amount: withdrawal.amount,
        utrNumber: finalUtr
      });
    } catch (e) { /* ignore */ }

    return withdrawal;
  }

  /**
   * Called when RazorpayX confirms payout is processed (either via direct response, webhook, or polling sweeper)
   */
  async handlePayoutProcessed(payoutEntity, existingWithdrawal = null) {
    const withdrawal = existingWithdrawal || await WithdrawalRequest.findOne({
      $or: [
        { 'payout.payoutId': payoutEntity.id },
        { 'payout.idempotencyKey': payoutEntity.reference_id }
      ]
    });

    if (!withdrawal) {
      console.warn('[PayoutService] Webhook received for unknown payout:', payoutEntity.id);
      return null;
    }

    if (withdrawal.status === WITHDRAWAL_STATUS.APPROVED) {
      return withdrawal; // Already completed
    }

    return await this._completePayout({
      withdrawal,
      utr: payoutEntity.utr || withdrawal.utrNumber,
      provider: 'RAZORPAYX'
    });
  }

  /**
   * Called when a payout fails: moves status to PAYOUT_FAILED and immediately refunds the company wallet.
   */
  async handlePayoutFailed(payoutEntity, failureReason = '', directWithdrawalId = null) {
    const query = directWithdrawalId
      ? { _id: directWithdrawalId }
      : {
          $or: [
            { 'payout.payoutId': payoutEntity.id },
            { 'payout.idempotencyKey': payoutEntity.reference_id }
          ]
        };

    const withdrawal = await WithdrawalRequest.findOne(query);
    if (!withdrawal) return null;

    if (withdrawal.status === WITHDRAWAL_STATUS.PAYOUT_FAILED) {
      return withdrawal;
    }

    const reason = failureReason || payoutEntity.failure_reason || 'Bank payout failed';

    // 1. Refund the Company Owner Wallet if debited and not yet refunded
    if (withdrawal.companyFunding?.ownerUserId && !withdrawal.companyFunding?.refunded) {
      const refundKey = `WDR_FUND_REFUND_${withdrawal._id}_ATT_${withdrawal.payout?.attempt || 1}`;
      try {
        await walletLedger.credit({
          userId: withdrawal.companyFunding.ownerUserId,
          amount: withdrawal.amount,
          transactionType: TRANSACTION_TYPES.AGENT_PAYOUT_FUNDING_REVERSAL,
          referenceType: 'WITHDRAWAL',
          referenceId: withdrawal._id.toString(),
          description: `Refund of failed agent payout #${withdrawal._id.toString().slice(-6).toUpperCase()}: ${reason}`,
          idempotencyKey: refundKey,
          companyCode: withdrawal.companyCode
        });
        withdrawal.companyFunding.refunded = true;
      } catch (refundErr) {
        console.error('[PayoutService] Failed to reverse company funding:', refundErr);
      }
    }

    // 2. Set Status to PAYOUT_FAILED (admin can retry or reject)
    withdrawal.status = WITHDRAWAL_STATUS.PAYOUT_FAILED;
    withdrawal.processingStage = null;
    withdrawal.payout.status = 'failed';
    withdrawal.payout.failureReason = reason;
    await withdrawal.save();

    // Realtime Notifications
    try {
      websocketService.broadcastUser(withdrawal.agentId, 'WITHDRAWAL_STATUS_CHANGED', {
        withdrawalId: withdrawal._id,
        status: WITHDRAWAL_STATUS.PAYOUT_FAILED,
        reason
      });
      websocketService.broadcast(`company:${withdrawal.companyCode}`, 'WITHDRAWAL_PAYOUT_FAILED', {
        withdrawalId: withdrawal._id,
        status: WITHDRAWAL_STATUS.PAYOUT_FAILED,
        reason
      });
    } catch (e) { /* ignore */ }

    return withdrawal;
  }

  /**
   * Retry a failed payout (company owner can retry after adding funds or correcting details)
   */
  async retry({ withdrawalId, companyCode, actorId, utrNumber }) {
    const withdrawal = await WithdrawalRequest.findOne({
      _id: withdrawalId,
      companyCode: Number(companyCode)
    });

    if (!withdrawal) {
      throw new PayoutError('Withdrawal request not found under your company.', 'NOT_FOUND', 404);
    }

    if (withdrawal.status !== WITHDRAWAL_STATUS.PAYOUT_FAILED) {
      throw new PayoutError(`Can only retry payouts with status PAYOUT_FAILED (current: ${withdrawal.status}).`, 'INVALID_STATUS', 400);
    }

    // Reset status to PENDING atomically so approve() can take it
    withdrawal.status = WITHDRAWAL_STATUS.PENDING;
    await withdrawal.save();

    return await this.approve({
      withdrawalId: withdrawal._id,
      companyCode,
      actorId,
      utrNumber,
      notes: `Retry after previous failure: ${withdrawal.payout?.failureReason || 'unknown'}`
    });
  }

  /**
   * Reject a pending or failed withdrawal request: refunds agent's reserved escrow back to available balance.
   */
  async reject({ withdrawalId, companyCode, actorId, reason = '', byAdmin = false }) {
    const query = byAdmin ? { _id: withdrawalId } : { _id: withdrawalId, companyCode: Number(companyCode) };
    const withdrawal = await WithdrawalRequest.findOne(query);

    if (!withdrawal) {
      throw new PayoutError(byAdmin ? 'Withdrawal request not found.' : 'Withdrawal request not found under your company.', 'NOT_FOUND', 404);
    }

    // The company can reject while PENDING; RBS admin can also reject one it has not yet disbursed.
    const rejectable = withdrawal.status === WITHDRAWAL_STATUS.PENDING
      || withdrawal.status === WITHDRAWAL_STATUS.PAYOUT_FAILED
      || (byAdmin && withdrawal.status === WITHDRAWAL_STATUS.PROCESSING && withdrawal.processingStage === 'AWAITING_ADMIN_PAYMENT');
    if (!rejectable) {
      throw new PayoutError(`Cannot reject withdrawal with status ${withdrawal.status}.`, 'INVALID_STATUS', 400);
    }

    const rejectionReason = reason || (byAdmin ? 'Rejected by RBS admin' : 'Rejected by bus operator');

    // 0. Refund the company wallet if it was already debited to fund this payout.
    if (withdrawal.companyFunding?.ownerUserId && withdrawal.companyFunding?.refunded === false) {
      try {
        await walletLedger.credit({
          userId: withdrawal.companyFunding.ownerUserId,
          amount: withdrawal.amount,
          transactionType: TRANSACTION_TYPES.AGENT_PAYOUT_FUNDING_REVERSAL,
          referenceType: 'WITHDRAWAL',
          referenceId: withdrawal._id.toString(),
          description: `Refund of company funding for rejected withdrawal #${withdrawal._id.toString().slice(-6).toUpperCase()}`,
          idempotencyKey: `WDR_REJECT_FUND_REFUND_${withdrawal._id}_ATT_${withdrawal.payout?.attempt || 1}`,
          companyCode: withdrawal.companyCode
        });
        withdrawal.companyFunding.refunded = true;
      } catch (e) { console.error('[PayoutService] reject: company refund failed', e.message); }
    }

    // 1. Release Agent's Reserved Balance back to Available Balance
    const agentWallet = await Wallet.findOneAndUpdate(
      { userId: withdrawal.agentId, reservedBalance: { $gte: withdrawal.amount } },
      {
        $inc: {
          availableBalance: withdrawal.amount,
          reservedBalance: -withdrawal.amount
        }
      },
      { new: true }
    );

    // 2. Record Agent's Refund Ledger Entry
    if (agentWallet) {
      const rejectLedgerKey = `WDR_REJECT_REFUND_${withdrawal._id}`;
      try {
        await WalletLedger.create({
          walletId: agentWallet._id,
          userId: withdrawal.agentId,
          companyId: withdrawal.companyId || null,
          companyCode: withdrawal.companyCode,
          entryType: 'CREDIT',
          amount: withdrawal.amount,
          balanceAfter: agentWallet.availableBalance,
          transactionType: TRANSACTION_TYPES.WITHDRAWAL_REJECTED_REFUND,
          referenceType: 'WITHDRAWAL',
          referenceId: withdrawal._id.toString(),
          description: `Withdrawal request #${withdrawal._id.toString().slice(-6).toUpperCase()} rejected: ${rejectionReason}. Escrowed balance returned.`,
          idempotencyKey: rejectLedgerKey
        });
      } catch (e) {
        if (!e.message?.includes('E11000')) throw e;
      }
    }

    // 3. Mark Withdrawal as REJECTED
    withdrawal.status = WITHDRAWAL_STATUS.REJECTED;
    withdrawal.processingStage = null;
    withdrawal.rejectionReason = rejectionReason;
    withdrawal.reviewedBy = actorId;
    withdrawal.reviewedAt = new Date();
    await withdrawal.save();

    // Realtime Notifications
    try {
      websocketService.broadcastUser(withdrawal.agentId, 'WITHDRAWAL_STATUS_CHANGED', {
        withdrawalId: withdrawal._id,
        status: WITHDRAWAL_STATUS.REJECTED,
        reason: rejectionReason
      });
      websocketService.broadcast(`company:${withdrawal.companyCode}`, 'WITHDRAWAL_REJECTED', {
        withdrawalId: withdrawal._id,
        status: WITHDRAWAL_STATUS.REJECTED,
        reason: rejectionReason
      });
    } catch (e) { /* ignore */ }

    return withdrawal;
  }

  /**
   * RazorpayX Webhook Handler
   */
  async handleWebhook(rawBody, signature, eventId = null) {
    if (!RazorpayXProvider.verifyWebhookSignature(rawBody, signature)) {
      throw new PayoutError('Invalid RazorpayX webhook signature', 'INVALID_SIGNATURE', 400);
    }

    let payload;
    try {
      payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : JSON.parse(rawBody.toString('utf8'));
    } catch (e) {
      throw new PayoutError('Malformed webhook JSON payload', 'INVALID_JSON', 400);
    }

    const event = payload.event;
    const payoutEntity = payload.payload?.payout?.entity;

    if (!payoutEntity) {
      return { success: true, message: 'Event ignored: no payout entity' };
    }

    console.log(`[Payout Webhook] Received event: ${event} for payout: ${payoutEntity.id}`);

    if (event === 'payout.processed') {
      await this.handlePayoutProcessed(payoutEntity);
    } else if (event === 'payout.failed' || event === 'payout.rejected' || event === 'payout.reversed') {
      await this.handlePayoutFailed(payoutEntity, payoutEntity.failure_reason || `Payout ${event}`);
    } else if (event === 'payout.queued' || event === 'payout.initiated') {
      await WithdrawalRequest.updateOne(
        { 'payout.payoutId': payoutEntity.id },
        { $set: { 'payout.status': payoutEntity.status } }
      );
    }

    return { success: true, event, payoutId: payoutEntity.id };
  }

  /**
   * Sweeper alias for server timer and manual sync
   */
  async sweep(options = {}) {
    return await this.sweepPendingPayouts(options);
  }

  /**
   * Sweeper: queries RazorpayX for pending payouts to auto-settle or fail dropped webhooks.
   */
  async sweepPendingPayouts({ olderThanMs = 10 * 60 * 1000, limit = 20 } = {}) {
    if (!RazorpayXProvider.isConfigured()) return { checked: 0, resolved: 0, isSimulated: true };

    const cutoff = new Date(Date.now() - olderThanMs);
    const query = {
      status: WITHDRAWAL_STATUS.PROCESSING,
      'payout.provider': 'RAZORPAYX',
      'payout.payoutId': { $ne: null }
    };
    if (olderThanMs > 0) {
      query.updatedAt = { $lt: cutoff };
    }

    const stuckPayouts = await WithdrawalRequest.find(query).limit(Number(limit) || 20);

    let resolved = 0;
    for (const w of stuckPayouts) {
      try {
        const live = await RazorpayXProvider.fetchPayout(w.payout.payoutId);
        if (live.status === 'processed') {
          await this.handlePayoutProcessed(live, w);
          resolved++;
        } else if (live.status === 'rejected' || live.status === 'failed' || live.status === 'cancelled') {
          await this.handlePayoutFailed(live, live.failure_reason, w._id);
          resolved++;
        }
      } catch (err) {
        console.warn(`[PayoutSweeper] Failed to check payout ${w.payout?.payoutId}:`, err.message);
      }
    }

    return { checked: stuckPayouts.length, resolved };
  }
}

module.exports = new PayoutService();
