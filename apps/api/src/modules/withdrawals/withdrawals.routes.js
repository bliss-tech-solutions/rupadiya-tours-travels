const express = require('express');
const router = express.Router();
const WithdrawalRequest = require('./withdrawal.model');
const { Wallet, WalletLedger } = require('../wallets/wallet.model');
const { CommissionRecord } = require('../commissions/commission.model');
const User = require('../users/user.model');
const { authenticateToken } = require('../../middleware/auth.middleware');
const { authorizeRoles } = require('../../middleware/rbac.middleware');
const { ROLES, KYC_STATUS, TRANSACTION_TYPES, WITHDRAWAL_STATUS } = require('../../config/constants');
const websocketService = require('../../services/websocket.service');

// Indian IFSC format regex (e.g., SBIN0001234, HDFC0001245)
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
// Standard Indian Bank Account Number regex (9 to 18 digits)
const BANK_ACCOUNT_REGEX = /^\d{9,18}$/;
// Standard UPI ID regex (e.g. user@okhdfcbank, 0000000000@upi)
const UPI_REGEX = /^[a-zA-Z0-9.\-_]{2,49}@[a-zA-Z]{2,49}$/;

/**
 * Helper to compute agent earnings & withdrawable balances
 */
async function getAgentWithdrawalMetrics(agentId, availableBalance) {
  // 1. Total net commission earned by this agent
  const commissions = await CommissionRecord.find({
    agentId,
    status: 'CREDITED'
  });
  const totalEarnings = commissions.reduce((sum, c) => sum + (c.netCommission || 0), 0);

  // 2. All pending or approved withdrawals
  const allWithdrawals = await WithdrawalRequest.find({
    agentId,
    status: { $in: [WITHDRAWAL_STATUS.PENDING, WITHDRAWAL_STATUS.APPROVED] }
  });

  const withdrawnTotal = allWithdrawals
    .filter(w => w.status === WITHDRAWAL_STATUS.APPROVED)
    .reduce((sum, w) => sum + w.amount, 0);

  const pendingTotal = allWithdrawals
    .filter(w => w.status === WITHDRAWAL_STATUS.PENDING)
    .reduce((sum, w) => sum + w.amount, 0);

  const totalCommitted = withdrawnTotal + pendingTotal;
  const withdrawableFromEarnings = Math.max(0, totalEarnings - totalCommitted);
  const eligibleToWithdraw = Math.min(availableBalance, withdrawableFromEarnings);

  return {
    totalEarnings,
    withdrawnTotal,
    pendingTotal,
    totalCommitted,
    withdrawableFromEarnings,
    eligibleToWithdraw,
    hasPendingRequest: pendingTotal > 0
  };
}

/**
 * Agent requests a withdrawal from earnings
 * POST /api/v1/withdrawals or /api/v1/withdrawals/request
 */
router.post(['/', '/request'], authenticateToken, authorizeRoles(ROLES.AGENT), async (req, res, next) => {
  try {
    const { amount, payoutDetails, saveBankDetails } = req.body;
    const numAmount = Number(amount);

    // 1. Verification: KYC verification requirement
    if (req.user.kycStatus !== KYC_STATUS.VERIFIED) {
      return res.status(403).json({
        error: 'Withdrawals remain disabled until your KYC documents (Aadhaar/PAN) are verified by the administrator.',
        kycStatus: req.user.kycStatus
      });
    }

    // 2. Verification: Minimum amount policy
    if (!numAmount || isNaN(numAmount) || numAmount < 500) {
      return res.status(400).json({
        error: 'Minimum withdrawal amount is ₹500.'
      });
    }

    // 3. Verification: Check Wallet exists & fetch available balance
    let wallet = await Wallet.findOne({ userId: req.user._id });
    if (!wallet) {
      wallet = await Wallet.create({
        userId: req.user._id,
        companyCode: req.user.companyCode,
        availableBalance: 0,
        reservedBalance: 0
      });
    }

    if (wallet.availableBalance < numAmount) {
      return res.status(400).json({
        error: `Insufficient available wallet balance. You currently have ₹${wallet.availableBalance.toLocaleString('en-IN')} available.`
      });
    }

    // 4. Verification: Strict Earning Source Check
    // Money can ONLY be withdrawn from accredited earnings (commissions), NOT from deposited booking balance.
    const metrics = await getAgentWithdrawalMetrics(req.user._id, wallet.availableBalance);

    if (numAmount > metrics.withdrawableFromEarnings) {
      return res.status(400).json({
        error: `Withdrawal amount (₹${numAmount.toLocaleString('en-IN')}) exceeds your eligible commission earnings of ₹${metrics.withdrawableFromEarnings.toLocaleString('en-IN')}. Agents are only permitted to withdraw from booking earnings and override profits.`,
        availableEarnings: metrics.withdrawableFromEarnings,
        totalEarnings: metrics.totalEarnings,
        pendingOrSettled: metrics.totalCommitted
      });
    }

    // 5. Verification: Concurrency / Single Pending Request check
    const existingPending = await WithdrawalRequest.findOne({
      agentId: req.user._id,
      status: WITHDRAWAL_STATUS.PENDING
    });
    if (existingPending) {
      return res.status(400).json({
        error: `You already have an active withdrawal request of ₹${existingPending.amount.toLocaleString('en-IN')} currently on hold waiting for company approval.`
      });
    }

    // 6. Verification: Destination Payout / Bank Account Verification
    const method = (payoutDetails?.method || 'bank').toLowerCase();
    let sanitizedPayout = {};

    if (method === 'bank') {
      const accountName = (payoutDetails?.accountName || req.user.bankDetails?.accountName || req.user.name || '').trim();
      const rawAccountNumber = (payoutDetails?.accountNumber || '').toString().trim();
      const ifscCode = (payoutDetails?.ifscCode || req.user.bankDetails?.ifscCode || '').toString().toUpperCase().trim();
      const bankName = (payoutDetails?.bankName || req.user.bankDetails?.bankName || '').trim();

      // If user passed a masked account, fallback to saved account if valid, or require full account number
      let finalAccountNumber = rawAccountNumber;
      if (!finalAccountNumber && req.user.bankDetails?.accountNumberMasked) {
        finalAccountNumber = req.user.bankDetails.accountNumberMasked;
      }

      if (!accountName || accountName.length < 2) {
        return res.status(400).json({
          error: 'Please enter a valid Account Holder Name (minimum 2 characters).'
        });
      }

      if (!finalAccountNumber || (!BANK_ACCOUNT_REGEX.test(finalAccountNumber) && !finalAccountNumber.startsWith('XXXX-'))) {
        return res.status(400).json({
          error: 'Please enter a valid Bank Account Number (between 9 and 18 numerical digits).'
        });
      }

      if (!ifscCode || !IFSC_REGEX.test(ifscCode)) {
        return res.status(400).json({
          error: 'Please enter a valid 11-character Indian Bank IFSC Code (e.g. SBIN0001234, HDFC0001245).'
        });
      }

      const maskedNumber = finalAccountNumber.startsWith('XXXX-')
        ? finalAccountNumber
        : `XXXX-XXXX-${finalAccountNumber.slice(-4)}`;

      sanitizedPayout = {
        method: 'bank',
        accountName,
        accountNumber: finalAccountNumber,
        accountNumberMasked: maskedNumber,
        ifscCode,
        bankName: bankName || 'Partner Bank',
        upiId: (payoutDetails?.upiId || req.user.bankDetails?.upiId || '').trim()
      };
    } else if (method === 'upi') {
      const upiId = (payoutDetails?.upiId || req.user.bankDetails?.upiId || '').toString().trim();
      const accountName = (payoutDetails?.accountName || req.user.name || '').trim();

      if (!upiId || !UPI_REGEX.test(upiId)) {
        return res.status(400).json({
          error: 'Please enter a valid UPI Virtual Payment Address (e.g. agent@okaxis, 0000000000@paytm).'
        });
      }

      sanitizedPayout = {
        method: 'upi',
        accountName,
        accountNumber: '',
        accountNumberMasked: upiId,
        ifscCode: '',
        bankName: 'UPI Instant Payout',
        upiId
      };
    } else {
      return res.status(400).json({
        error: 'Invalid payout method selected. Supported methods: bank or upi.'
      });
    }

    // 7. Atomic Concurrency Lock: Deduct from availableBalance and add to reservedBalance
    const updatedWallet = await Wallet.findOneAndUpdate(
      {
        userId: req.user._id,
        availableBalance: { $gte: numAmount }
      },
      {
        $inc: {
          availableBalance: -numAmount,
          reservedBalance: numAmount
        }
      },
      { new: true }
    );

    if (!updatedWallet) {
      return res.status(400).json({
        error: 'Could not reserve funds due to a concurrent transaction or insufficient available balance.'
      });
    }

    // 8. Create Withdrawal Request
    const withdrawal = new WithdrawalRequest({
      agentId: req.user._id,
      companyId: req.user.companyId || null,
      companyCode: req.user.companyCode,
      amount: numAmount,
      payoutDetails: sanitizedPayout,
      status: WITHDRAWAL_STATUS.PENDING
    });
    await withdrawal.save();

    // 9. Record Immutable Ledger Reservation Entry
    const idempotencyKey = `WDR_LOCK_${withdrawal._id}`;
    await WalletLedger.create({
      walletId: updatedWallet._id,
      userId: req.user._id,
      companyId: req.user.companyId || null,
      companyCode: req.user.companyCode,
      entryType: 'DEBIT',
      amount: numAmount,
      balanceAfter: updatedWallet.availableBalance,
      transactionType: TRANSACTION_TYPES.WITHDRAWAL_LOCK,
      referenceType: 'WITHDRAWAL',
      referenceId: withdrawal._id.toString(),
      description: `Earnings reserved for withdrawal request #${withdrawal._id.toString().slice(-6).toUpperCase()} to ${sanitizedPayout.accountName} (${sanitizedPayout.method === 'upi' ? sanitizedPayout.upiId : sanitizedPayout.accountNumberMasked})`,
      idempotencyKey
    });

    // 10. Persist or update agent bank details for future withdrawals if requested or absent
    if (saveBankDetails || !req.user.bankDetails?.accountName) {
      await User.findByIdAndUpdate(req.user._id, {
        bankDetails: {
          accountName: sanitizedPayout.accountName,
          accountNumberMasked: sanitizedPayout.accountNumberMasked,
          ifscCode: sanitizedPayout.ifscCode,
          upiId: sanitizedPayout.upiId,
          bankName: sanitizedPayout.bankName
        }
      });
    }

    // 11. Broadcast Realtime WebSocket Event to Company Room
    try {
      websocketService.broadcast(`company:${req.user.companyCode}`, 'NEW_WITHDRAWAL_REQUEST', {
        withdrawalId: withdrawal._id,
        amount: numAmount,
        agentName: req.user.name,
        agentCode: req.user.referralCode,
        requestedAt: withdrawal.createdAt
      });
    } catch (wsErr) {
      console.warn('[Withdrawal WS Warning]', wsErr);
    }

    const updatedMetrics = await getAgentWithdrawalMetrics(req.user._id, updatedWallet.availableBalance);

    res.status(201).json({
      success: true,
      message: `Withdrawal request of ₹${numAmount.toLocaleString('en-IN')} submitted successfully. Funds are held in escrow pending company owner approval.`,
      withdrawal,
      wallet: {
        availableBalance: updatedWallet.availableBalance,
        reservedBalance: updatedWallet.reservedBalance
      },
      summary: updatedMetrics
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Agent views their withdrawal requests and live earnings summary
 * GET /api/v1/withdrawals/mine, /me, or /
 */
router.get(['/mine', '/me', '/'], authenticateToken, authorizeRoles(ROLES.AGENT), async (req, res, next) => {
  try {
    const [withdrawals, wallet, user] = await Promise.all([
      WithdrawalRequest.find({ agentId: req.user._id }).sort({ createdAt: -1 }),
      Wallet.findOne({ userId: req.user._id }),
      User.findById(req.user._id).select('name email phone kycStatus bankDetails')
    ]);

    const availableBalance = wallet?.availableBalance || 0;
    const reservedBalance = wallet?.reservedBalance || 0;
    const metrics = await getAgentWithdrawalMetrics(req.user._id, availableBalance);

    res.json({
      success: true,
      count: withdrawals.length,
      withdrawals,
      summary: {
        ...metrics,
        availableBalance,
        reservedBalance,
        kycStatus: user?.kycStatus || req.user.kycStatus,
        bankDetails: user?.bankDetails || req.user.bankDetails || {}
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Fetch a single withdrawal request details
 * GET /api/v1/withdrawals/:id
 */
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const withdrawal = await WithdrawalRequest.findById(req.params.id)
      .populate('agentId', 'name email phone referralCode agencyName');

    if (!withdrawal) {
      return res.status(404).json({ error: 'Withdrawal request not found' });
    }

    // Role security check: agent must own it, or company owner/admin of matching company
    const isOwner = withdrawal.agentId?._id?.toString() === req.user._id.toString();
    const isCompanyStaff = req.user.companyCode === withdrawal.companyCode && [ROLES.COMPANY_OWNER, ROLES.ADMIN].includes(req.user.role);

    if (!isOwner && !isCompanyStaff && req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({ error: 'Unauthorized to view this withdrawal record' });
    }

    res.json({
      success: true,
      withdrawal
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
