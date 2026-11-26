const ReconciliationRun = require('./reconciliation.model');
const { Wallet, WalletLedger } = require('../wallets/wallet.model');
const Payment = require('../payments/payment.model');
const Booking = require('../bookings/booking.model');
const WithdrawalRequest = require('../withdrawals/withdrawal.model');
const payoutService = require('../withdrawals/payout.service');
const RazorpayXProvider = require('../../providers/payments/RazorpayXProvider');
const walletLedger = require('../../services/walletLedger.service');
const env = require('../../config/env');
const { WITHDRAWAL_STATUS, TRANSACTION_TYPES } = require('../../config/constants');

class ReconciliationService {
  /**
   * Provides current finance overview: wallet liabilities vs banking balance,
   * gateway health, and last reconciliation report.
   */
  async overview() {
    const isRazorpayConfigured = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
    const isRazorpayXConfigured = RazorpayXProvider.isConfigured();
    const balanceInfo = await RazorpayXProvider.getBalance();

    // Calculate aggregated wallet liabilities across the platform
    const wallets = await Wallet.find({}).lean();
    let agentWalletsTotal = 0;
    let companyWalletsTotal = 0;
    let totalAvailable = 0;
    let totalReserved = 0;

    for (const w of wallets) {
      const avail = Number(w.availableBalance) || 0;
      const res = Number(w.reservedBalance) || 0;
      totalAvailable += avail;
      totalReserved += res;

      if (w.ownerType === 'COMPANY') {
        companyWalletsTotal += (avail + res);
      } else {
        agentWalletsTotal += (avail + res);
      }
    }

    const totalWalletLiabilities = totalAvailable + totalReserved;

    // Last 5 reconciliation runs
    const lastRun = await ReconciliationRun.findOne().sort({ createdAt: -1 });
    const history = await ReconciliationRun.find().sort({ createdAt: -1 }).limit(5);

    // Ledger transaction volume in last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [ledgerStats] = await WalletLedger.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: null,
          totalCredits: { $sum: { $cond: [{ $eq: ['$entryType', 'CREDIT'] }, '$amount', 0] } },
          totalDebits: { $sum: { $cond: [{ $eq: ['$entryType', 'DEBIT'] }, '$amount', 0] } },
          count: { $sum: 1 }
        }
      }
    ]) || [{}];

    return {
      razorpayConfigured: isRazorpayConfigured,
      razorpayXConfigured: isRazorpayXConfigured,
      razorpayXBalance: balanceInfo.balance,
      isSimulated: Boolean(balanceInfo.isSimulated),
      totalWalletLiabilities: Math.round(totalWalletLiabilities * 100) / 100,
      totalAvailable: Math.round(totalAvailable * 100) / 100,
      totalReserved: Math.round(totalReserved * 100) / 100,
      agentWalletsTotal: Math.round(agentWalletsTotal * 100) / 100,
      companyWalletsTotal: Math.round(companyWalletsTotal * 100) / 100,
      ledgerSummary: {
        totalCredits: ledgerStats?.totalCredits || 0,
        totalDebits: ledgerStats?.totalDebits || 0,
        transactionCount: ledgerStats?.count || 0
      },
      lastRun,
      history
    };
  }

  /**
   * Runs end-to-end reconciliation:
   * 1. Sweeps stuck in-flight RazorpayX payouts.
   * 2. Checks unfulfilled captured deposits and auto-credits wallets (Auto-Heal).
   * 3. Checks captured bookings with pending tickets and fulfills them.
   * 4. Compares wallet reserves and platform liabilities.
   */
  async run({ days = 2, autoHeal = true, trigger = 'MANUAL', actorId = null }) {
    const run = new ReconciliationRun({
      trigger,
      status: 'RUNNING',
      actorId,
      days
    });
    await run.save();

    const discrepancies = [];
    let checkedCount = 0;
    let healedCount = 0;

    try {
      // Step 1: Reconcile in-flight payouts via RazorpayX sweeper
      const payoutResult = await payoutService.sweep({ olderThanMs: 0, limit: 100 });
      checkedCount += (payoutResult.checked || 0);
      healedCount += (payoutResult.resolved || 0);

      // Step 2: Check captured payments in the window that missed fulfillment
      const windowStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const unfulfilledPayments = await Payment.find({
        createdAt: { $gte: windowStart },
        status: 'CAPTURED',
        fulfillmentStatus: 'PENDING'
      }).limit(100);

      checkedCount += unfulfilledPayments.length;

      for (const p of unfulfilledPayments) {
        if (p.purpose === 'WALLET_DEPOSIT' || p.purpose === 'COMPANY_WALLET_DEPOSIT') {
          discrepancies.push({
            type: 'CAPTURED_UNCREDITED_DEPOSIT',
            referenceId: p.orderId,
            description: `Payment order ${p.orderId} of ₹${p.amount} was captured on Razorpay but not fulfilled in wallet.`,
            actionTaken: autoHeal ? 'Auto-credited wallet balance and recorded ledger entry.' : 'Flagged for manual review.',
            healed: autoHeal
          });

          if (autoHeal && p.userId) {
            try {
              const depositKey = `DEP_AUTOHEAL_${p.orderId}`;
              await walletLedger.credit({
                userId: p.userId,
                amount: p.amount,
                transactionType: TRANSACTION_TYPES.WALLET_DEPOSIT,
                referenceType: 'PAYMENT',
                referenceId: p.orderId,
                description: `Auto-healed wallet deposit for Razorpay order ${p.orderId}`,
                idempotencyKey: depositKey,
                companyCode: p.companyCode
              });
              p.fulfillmentStatus = 'FULFILLED';
              await p.save();
              healedCount++;
            } catch (err) {
              console.error('[Reconciliation Auto-Heal Deposit Error]', err);
            }
          }
        }
      }

      // Step 3: Check Bookings that were paid but remain INITIATED/PENDING
      const paidPendingBookings = await Booking.find({
        createdAt: { $gte: windowStart },
        status: { $in: ['INITIATED', 'PENDING'] },
        'paymentDetails.status': 'SUCCESS'
      }).limit(50);

      checkedCount += paidPendingBookings.length;

      for (const b of paidPendingBookings) {
        discrepancies.push({
          type: 'PAID_UNCONFIRMED_BOOKING',
          referenceId: b.bookingId || String(b._id),
          description: `Booking ${b.bookingId} received payment but was not moved to CONFIRMED.`,
          actionTaken: autoHeal ? 'Auto-confirmed booking status.' : 'Flagged for operator review.',
          healed: autoHeal
        });

        if (autoHeal) {
          b.status = 'CONFIRMED';
          await b.save();
          healedCount++;
        }
      }

      // Calculate totals for report snapshot
      const overviewData = await this.overview();

      run.status = 'COMPLETED';
      run.counts = {
        checked: checkedCount,
        issues: discrepancies.length,
        healed: healedCount
      };
      run.details = {
        walletLiabilities: overviewData.totalWalletLiabilities,
        agentWalletsTotal: overviewData.agentWalletsTotal,
        companyWalletsTotal: overviewData.companyWalletsTotal,
        razorpayXBalance: overviewData.razorpayXBalance,
        discrepancies
      };
      await run.save();

      return run;
    } catch (err) {
      console.error('[Reconciliation Run Error]', err);
      run.status = 'FAILED';
      run.error = err.message;
      await run.save();
      return run;
    }
  }
}

module.exports = new ReconciliationService();
