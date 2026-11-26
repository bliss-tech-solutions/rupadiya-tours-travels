const crypto = require('crypto');
const Booking = require('../modules/bookings/booking.model');
const Trip = require('../modules/trips/trip.model');
const commissionService = require('../modules/commissions/commission.service');
const { CommissionRecord } = require('../modules/commissions/commission.model');
const CompanySettlement = require('../modules/settlements/companySettlement.model');
const User = require('../modules/users/user.model');
const walletLedger = require('./walletLedger.service');
const taxService = require('../modules/tax/tax.service');
const websocketService = require('./websocket.service');
const { PAYMENT_STATUS, TRANSACTION_TYPES } = require('../config/constants');

/**
 * Agent cash (COD) tickets.
 *
 * An agent sells a ticket for cash; the ticket is CONFIRMED but `cashCollection.status = PENDING`
 * until the agent hands the cash to the company office. Passengers on such a ticket cannot board.
 * The company office marks it RECEIVED (atomic, once), which:
 *   - switches payment status to SUCCESS,
 *   - issues a receipt number,
 *   - releases the agent's referral commission that was held back.
 * The cash collected is RBS money held by the company and is netted in the settlement statement.
 */

function receiptNumber() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `CR-${ymd}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

async function markReceived({ bookingIds, companyCode, actorId }) {
  const actor = actorId ? await User.findById(actorId).select('name').lean() : null;
  const ids = [...new Set((bookingIds || []).map(String))].slice(0, 200);
  if (!ids.length) {
    const err = new Error('Select at least one cash ticket.');
    err.statusCode = 400;
    throw err;
  }

  const receiptNo = receiptNumber();
  const results = [];

  for (const id of ids) {
    const filter = /^[a-f0-9]{24}$/i.test(id) ? { _id: id } : { $or: [{ bookingId: id }, { pnr: id.toUpperCase() }] };
    const booking = await Booking.findOneAndUpdate(
      { ...filter, companyCode, status: 'CONFIRMED', 'cashCollection.status': 'PENDING' },
      {
        $set: {
          'cashCollection.status': 'RECEIVED',
          'cashCollection.receivedAt': new Date(),
          'cashCollection.receivedBy': actorId,
          'cashCollection.receiptNo': receiptNo,
          paymentStatus: PAYMENT_STATUS.SUCCESS
        },
        $push: { 'cashCollection.history': { action: 'RECEIVED', receiptNo, at: new Date(), by: actorId, byName: actor?.name || '' } }
      },
      { new: true }
    );

    if (!booking) {
      const existing = await Booking.findOne({ ...filter, companyCode }).select('pnr status cashCollection');
      results.push({
        id,
        ok: false,
        pnr: existing?.pnr,
        reason: !existing ? 'Not found under your company'
          : existing.status !== 'CONFIRMED' ? `Ticket is ${existing.status.toLowerCase()}`
          : existing.cashCollection?.status === 'RECEIVED' ? 'Already marked received'
          : 'Not a cash ticket'
      });
      continue;
    }

    // Commission was held back for cash tickets; release it now (idempotent per booking & level).
    // After a revert, the earlier commission rows are re-credited instead of creating new ones.
    if (booking.referralAgentId) {
      try {
        const recredited = await recreditAfterRevert(booking);
        if (!recredited) {
          const trip = await Trip.findById(booking.tripId).select('_id');
          await commissionService.distributeCommissions({ booking, trip, seatCount: booking.seatNumbers.length });
        }
      } catch (commErr) {
        console.error('[Cash receive commission]', booking.bookingId, commErr.message);
      }
    }

    try {
      websocketService.broadcast(`agent:${booking.bookedByAgentId}`, 'CASH_RECEIVED', {
        pnr: booking.pnr, amount: booking.cashCollection.amountDue, receiptNo
      });
      websocketService.broadcast(`trip:${booking.tripId}`, 'PASSENGER_PAYMENT_CLEARED', { tripId: String(booking.tripId), pnr: booking.pnr });
    } catch (e) { /* realtime best-effort */ }

    require('../modules/notifications/notification.service').fire('cashReceived', booking._id, receiptNo);

    results.push({ id, ok: true, pnr: booking.pnr, amount: booking.cashCollection.amountDue, bookingId: booking.bookingId, agentId: booking.bookedByAgentId });
  }

  const received = results.filter((r) => r.ok);
  return {
    receiptNo,
    received: received.length,
    totalAmount: received.reduce((s, r) => s + (r.amount || 0), 0),
    results
  };
}

/** Re-credit commission rows that a cash revert took back. Returns how many were re-credited. */
async function recreditAfterRevert(booking) {
  const cycle = Number(booking.cashCollection?.revertCount || 0);
  if (!cycle) return 0;
  const rows = await CommissionRecord.find({ bookingId: booking._id, status: 'REVERSED', reversalReason: 'CASH_REVERTED' });
  let n = 0;
  for (const candidate of rows) {
    const record = await CommissionRecord.findOneAndUpdate(
      { _id: candidate._id, status: 'REVERSED', reversalReason: 'CASH_REVERTED' },
      { $set: { status: 'CREDITED', reversalReason: null } },
      { new: true }
    );
    if (!record) continue;
    n += 1;
    await walletLedger.credit({
      userId: record.agentId,
      amount: record.netCommission,
      companyId: record.companyId || null,
      companyCode: record.companyCode,
      transactionType: TRANSACTION_TYPES.TICKET_COMMISSION_CREDIT,
      referenceType: 'COMMISSION',
      referenceId: booking.bookingId,
      description: `Level ${record.level} commission re-credited · PNR ${record.pnr} · cash received again`,
      idempotencyKey: `CASH_RECREDIT_${record._id}_${cycle}`
    });
    try {
      await taxService.recordTcsEntry({ commissionRecord: record, grossCommission: record.grossCommission, tcsDeducted: record.tcsDeducted, agent: null, companyCode: record.companyCode });
    } catch (taxErr) { console.error('[Cash re-credit TCS]', taxErr.message); }
  }
  return n;
}

/**
 * Undo a "cash received" that was marked by mistake: RECEIVED → PENDING again.
 *  - Not allowed once a passenger has boarded, or once the ticket is in a company settlement statement.
 *  - The agent commission released on receipt is taken back (re-credited if it is received again).
 *  - The ticket can't board until the cash is marked received again.
 */
async function revertReceived({ bookingId, companyCode, actorId, reason }) {
  const fail = (msg, code = 400) => { const e = new Error(msg); e.statusCode = code; throw e; };
  const why = String(reason || '').trim();
  if (why.length < 3) fail('Enter a reason for the revert.');
  const id = String(bookingId || '');
  const filter = /^[a-f0-9]{24}$/i.test(id) ? { _id: id } : { $or: [{ bookingId: id }, { pnr: id.toUpperCase() }] };

  const current = await Booking.findOne({ ...filter, companyCode }).select('pnr bookingId status paymentProvider cashCollection passengers.journeyStatus tripId bookedByAgentId');
  if (!current) fail('Ticket not found under your company.', 404);
  if (current.paymentProvider !== 'agent_cash') fail('This is not a cash ticket.');
  if (current.cashCollection?.status !== 'RECEIVED') fail('This ticket is not marked as received.', 409);
  if (current.status !== 'CONFIRMED') fail(`Ticket is ${String(current.status).toLowerCase()}, so it can't be reverted.`, 409);
  if ((current.passengers || []).some((p) => ['BOARDED', 'DROPPED'].includes(p.journeyStatus))) {
    fail('A passenger on this ticket has already boarded, so the cash receipt cannot be reverted.', 409);
  }
  const inStatement = await CompanySettlement.findOne({ companyCode, status: { $in: ['ISSUED', 'SETTLED'] }, 'lines.bookingId': current._id }).select('statementNo').lean();
  if (inStatement) fail(`This ticket is already in settlement statement ${inStatement.statementNo}. Void that statement first.`, 409);

  const actor = actorId ? await User.findById(actorId).select('name').lean() : null;
  const oldReceipt = current.cashCollection.receiptNo;
  const booking = await Booking.findOneAndUpdate(
    { _id: current._id, status: 'CONFIRMED', 'cashCollection.status': 'RECEIVED', 'cashCollection.receiptNo': oldReceipt },
    {
      $set: {
        'cashCollection.status': 'PENDING',
        'cashCollection.receivedAt': null,
        'cashCollection.receivedBy': null,
        'cashCollection.receiptNo': null,
        paymentStatus: PAYMENT_STATUS.CASH_PENDING
      },
      $inc: { 'cashCollection.revertCount': 1 },
      $push: { 'cashCollection.history': { action: 'REVERTED', receiptNo: oldReceipt, amount: current.cashCollection.amountDue, at: new Date(), by: actorId, byName: actor?.name || '', reason: why.slice(0, 300) } }
    },
    { new: true }
  );
  if (!booking) fail('The ticket changed meanwhile. Refresh and try again.', 409);

  // Take back the commission that was released when the cash was marked received.
  const cycle = booking.cashCollection.revertCount;
  let commissionTaken = 0;
  const rows = await CommissionRecord.find({ bookingId: booking._id, status: 'CREDITED' });
  for (const candidate of rows) {
    const record = await CommissionRecord.findOneAndUpdate(
      { _id: candidate._id, status: 'CREDITED' },
      { $set: { status: 'REVERSED', reversalReason: 'CASH_REVERTED' } },
      { new: true }
    );
    if (!record) continue;
    try {
      const res = await walletLedger.debit({
        userId: record.agentId,
        amount: record.netCommission,
        companyCode: record.companyCode,
        transactionType: TRANSACTION_TYPES.COMMISSION_REVERSAL,
        referenceType: 'COMMISSION',
        referenceId: record.pnr,
        description: `Level ${record.level} commission held back · PNR ${record.pnr} · cash receipt ${oldReceipt} reverted`,
        idempotencyKey: `CASH_REVERT_${record._id}_${cycle}`,
        allowPartial: true
      });
      commissionTaken += Number(res?.amount || 0);
    } catch (e) { console.error('[Cash revert commission]', record.pnr, e.message); }
    try { await taxService.reverseTcsEntry(record); } catch (e) { console.error('[Cash revert TCS]', e.message); }
  }

  try {
    websocketService.broadcast(`agent:${booking.bookedByAgentId}`, 'CASH_REVERTED', { pnr: booking.pnr, amount: booking.cashCollection.amountDue, receiptNo: oldReceipt });
    websocketService.broadcast(`trip:${booking.tripId}`, 'PASSENGER_PAYMENT_PENDING', { tripId: String(booking.tripId), pnr: booking.pnr });
  } catch (e) { /* realtime best-effort */ }

  return { pnr: booking.pnr, bookingId: booking.bookingId, amount: booking.cashCollection.amountDue, receiptNo: oldReceipt, commissionTaken };
}

/** Cash position of one agent (for the agent's own ledger page). */
async function agentSummary(agentId) {
  const rows = await Booking.find({ bookedByAgentId: agentId, paymentProvider: 'agent_cash' })
    .select('pnr bookingId status cashCollection fareBreakdown seatNumbers tripId createdAt')
    .populate('tripId', 'departureTime routeId')
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();

  const now = Date.now();
  let pending = 0;
  let received = 0;
  let overdue = 0;
  const tickets = rows.map((b) => {
    const dep = b.tripId?.departureTime ? new Date(b.tripId.departureTime).getTime() : null;
    const isPending = b.status === 'CONFIRMED' && b.cashCollection?.status === 'PENDING';
    const isOverdue = isPending && dep && dep - now < 3 * 3600000;
    if (isPending) pending += b.cashCollection.amountDue || 0;
    if (b.cashCollection?.status === 'RECEIVED') received += b.cashCollection.amountDue || 0;
    if (isOverdue) overdue += b.cashCollection.amountDue || 0;
    return {
      pnr: b.pnr,
      bookingId: b.bookingId,
      status: b.status,
      cashStatus: b.status === 'CANCELLED' && b.cashCollection?.status === 'PENDING' ? 'CANCELLED' : b.cashCollection?.status,
      amountDue: b.cashCollection?.amountDue || 0,
      agentCharge: b.fareBreakdown?.agentServiceCharge || 0,
      receiptNo: b.cashCollection?.receiptNo || null,
      receivedAt: b.cashCollection?.receivedAt || null,
      departureTime: b.tripId?.departureTime || null,
      seats: b.seatNumbers,
      overdue: Boolean(isOverdue),
      createdAt: b.createdAt
    };
  });

  return {
    totals: {
      collectedFromCustomers: received + pending,
      handedOver: received,
      pendingHandover: pending,
      overdue
    },
    tickets
  };
}

module.exports = { markReceived, revertReceived, agentSummary, receiptNumber };
