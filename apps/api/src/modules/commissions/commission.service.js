const { CommissionTier, CommissionRecord } = require('./commission.model');
const { Wallet, WalletLedger } = require('../wallets/wallet.model');
const User = require('../users/user.model');
const taxService = require('../tax/tax.service');
const env = require('../../config/env');
const { DEFAULT_COMMISSION_TIERS, DEFAULT_BONUS_PER_SEAT, TRANSACTION_TYPES } = require('../../config/constants');

class CommissionService {
  /**
   * Traverse up to 5 levels of the referral tree and distribute commissions
   * Level 1: ₹100, Level 2: ₹100, Level 3: ₹100, Level 4: ₹200, Level 5: ₹300
   * Plus configurable bonus per seat (default ₹20)
   * Deduct 1% TCS and record into tax_entries
   */
  async distributeCommissions({ booking, trip, seatCount }) {
    if (!booking.referralAgentId) return [];

    // Load active commission tiers from DB or fallback to constants
    let tiers = await CommissionTier.find({ isActive: true }).sort({ level: 1 });
    if (!tiers || tiers.length === 0) {
      tiers = DEFAULT_COMMISSION_TIERS;
    }

    let currentAgentId = booking.referralAgentId;
    let level = 1;
    const distributedRecords = [];

    while (currentAgentId && level <= 5) {
      const agent = await User.findById(currentAgentId);
      if (!agent || !agent.isActive) break;

      const tier = tiers.find(t => t.level === level) || { ratePerSeat: 100, bonusPerSeat: DEFAULT_BONUS_PER_SEAT };
      const baseRate = Number(tier.ratePerSeat) || 100;
      const bonusPerSeat = Number(tier.bonusPerSeat !== undefined ? tier.bonusPerSeat : DEFAULT_BONUS_PER_SEAT);
      const effectiveRate = baseRate + bonusPerSeat;

      const grossCommission = effectiveRate * seatCount;
      const tcsRate = env.TCS_RATE || 0.01;
      const tcsDeducted = Math.round(grossCommission * tcsRate);
      const netCommission = grossCommission - tcsDeducted;

      // 1. Create Commission Record
      const commRecord = new CommissionRecord({
        bookingId: booking._id,
        pnr: booking.pnr,
        tripId: trip._id,
        agentId: agent._id,
        companyCode: agent.companyCode || booking.companyCode,
        level,
        seatCount,
        ratePerSeat: baseRate,
        bonusPerSeat,
        effectiveRatePerSeat: effectiveRate,
        grossCommission,
        tcsRate,
        tcsDeducted,
        netCommission,
        status: 'CREDITED'
      });
      await commRecord.save();
      distributedRecords.push(commRecord);

      // 2. Record 1% TCS in tax_entries table per PDF specification
      try {
        await taxService.recordTcsEntry({
          commissionRecord: commRecord,
          grossCommission,
          tcsDeducted,
          agent,
          companyCode: agent.companyCode || booking.companyCode
        });
      } catch (taxErr) {
        console.error('[TaxEngine TCS Error]', taxErr);
      }

      // 3. Credit Agent Wallet & Record Immutable Double-Entry Ledger
      let wallet = await Wallet.findOne({ userId: agent._id });
      if (!wallet) {
        wallet = await Wallet.create({
          userId: agent._id,
          companyCode: agent.companyCode || booking.companyCode,
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
        companyCode: agent.companyCode || booking.companyCode,
        entryType: 'CREDIT',
        amount: netCommission,
        balanceAfter: wallet.availableBalance,
        transactionType: TRANSACTION_TYPES.TICKET_COMMISSION_CREDIT,
        referenceType: 'COMMISSION',
        referenceId: booking.bookingId,
        description: `Level ${level} referral commission for PNR ${booking.pnr} (${seatCount} seats @ ₹${baseRate}+₹${bonusPerSeat}/seat bonus, less 1% TCS)`,
        idempotencyKey
      });

      // Move to parent agent for the next tier
      currentAgentId = agent.referredBy;
      level++;
    }

    return distributedRecords;
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

      // Record compensating tax entry reversal
      try {
        await taxService.reverseTcsEntry(record);
      } catch (taxErr) {
        console.error('[TaxEngine TCS Reversal Error]', taxErr);
      }

      record.status = 'REVERSED';
      await record.save();
    }
  }
}

module.exports = new CommissionService();
