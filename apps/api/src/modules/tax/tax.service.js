const TaxEntry = require('./tax.model');

function getTaxPeriods(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const period = `${year}-${month}`;

  // Indian financial year runs from April 1 to March 31
  const fyStart = d.getMonth() >= 3 ? year : year - 1;
  const financialYear = `${fyStart}-${fyStart + 1}`;

  return { period, financialYear };
}

class TaxService {
  /**
   * Record 5% GST collected on ticket fare
   */
  async recordGstEntry({ booking, subtotal, gstAmount }) {
    if (!gstAmount || gstAmount <= 0) return null;

    const { period, financialYear } = getTaxPeriods(booking.createdAt || new Date());

    return await TaxEntry.create({
      taxType: 'GST',
      refType: 'BOOKING',
      refId: booking.pnr || booking.bookingId,
      bookingId: booking._id,
      companyId: booking.companyId || null,
      companyCode: booking.companyCode || null,
      taxableAmount: subtotal,
      taxRate: 0.05,
      amount: gstAmount,
      period,
      financialYear,
      status: 'ACCRUED',
      metadata: {
        pnr: booking.pnr,
        bookingId: booking.bookingId,
        seatCount: booking.seatNumbers?.length || 1,
        routeId: booking.routeId,
        busId: booking.busId
      }
    });
  }

  /**
   * Record 1% TCS deducted from agent commission credit
   */
  async recordTcsEntry({ commissionRecord, grossCommission, tcsDeducted, agent, companyCode }) {
    if (!tcsDeducted || tcsDeducted <= 0) return null;

    const { period, financialYear } = getTaxPeriods(commissionRecord.createdAt || new Date());

    return await TaxEntry.create({
      taxType: 'TCS',
      refType: 'COMMISSION',
      refId: `TCS_${commissionRecord._id}`,
      bookingId: commissionRecord.bookingId,
      commissionRecordId: commissionRecord._id,
      agentId: agent?._id || commissionRecord.agentId,
      companyId: agent?.companyId || commissionRecord?.companyId || null,
      companyCode: companyCode || agent?.companyCode || null,
      taxableAmount: grossCommission,
      taxRate: 0.01,
      amount: tcsDeducted,
      period,
      financialYear,
      status: 'ACCRUED',
      metadata: {
        pnr: commissionRecord.pnr,
        level: commissionRecord.level,
        agentName: agent?.name || 'Agent',
        agentPan: agent?.panNumber || agent?.pan || 'N/A',
        agentPhone: agent?.phone || 'N/A'
      }
    });
  }

  /**
   * Record reversal entry when booking is cancelled
   */
  async reverseBookingGstEntry(booking) {
    const existing = await TaxEntry.findOne({
      taxType: 'GST',
      refId: booking.pnr || booking.bookingId,
      status: 'ACCRUED'
    });

    if (existing) {
      existing.status = 'REVERSED';
      await existing.save();

      const { period, financialYear } = getTaxPeriods();
      return await TaxEntry.create({
        taxType: 'GST',
        refType: 'CANCELLATION',
        refId: `REV_${existing.refId}`,
        bookingId: booking._id,
        companyCode: booking.companyCode,
        taxableAmount: -existing.taxableAmount,
        taxRate: existing.taxRate,
        amount: -existing.amount,
        period,
        financialYear,
        status: 'REVERSED',
        metadata: {
          originalEntryId: existing._id,
          pnr: booking.pnr,
          reason: booking.cancellationDetails?.reason || 'Ticket Cancelled'
        }
      });
    }
    return null;
  }

  /**
   * Record reversal entry when commission is reversed
   */
  async reverseTcsEntry(commissionRecord) {
    const existing = await TaxEntry.findOne({
      taxType: 'TCS',
      commissionRecordId: commissionRecord._id,
      status: 'ACCRUED'
    });

    if (existing) {
      existing.status = 'REVERSED';
      await existing.save();

      const { period, financialYear } = getTaxPeriods();
      return await TaxEntry.create({
        taxType: 'TCS',
        refType: 'CANCELLATION',
        refId: `REV_TCS_${commissionRecord._id}`,
        bookingId: commissionRecord.bookingId,
        commissionRecordId: commissionRecord._id,
        agentId: commissionRecord.agentId,
        companyCode: commissionRecord.companyCode || existing.companyCode,
        taxableAmount: -existing.taxableAmount,
        taxRate: existing.taxRate,
        amount: -existing.amount,
        period,
        financialYear,
        status: 'REVERSED',
        metadata: {
          originalEntryId: existing._id,
          pnr: commissionRecord.pnr,
          level: commissionRecord.level
        }
      });
    }
    return null;
  }

  /**
   * Query GST Summary & List
   */
  async getGstReport({ period, companyCode, status }) {
    const query = { taxType: 'GST' };
    if (period && period !== 'all') query.period = period;
    if (companyCode) query.companyCode = Number(companyCode);
    if (status) query.status = status;

    const entries = await TaxEntry.find(query).sort({ createdAt: -1 }).limit(500);

    const totalTaxable = entries.reduce((s, e) => s + (e.taxableAmount || 0), 0);
    const totalGst = entries.reduce((s, e) => s + (e.amount || 0), 0);

    return {
      success: true,
      summary: {
        totalEntries: entries.length,
        totalTaxableTurnover: Math.round(totalTaxable * 100) / 100,
        totalGstCollected: Math.round(totalGst * 100) / 100,
        gstRate: '5%'
      },
      entries
    };
  }

  /**
   * Query TCS Summary & List
   */
  async getTcsReport({ period, companyCode, agentId, status }) {
    const query = { taxType: 'TCS' };
    if (period && period !== 'all') query.period = period;
    if (companyCode) query.companyCode = Number(companyCode);
    if (agentId) query.agentId = agentId;
    if (status) query.status = status;

    const entries = await TaxEntry.find(query)
      .populate('agentId', 'name email phone panNumber')
      .sort({ createdAt: -1 })
      .limit(500);

    const totalTaxable = entries.reduce((s, e) => s + (e.taxableAmount || 0), 0);
    const totalTcs = entries.reduce((s, e) => s + (e.amount || 0), 0);

    return {
      success: true,
      summary: {
        totalEntries: entries.length,
        totalGrossCommission: Math.round(totalTaxable * 100) / 100,
        totalTcsDeducted: Math.round(totalTcs * 100) / 100,
        tcsRate: '1%'
      },
      entries
    };
  }
}

module.exports = new TaxService();

