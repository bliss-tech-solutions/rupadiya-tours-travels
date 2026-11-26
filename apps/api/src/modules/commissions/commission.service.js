const { CommissionTier, CommissionRecord } = require('./commission.model');
const User = require('../users/user.model');
const taxService = require('../tax/tax.service');
const walletLedger = require('../../services/walletLedger.service');
const env = require('../../config/env');
const { DEFAULT_COMMISSION_TIERS, DEFAULT_BONUS_PER_SEAT, TRANSACTION_TYPES, ROLES } = require('../../config/constants');

const MAX_LEVELS = 5;

class CommissionService {
  /**
   * Walk up to 5 levels of the referral tree and credit each agent's commission.
   *
   *  - Idempotent: a unique (bookingId, level) index plus ledger idempotency keys
   *    guarantee a retry never pays twice.
   *  - Cycle-safe: a corrupted referral chain (A → B → A) stops instead of looping.
   *  - Inactive / non-agent users end the chain.
   *  - 1% TCS is withheld and recorded for tax filing.
   */
  async distributeCommissions({ booking, trip, seatCount }) {
    if (!booking.referralAgentId || !(seatCount > 0)) return [];

    let tiers = await CommissionTier.find({ isActive: true }).sort({ level: 1 }).lean();
    if (!tiers || tiers.length === 0) tiers = DEFAULT_COMMISSION_TIERS;

    const tcsRate = env.TCS_RATE || 0.01;
    const visited = new Set();
    const distributed = [];
    let currentAgentId = booking.referralAgentId;
    let level = 1;

    while (currentAgentId && level <= MAX_LEVELS) {
      const key = String(currentAgentId);
      if (visited.has(key)) {
        console.warn(`[Commission] Referral cycle detected at ${key} for booking ${booking.bookingId}`);
        break;
      }
      visited.add(key);

      const agent = await User.findById(currentAgentId).select('_id role isActive referredBy companyId companyCode name');
      if (!agent || agent.isActive === false || agent.role !== ROLES.AGENT) break;

      const tier = tiers.find((t) => Number(t.level) === level) || { ratePerSeat: 100, bonusPerSeat: DEFAULT_BONUS_PER_SEAT };
      const baseRate = Math.max(0, Number(tier.ratePerSeat) || 0);
      const bonusPerSeat = Math.max(0, Number(tier.bonusPerSeat ?? DEFAULT_BONUS_PER_SEAT) || 0);
      const effectiveRate = baseRate + bonusPerSeat;
      const grossCommission = effectiveRate * seatCount;
      const tcsDeducted = Math.round(grossCommission * tcsRate);
      const netCommission = grossCommission - tcsDeducted;

      if (netCommission > 0) {
        let record;
        try {
          record = await CommissionRecord.create({
            bookingId: booking._id,
            pnr: booking.pnr,
            tripId: trip._id,
            agentId: agent._id,
            companyId: agent.companyId || booking.companyId || null,
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
        } catch (err) {
          if (err.code === 11000) {
            record = await CommissionRecord.findOne({ bookingId: booking._id, level });
          } else {
            throw err;
          }
        }

        await walletLedger.credit({
          userId: agent._id,
          amount: netCommission,
          companyId: agent.companyId || booking.companyId || null,
          companyCode: agent.companyCode || booking.companyCode,
          transactionType: TRANSACTION_TYPES.TICKET_COMMISSION_CREDIT,
          referenceType: 'COMMISSION',
          referenceId: booking.bookingId,
          description: `Level ${level} commission · PNR ${booking.pnr} · ${seatCount} seat${seatCount > 1 ? 's' : ''} × ₹${effectiveRate} less ${Math.round(tcsRate * 100)}% TCS`,
          idempotencyKey: `COMM_CREDIT_${booking.bookingId}_L${level}_${agent._id}`
        });

        try {
          await taxService.recordTcsEntry({
            commissionRecord: record,
            grossCommission,
            tcsDeducted,
            agent,
            companyCode: agent.companyCode || booking.companyCode
          });
        } catch (taxErr) {
          console.error('[TaxEngine TCS Error]', taxErr.message);
        }

        distributed.push(record);
      }

      currentAgentId = agent.referredBy;
      level += 1;
    }

    return distributed;
  }

  /**
   * Reverse commissions when a ticket is cancelled.
   * Each record flips CREDITED → REVERSED atomically, so concurrent cancellations
   * cannot claw back twice. If the agent already withdrew the money, we recover
   * what is available (never pushing the wallet negative) and log the shortfall.
   */
  async reverseCommissions(bookingObjectId) {
    const records = await CommissionRecord.find({ bookingId: bookingObjectId, status: 'CREDITED' });

    for (const candidate of records) {
      const record = await CommissionRecord.findOneAndUpdate(
        { _id: candidate._id, status: 'CREDITED' },
        { $set: { status: 'REVERSED' } },
        { new: true }
      );
      if (!record) continue;

      const res = await walletLedger.debit({
        userId: record.agentId,
        amount: record.netCommission,
        companyCode: record.companyCode,
        transactionType: TRANSACTION_TYPES.COMMISSION_REVERSAL,
        referenceType: 'COMMISSION',
        referenceId: record.pnr,
        description: `Level ${record.level} commission reversed · PNR ${record.pnr} cancelled`,
        idempotencyKey: `COMM_REV_${record._id}`,
        allowPartial: true
      });

      if ((res.amount || 0) < record.netCommission) {
        console.warn(
          `[Commission Reversal] Shortfall ₹${record.netCommission - (res.amount || 0)} for agent ${record.agentId} on PNR ${record.pnr}`
        );
      }

      try {
        await taxService.reverseTcsEntry(record);
      } catch (taxErr) {
        console.error('[TaxEngine TCS Reversal Error]', taxErr.message);
      }
    }
  }
}

module.exports = new CommissionService();
