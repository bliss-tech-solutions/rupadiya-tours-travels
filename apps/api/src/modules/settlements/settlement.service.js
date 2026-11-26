const crypto = require('crypto');
const Booking = require('../bookings/booking.model');
const Company = require('../companies/company.model');
const CompanySettlement = require('./companySettlement.model');

/**
 * RBS ↔ company settlement.
 *
 * Every confirmed ticket on a company's bus earns that company its TICKET FARE only
 * (seat fares, no GST / platform fee / gateway fee / insurance / agent charge).
 * Online and agent-wallet money is collected by RBS; cash tickets are collected by the
 * company office from the agent — that cash is RBS money held by the company.
 *
 *   net = ticket fares owed − cash held by company − clawbacks
 *   net > 0 → RBS pays the company; net < 0 → the company pays RBS.
 *
 * A ticket is included in exactly one statement (stamped on issue). A ticket cancelled after its
 * statement was issued is clawed back (negative fare line) in the next statement.
 */

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

function channelOf(b) {
  if (b.fareBreakdown?.paymentChannel) return b.fareBreakdown.paymentChannel;
  if (b.paymentProvider === 'agent_cash') return 'CASH';
  if (b.paymentProvider === 'agent_wallet' || b.paymentProvider === 'AGENT_WALLET') return 'WALLET';
  return 'ONLINE';
}

function normalisePeriod(from, to) {
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw httpError('Choose a valid period.');
  if (end <= start) throw httpError('Period end must be after period start.');
  if (end.getTime() - start.getTime() > 400 * 86400000) throw httpError('A statement can cover at most about one year.');
  return { start, end };
}

/** Standard periods: last full week (Mon–Sun) or a calendar month. */
function presetPeriod(preset, ref = new Date()) {
  const d = new Date(ref);
  if (preset === 'LAST_WEEK') {
    const day = (d.getDay() + 6) % 7; // Monday = 0
    const thisMonday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
    return { from: new Date(thisMonday.getTime() - 7 * 86400000), to: thisMonday };
  }
  if (preset === 'THIS_WEEK') {
    const day = (d.getDay() + 6) % 7;
    const thisMonday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
    return { from: thisMonday, to: new Date(thisMonday.getTime() + 7 * 86400000) };
  }
  if (preset === 'LAST_MONTH') {
    return { from: new Date(d.getFullYear(), d.getMonth() - 1, 1), to: new Date(d.getFullYear(), d.getMonth(), 1) };
  }
  if (preset === 'THIS_MONTH') {
    return { from: new Date(d.getFullYear(), d.getMonth(), 1), to: new Date(d.getFullYear(), d.getMonth() + 1, 1) };
  }
  throw httpError('Unknown period preset.');
}

class SettlementService {
  /**
   * Compute (without saving) what is owed for a company between `from` and `to`.
   * Only tickets not yet included in another statement are counted.
   */
  async compute(companyCode, from, to) {
    const { start, end } = normalisePeriod(from, to);
    const code = Number(companyCode);

    // Everything still unsettled up to the period end is included, so a skipped week is never lost.
    // Cash tickets count from the moment the company office received the cash.
    const tickets = await Booking.find({
      companyCode: code,
      status: { $in: ['CONFIRMED', 'COMPLETED'] },
      'settlement.id': null,
      $or: [
        { paymentProvider: { $ne: 'agent_cash' }, createdAt: { $lt: end } },
        { paymentProvider: 'agent_cash', 'cashCollection.status': 'RECEIVED', 'cashCollection.receivedAt': { $lt: end } }
      ]
    })
      .select('pnr seatNumbers fareBreakdown paymentProvider cashCollection createdAt tripId')
      .populate('tripId', 'departureTime')
      .lean();

    // Tickets already settled earlier but cancelled since → take the fare back.
    const clawbackTickets = await Booking.find({
      companyCode: code,
      status: 'CANCELLED',
      'settlement.id': { $ne: null },
      'settlement.clawbackId': null,
      'cancellationDetails.cancelledAt': { $lt: end }
    })
      .select('pnr seatNumbers fareBreakdown paymentProvider createdAt tripId')
      .populate('tripId', 'departureTime')
      .lean();

    const lines = [];
    const byChannel = { ONLINE: 0, WALLET: 0, CASH: 0 };
    let ticketFareOwed = 0;
    let cashHeld = 0;
    let seatCount = 0;

    for (const b of tickets) {
      const fare = round2(b.fareBreakdown?.subtotal);
      const channel = channelOf(b);
      const cash = channel === 'CASH' ? round2(b.cashCollection?.amountDue) : 0;
      ticketFareOwed += fare;
      cashHeld += cash;
      seatCount += (b.seatNumbers || []).length;
      byChannel[channel] += fare;
      lines.push({
        bookingId: b._id, pnr: b.pnr, type: 'TICKET', channel,
        bookedAt: b.createdAt, travelDate: b.tripId?.departureTime || null,
        seats: (b.seatNumbers || []).length, ticketFare: fare, cashHeld: cash
      });
    }

    let clawbacks = 0;
    for (const b of clawbackTickets) {
      const fare = round2(b.fareBreakdown?.subtotal);
      clawbacks += fare;
      lines.push({
        bookingId: b._id, pnr: b.pnr, type: 'CLAWBACK', channel: channelOf(b),
        bookedAt: b.createdAt, travelDate: b.tripId?.departureTime || null,
        seats: (b.seatNumbers || []).length, ticketFare: -fare, cashHeld: 0
      });
    }

    ticketFareOwed = round2(ticketFareOwed);
    cashHeld = round2(cashHeld);
    clawbacks = round2(clawbacks);
    const net = round2(ticketFareOwed - clawbacks - cashHeld);

    const company = await Company.findOne({ companyCode: code }).select('name').lean();
    return {
      companyCode: code,
      companyName: company?.name || `Company #${code}`,
      periodFrom: start,
      periodTo: end,
      ticketCount: tickets.length,
      seatCount,
      ticketFareOwed,
      clawbacks,
      cashHeldByCompany: cashHeld,
      net,
      direction: net > 0 ? 'RBS_PAYS_COMPANY' : net < 0 ? 'COMPANY_PAYS_RBS' : 'NIL',
      byChannel: { ONLINE: round2(byChannel.ONLINE), WALLET: round2(byChannel.WALLET), CASH: round2(byChannel.CASH) },
      lines: lines.sort((a, b) => new Date(a.bookedAt) - new Date(b.bookedAt))
    };
  }

  /**
   * Issue a statement: saves it and stamps every included ticket so it is never counted again.
   */
  async issue({ companyCode, from, to, actorId, notes = '' }) {
    const preview = await this.compute(companyCode, from, to);
    if (!preview.lines.length) throw httpError('There are no unsettled tickets for this company in this period.', 409);

    const statementNo = `RBS-${preview.companyCode}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const settlement = await CompanySettlement.create({ ...preview, statementNo, issuedBy: actorId, notes: String(notes).slice(0, 500) });

    // Stamp tickets; a ticket grabbed concurrently by another statement is dropped from this one.
    const ticketIds = preview.lines.filter((l) => l.type === 'TICKET').map((l) => l.bookingId);
    const clawIds = preview.lines.filter((l) => l.type === 'CLAWBACK').map((l) => l.bookingId);
    await Booking.updateMany({ _id: { $in: ticketIds }, 'settlement.id': null }, { $set: { 'settlement.id': settlement._id } });
    await Booking.updateMany({ _id: { $in: clawIds }, 'settlement.clawbackId': null }, { $set: { 'settlement.clawbackId': settlement._id } });

    const stampedTickets = await Booking.countDocuments({ _id: { $in: ticketIds }, 'settlement.id': settlement._id });
    const stampedClaws = await Booking.countDocuments({ _id: { $in: clawIds }, 'settlement.clawbackId': settlement._id });
    if (stampedTickets !== ticketIds.length || stampedClaws !== clawIds.length) {
      // Lost a race with a concurrent issue: roll this statement back so totals stay exact.
      await Booking.updateMany({ 'settlement.id': settlement._id }, { $set: { 'settlement.id': null } });
      await Booking.updateMany({ 'settlement.clawbackId': settlement._id }, { $set: { 'settlement.clawbackId': null } });
      await CompanySettlement.deleteOne({ _id: settlement._id });
      throw httpError('Another statement was issued for these tickets at the same time. Please refresh and try again.', 409);
    }
    return settlement;
  }

  async markSettled({ settlementId, actorId, utrNumber, notes }) {
    const utr = String(utrNumber || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{6,30}$/.test(utr)) throw httpError('Enter the UTR / transaction reference of the transfer (6-30 letters or digits).');
    const s = await CompanySettlement.findOneAndUpdate(
      { _id: settlementId, status: 'ISSUED' },
      { $set: { status: 'SETTLED', settledAt: new Date(), settledBy: actorId, utrNumber: utr, ...(notes ? { notes: String(notes).slice(0, 500) } : {}) } },
      { new: true }
    );
    if (!s) {
      const existing = await CompanySettlement.findById(settlementId).select('status');
      throw existing ? httpError(`Statement is already ${existing.status.toLowerCase()}.`, 409) : httpError('Statement not found.', 404);
    }
    return s;
  }

  /** Void an issued (not yet settled) statement: its tickets become unsettled again. */
  async voidStatement({ settlementId }) {
    const s = await CompanySettlement.findOneAndUpdate({ _id: settlementId, status: 'ISSUED' }, { $set: { status: 'VOID' } }, { new: true });
    if (!s) throw httpError('Only an issued, unsettled statement can be voided.', 409);
    await Booking.updateMany({ 'settlement.id': s._id }, { $set: { 'settlement.id': null } });
    await Booking.updateMany({ 'settlement.clawbackId': s._id }, { $set: { 'settlement.clawbackId': null } });
    return s;
  }

  toCsv(settlement) {
    const cell = (v) => {
      const str = v === null || v === undefined ? '' : String(v instanceof Date ? v.toISOString().slice(0, 10) : v);
      const safe = /^[=+\-@\t\r]/.test(str) && Number.isNaN(Number(str)) ? `'${str}` : str;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const head = [
      ['Statement', settlement.statementNo || 'PREVIEW'],
      ['Company', `${settlement.companyName} (#${settlement.companyCode})`],
      ['Period', `${new Date(settlement.periodFrom).toISOString().slice(0, 10)} to ${new Date(new Date(settlement.periodTo).getTime() - 1).toISOString().slice(0, 10)}`],
      ['Ticket fares owed to company', settlement.ticketFareOwed],
      ['Clawbacks (cancelled after settlement)', settlement.clawbacks],
      ['Cash held by company (RBS money)', settlement.cashHeldByCompany],
      ['Net', settlement.net],
      ['Direction', settlement.direction === 'RBS_PAYS_COMPANY' ? 'RBS pays company' : settlement.direction === 'COMPANY_PAYS_RBS' ? 'Company pays RBS' : 'Nothing due'],
      ['Status', settlement.status || 'PREVIEW'],
      ['UTR', settlement.utrNumber || ''],
      []
    ];
    const header = ['PNR', 'Type', 'Payment', 'Booked On', 'Travel Date', 'Seats', 'Ticket Fare', 'Cash Held By Company'];
    const rows = (settlement.lines || []).map((l) => [l.pnr, l.type, l.channel, l.bookedAt ? new Date(l.bookedAt) : '', l.travelDate ? new Date(l.travelDate) : '', l.seats, l.ticketFare, l.cashHeld]);
    return [...head, header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
  }
}

module.exports = new SettlementService();
module.exports.presetPeriod = presetPeriod;
