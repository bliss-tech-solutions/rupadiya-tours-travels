const { CommissionTier, CommissionRecord } = require('./commission.model');
const { Wallet, WalletLedger } = require('../wallets/wallet.model');
const User = require('../users/user.model');
const env = require('../../config/env');
const { DEFAULT_COMMISSION_TIERS, TRANSACTION_TYPES } = require('../../config/constants');

class CommissionService {
  /**
   * Traverse up to 5 levels of the referral tree and distribute commissions
   */
  async distributeCommissions({ booking, trip, seatCount }) {
    if (!booking.referralAgentId) return;

    // Load active commission tiers
    let tiers = await CommissionTier.find({ isActive: true }).sort({ level: 1 });
    if (!tiers || tiers.length === 0) {
      // Fallback to default tiers
      tiers = DEFAULT_COMMISSION_TIERS;
    }

    let currentAgentId = booking.referralAgentId;
    let level = 1;

    while (currentAgentId && level <= 5) {
      const agent = await User.findById(currentAgentId);
      if (!agent || !agent.isActive) break;

      const tier = tiers.find(t => t.level === level) || { ratePerSeat: 100, bonusPerSeat: 20 };
      const ratePerSeat = tier.ratePerSeat;
      const grossCommission = ratePerSeat * seatCount;
      const tcsRate = env.TCS_RATE;
      const tcsDeducted = Math.round(grossCommission * tcsRate);
      const netCommission = grossCommission - tcsDeducted;

      // 1. Create Commission Record
      const commRecord = new CommissionRecord({
        bookingId: booking._id,
        pnr: booking.pnr,
        tripId: trip._id,
        agentId: agent._id,
        level,
        seatCount,
        ratePerSeat,
        grossCommission,
        tcsRate,
        tcsDeducted,
        netCommission,
        status: 'CREDITED'
      });
      await commRecord.save();

      // 2. Credit Agent Wallet & Record Double-Entry Ledger
      let wallet = await Wallet.findOne({ userId: agent._id });
      if (!wallet) {
        wallet = await Wallet.create({
          userId: agent._id,
          companyCode: agent.companyCode,
          availableBalance: 0,
          reservedBalance: 0
        });
      }

      wallet.availableBalance += netCommission;
      await wallet.save();

      const idempotencyKey = `COMM_CREDIT_${booking.bookingId}_L${level}_${agent._id}`;
      await WalletLedger.create({
        walletId: wallet._id,
        userId: agent._id,
        companyCode: agent.companyCode,
        entryType: 'CREDIT',
        amount: netCommission,
        balanceAfter: wallet.availableBalance,
        transactionType: TRANSACTION_TYPES.TICKET_COMMISSION_CREDIT,
        referenceType: 'COMMISSION',
        referenceId: booking.bookingId,
        description: `Level ${level} commission for PNR ${booking.pnr} (${seatCount} seats @ ₹${ratePerSeat}/seat, less 1% TCS)`,
        idempotencyKey
      });

      // Move to parent agent for the next tier
      currentAgentId = agent.referredBy;
      level++;
    }
  }

  /**
   * Reverse commissions upon ticket cancellation
   */
  async reverseCommissions(bookingId) {
    const records = await CommissionRecord.find({ bookingId, status: 'CREDITED' });

    for (const record of records) {
      const wallet = await Wallet.findOne({ userId: record.agentId });
      if (wallet) {
        wallet.availableBalance = Math.max(0, wallet.availableBalance - record.netCommission);
        await wallet.save();

        const idempotencyKey = `COMM_REV_${record._id}_${Date.now()}`;
        await WalletLedger.create({
          walletId: wallet._id,
          userId: record.agentId,
          companyCode: wallet.companyCode,
          entryType: 'DEBIT',
          amount: record.netCommission,
          balanceAfter: wallet.availableBalance,
          transactionType: TRANSACTION_TYPES.COMMISSION_REVERSAL,
          referenceType: 'COMMISSION',
          referenceId: record.pnr,
          description: `Reversal of Level ${record.level} commission due to cancellation of PNR ${record.pnr}`,
          idempotencyKey
        });
      }

      record.status = 'REVERSED';
      await record.save();
    }
  }
}

module.exports = new CommissionService();
