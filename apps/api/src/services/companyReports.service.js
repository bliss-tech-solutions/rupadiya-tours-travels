const mongoose = require('mongoose');
const Booking = require('../modules/bookings/booking.model');
const Trip = require('../modules/trips/trip.model');
const Company = require('../modules/companies/company.model');

const RANGES = { '1m': 1, '3m': 3, '6m': 6, '12m': 12 };

function rangeWindow(range) {
  const months = RANGES[range] || 1;
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth() - months, to.getDate());
  return { from, to, months, range: RANGES[range] ? range : '1m' };
}

const channelExpr = {
  $ifNull: ['$fareBreakdown.paymentChannel', {
    $switch: {
      branches: [
        { case: { $eq: ['$paymentProvider', 'agent_cash'] }, then: 'CASH' },
        { case: { $in: ['$paymentProvider', ['agent_wallet', 'AGENT_WALLET']] }, then: 'WALLET' }
      ],
      default: 'ONLINE'
    }
  }]
};

/**
 * Company performance report for 1, 3, 6 or 12 months.
 * Only this company's data; no passenger personal details.
 */
async function companyReport(companyCode, range) {
  const { from, to, range: r } = rangeWindow(range);
  const code = Number(companyCode);
  const base = { companyCode: code, createdAt: { $gte: from, $lt: to } };

  const [totals] = await Booking.aggregate([
    { $match: { ...base, status: { $in: ['CONFIRMED', 'COMPLETED'] } } },
    {
      $group: {
        _id: null,
        tickets: { $sum: 1 },
        seats: { $sum: { $size: '$seatNumbers' } },
        ticketFare: { $sum: '$fareBreakdown.subtotal' },
        gst: { $sum: '$fareBreakdown.gstAmount' },
        platformFee: { $sum: { $ifNull: ['$fareBreakdown.platformFee', 0] } },
        insurance: { $sum: { $ifNull: ['$fareBreakdown.insuranceAmount', 0] } },
        collected: { $sum: '$fareBreakdown.totalPayable' }
      }
    }
  ]);

  const [cancellations] = await Booking.aggregate([
    { $match: { ...base, status: 'CANCELLED' } },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        refunds: { $sum: { $ifNull: ['$cancellationDetails.refundAmount', 0] } },
        fees: { $sum: { $ifNull: ['$cancellationDetails.cancellationFee', 0] } }
      }
    }
  ]);

  const byChannel = await Booking.aggregate([
    { $match: { ...base, status: { $in: ['CONFIRMED', 'COMPLETED'] } } },
    { $group: { _id: channelExpr, tickets: { $sum: 1 }, ticketFare: { $sum: '$fareBreakdown.subtotal' } } }
  ]);

  const byMonth = await Booking.aggregate([
    { $match: { ...base, status: { $in: ['CONFIRMED', 'COMPLETED'] } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: 'Asia/Kolkata' } },
        tickets: { $sum: 1 },
        seats: { $sum: { $size: '$seatNumbers' } },
        ticketFare: { $sum: '$fareBreakdown.subtotal' }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const byRoute = await Booking.aggregate([
    { $match: { ...base, status: { $in: ['CONFIRMED', 'COMPLETED'] } } },
    { $group: { _id: '$routeId', tickets: { $sum: 1 }, seats: { $sum: { $size: '$seatNumbers' } }, ticketFare: { $sum: '$fareBreakdown.subtotal' } } },
    { $lookup: { from: 'routes', localField: '_id', foreignField: '_id', as: 'route' } },
    { $project: { tickets: 1, seats: 1, ticketFare: 1, route: { $concat: [{ $ifNull: [{ $arrayElemAt: ['$route.fromCity.name', 0] }, '?'] }, ' → ', { $ifNull: [{ $arrayElemAt: ['$route.toCity.name', 0] }, '?'] }] } } },
    { $sort: { ticketFare: -1 } },
    { $limit: 20 }
  ]);

  const byAgent = await Booking.aggregate([
    { $match: { ...base, status: { $in: ['CONFIRMED', 'COMPLETED'] }, bookedByAgentId: { $ne: null } } },
    { $group: { _id: '$bookedByAgentId', tickets: { $sum: 1 }, seats: { $sum: { $size: '$seatNumbers' } }, ticketFare: { $sum: '$fareBreakdown.subtotal' } } },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'agent' } },
    { $project: { tickets: 1, seats: 1, ticketFare: 1, agentName: { $arrayElemAt: ['$agent.name', 0] }, agentCode: { $arrayElemAt: ['$agent.referralCode', 0] } } },
    { $sort: { ticketFare: -1 } },
    { $limit: 20 }
  ]);

  // Occupancy of trips that departed in the window.
  const trips = await Trip.find({ companyCode: code, departureTime: { $gte: from, $lt: to } }).select('seats.status').lean();
  const capacity = trips.reduce((s, t) => s + (t.seats || []).length, 0);
  const booked = trips.reduce((s, t) => s + (t.seats || []).filter((x) => x.status === 'BOOKED').length, 0);

  return {
    range: r,
    period: { from, to },
    totals: {
      tickets: totals?.tickets || 0,
      seats: totals?.seats || 0,
      ticketFare: totals?.ticketFare || 0,
      gst: totals?.gst || 0,
      platformFee: totals?.platformFee || 0,
      insurance: totals?.insurance || 0,
      collected: totals?.collected || 0,
      cancellations: cancellations?.count || 0,
      refunds: cancellations?.refunds || 0,
      cancellationFees: cancellations?.fees || 0
    },
    occupancy: { trips: trips.length, capacity, booked, rate: capacity ? Math.round((booked / capacity) * 1000) / 10 : 0 },
    byChannel: ['ONLINE', 'WALLET', 'CASH'].map((c) => {
      const row = byChannel.find((x) => x._id === c);
      return { channel: c, tickets: row?.tickets || 0, ticketFare: row?.ticketFare || 0 };
    }),
    byMonth: byMonth.map((m) => ({ month: m._id, tickets: m.tickets, seats: m.seats, ticketFare: m.ticketFare })),
    byRoute: byRoute.map((x) => ({ route: x.route, tickets: x.tickets, seats: x.seats, ticketFare: x.ticketFare })),
    byAgent: byAgent.map((x) => ({ agentName: x.agentName || 'Agent', agentCode: x.agentCode || '', tickets: x.tickets, seats: x.seats, ticketFare: x.ticketFare }))
  };
}

function reportToCsv(report, companyName) {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [
    ['Company', companyName],
    ['Period', `${report.period.from.toISOString().slice(0, 10)} to ${report.period.to.toISOString().slice(0, 10)}`],
    [],
    ['Totals'],
    ['Tickets', report.totals.tickets], ['Seats', report.totals.seats], ['Ticket fare', report.totals.ticketFare],
    ['GST', report.totals.gst], ['Platform fee', report.totals.platformFee], ['Insurance', report.totals.insurance],
    ['Cancellations', report.totals.cancellations], ['Refunds', report.totals.refunds], ['Cancellation fees', report.totals.cancellationFees],
    ['Occupancy %', report.occupancy.rate],
    [],
    ['By payment', 'Tickets', 'Ticket fare'], ...report.byChannel.map((c) => [c.channel, c.tickets, c.ticketFare]),
    [],
    ['Month', 'Tickets', 'Seats', 'Ticket fare'], ...report.byMonth.map((m) => [m.month, m.tickets, m.seats, m.ticketFare]),
    [],
    ['Route', 'Tickets', 'Seats', 'Ticket fare'], ...report.byRoute.map((x) => [x.route, x.tickets, x.seats, x.ticketFare]),
    [],
    ['Agent', 'Code', 'Tickets', 'Seats', 'Ticket fare'], ...report.byAgent.map((x) => [x.agentName, x.agentCode, x.tickets, x.seats, x.ticketFare])
  ];
  return rows.map((r) => r.map(cell).join(',')).join('\r\n');
}

/**
 * Booking counts for all companies (no personal data), so companies can compare activity.
 */
async function networkStats(range) {
  const { from, to, range: r } = rangeWindow(range);
  const [companies, counts] = await Promise.all([
    Company.find({}).select('companyCode name status').sort({ companyCode: 1 }).lean(),
    Booking.aggregate([
      { $match: { createdAt: { $gte: from, $lt: to }, status: { $in: ['CONFIRMED', 'COMPLETED'] } } },
      { $group: { _id: '$companyCode', tickets: { $sum: 1 }, seats: { $sum: { $size: '$seatNumbers' } } } }
    ])
  ]);
  const map = new Map(counts.map((c) => [c._id, c]));
  const rows = companies.map((c) => ({
    companyCode: c.companyCode,
    companyName: c.name,
    status: c.status,
    tickets: map.get(c.companyCode)?.tickets || 0,
    seats: map.get(c.companyCode)?.seats || 0
  }));
  const ranked = [...rows].sort((a, b) => b.seats - a.seats);
  ranked.forEach((row, i) => { row.rank = i + 1; });
  return { range: r, period: { from, to }, companies: ranked, totalSeats: rows.reduce((s, x) => s + x.seats, 0) };
}

// ---------------------------------------------------------------------------
// Flexible booking history (custom date range or a single month), for the
// company portal "Booking History" page and its Excel export.
// ---------------------------------------------------------------------------
const IST_OFFSET_MS = 330 * 60000;
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const istDay = (y, m, d) => new Date(Date.UTC(y, m, d) - IST_OFFSET_MS);
const ymd = (d) => new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

/**
 * Resolve a reporting window (IST) from query params:
 *   { month: 'YYYY-MM' }  → that whole month
 *   { from, to }          → inclusive date range (YYYY-MM-DD)
 *   nothing               → the current month
 */
function parseWindow({ month, from, to } = {}) {
  const mm = /^(\d{4})-(\d{2})$/.exec(String(month || ''));
  if (mm) {
    const y = +mm[1];
    const m = +mm[2] - 1;
    return { from: istDay(y, m, 1), to: istDay(y, m + 1, 1), label: `${MONTH_NAMES[m]} ${y}`, grain: 'day', kind: 'month' };
  }
  const fm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(from || ''));
  const tm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(to || ''));
  if (fm && tm) {
    const f = istDay(+fm[1], +fm[2] - 1, +fm[3]);
    const t = istDay(+tm[1], +tm[2] - 1, +tm[3] + 1); // inclusive end day
    const spanDays = Math.round((t - f) / 86400000);
    return { from: f, to: t, label: `${from} to ${to}`, grain: spanDays > 70 ? 'month' : 'day', kind: 'range' };
  }
  const now = new Date();
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth();
  return { from: istDay(y, m, 1), to: istDay(y, m + 1, 1), label: `${MONTH_NAMES[m]} ${y}`, grain: 'day', kind: 'month' };
}

const CONFIRMED = { $in: ['CONFIRMED', 'COMPLETED'] };

/**
 * One company's booking history for a window: overall counts, a per-agent breakdown
 * (plus a "Website / direct" row), and a daily or monthly time series.
 * `agentId` narrows everything to a single agent.
 */
async function ownHistory(companyCode, params = {}) {
  const code = Number(companyCode);
  const win = parseWindow(params);
  const agentId = params.agentId && mongoose.isValidObjectId(params.agentId) ? new mongoose.Types.ObjectId(params.agentId) : null;

  const match = { companyCode: code, createdAt: { $gte: win.from, $lt: win.to } };
  const confirmedMatch = { ...match, status: CONFIRMED };
  if (agentId) { confirmedMatch.bookedByAgentId = agentId; match.bookedByAgentId = agentId; }

  const [totalsRow] = await Booking.aggregate([
    { $match: confirmedMatch },
    { $group: { _id: null, tickets: { $sum: 1 }, seats: { $sum: { $size: '$seatNumbers' } }, ticketFare: { $sum: '$fareBreakdown.subtotal' }, collected: { $sum: '$fareBreakdown.totalPayable' } } }
  ]);
  const [cancelRow] = await Booking.aggregate([
    { $match: { ...match, status: 'CANCELLED' } },
    { $group: { _id: null, count: { $sum: 1 }, seats: { $sum: { $size: '$seatNumbers' } } } }
  ]);

  const byAgentRaw = await Booking.aggregate([
    { $match: confirmedMatch },
    { $group: { _id: '$bookedByAgentId', tickets: { $sum: 1 }, seats: { $sum: { $size: '$seatNumbers' } }, ticketFare: { $sum: '$fareBreakdown.subtotal' } } },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'agent' } },
    { $project: { tickets: 1, seats: 1, ticketFare: 1, agentName: { $arrayElemAt: ['$agent.name', 0] }, agentCode: { $arrayElemAt: ['$agent.referralCode', 0] } } },
    { $sort: { seats: -1 } }
  ]);
  const byAgent = byAgentRaw.map((x) => ({
    agentId: x._id ? String(x._id) : null,
    agentName: x._id ? (x.agentName || 'Agent') : 'Website / direct',
    agentCode: x.agentCode || '',
    tickets: x.tickets,
    seats: x.seats,
    ticketFare: x.ticketFare
  }));

  const fmt = win.grain === 'month' ? '%Y-%m' : '%Y-%m-%d';
  const seriesRaw = await Booking.aggregate([
    { $match: confirmedMatch },
    { $group: { _id: { $dateToString: { format: fmt, date: '$createdAt', timezone: 'Asia/Kolkata' } }, tickets: { $sum: 1 }, seats: { $sum: { $size: '$seatNumbers' } }, ticketFare: { $sum: '$fareBreakdown.subtotal' } } },
    { $sort: { _id: 1 } }
  ]);

  // Agents of this company, for the filter dropdown.
  const User = require('../modules/users/user.model');
  const agents = await User.find({ companyCode: code, role: 'AGENT' }).select('name referralCode').sort({ name: 1 }).lean();

  return {
    window: { from: ymd(win.from), to: ymd(new Date(win.to.getTime() - 1)), label: win.label, grain: win.grain, kind: win.kind, month: params.month || null },
    filter: { agentId: agentId ? String(agentId) : null },
    totals: {
      tickets: totalsRow?.tickets || 0,
      seats: totalsRow?.seats || 0,
      ticketFare: totalsRow?.ticketFare || 0,
      collected: totalsRow?.collected || 0,
      cancellations: cancelRow?.count || 0,
      cancelledSeats: cancelRow?.seats || 0
    },
    byAgent,
    series: seriesRaw.map((x) => ({ date: x._id, tickets: x.tickets, seats: x.seats, ticketFare: x.ticketFare })),
    agents: agents.map((a) => ({ id: String(a._id), name: a.name, code: a.referralCode || '' }))
  };
}

/** All companies' booking counts for a window, ranked — the network history list. */
async function networkHistory(params = {}) {
  const win = parseWindow(params);
  const [companies, counts] = await Promise.all([
    Company.find({}).select('companyCode name status').sort({ companyCode: 1 }).lean(),
    Booking.aggregate([
      { $match: { createdAt: { $gte: win.from, $lt: win.to }, status: CONFIRMED } },
      { $group: { _id: '$companyCode', tickets: { $sum: 1 }, seats: { $sum: { $size: '$seatNumbers' } }, ticketFare: { $sum: '$fareBreakdown.subtotal' } } }
    ])
  ]);
  const map = new Map(counts.map((c) => [c._id, c]));
  const rows = companies.map((c) => ({
    companyCode: c.companyCode,
    companyName: c.name,
    status: c.status,
    tickets: map.get(c.companyCode)?.tickets || 0,
    seats: map.get(c.companyCode)?.seats || 0,
    ticketFare: map.get(c.companyCode)?.ticketFare || 0
  }));
  const ranked = [...rows].sort((a, b) => b.seats - a.seats || b.tickets - a.tickets);
  ranked.forEach((row, i) => { row.rank = i + 1; });
  return {
    window: { from: ymd(win.from), to: ymd(new Date(win.to.getTime() - 1)), label: win.label, kind: win.kind, month: params.month || null },
    companies: ranked,
    totals: {
      companies: ranked.length,
      active: ranked.filter((r) => r.seats > 0).length,
      tickets: rows.reduce((s, x) => s + x.tickets, 0),
      seats: rows.reduce((s, x) => s + x.seats, 0),
      ticketFare: rows.reduce((s, x) => s + x.ticketFare, 0)
    }
  };
}

const safeFile = (s) => String(s).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Excel workbook for a company's own history. */
function ownHistoryXlsx(history, companyName) {
  const { buildXlsx } = require('../utils/xlsx');
  const t = history.totals;
  const summary = [
    ['Rupadiya Bus Samiti — Booking History'], [],
    ['Company', companyName],
    ['Period', history.window.label],
    ['Agent filter', history.filter.agentId ? (history.byAgent[0]?.agentName || 'Selected agent') : 'All agents (overall)'],
    [],
    ['Tickets', t.tickets], ['Seats', t.seats], ['Ticket fare (₹)', t.ticketFare], ['Collected (₹)', t.collected],
    ['Cancellations', t.cancellations], ['Cancelled seats', t.cancelledSeats]
  ];
  const byAgent = [['Agent', 'Code', 'Tickets', 'Seats', 'Ticket fare (₹)'], ...history.byAgent.map((a) => [a.agentName, a.agentCode, a.tickets, a.seats, a.ticketFare])];
  const grainLabel = history.window.grain === 'month' ? 'Month' : 'Date';
  const series = [[grainLabel, 'Tickets', 'Seats', 'Ticket fare (₹)'], ...history.series.map((s) => [s.date, s.tickets, s.seats, s.ticketFare])];
  return {
    buffer: buildXlsx([
      { name: 'Summary', rows: summary, headerRows: 1 },
      { name: 'By Agent', rows: byAgent, headerRows: 1 },
      { name: history.window.grain === 'month' ? 'By Month' : 'By Day', rows: series, headerRows: 1 }
    ]),
    filename: `booking-history-${safeFile(companyName)}-${safeFile(history.window.label)}.xlsx`
  };
}

/** Excel workbook for the all-companies network history. */
function networkHistoryXlsx(history) {
  const { buildXlsx } = require('../utils/xlsx');
  const rows = [
    ['Rank', 'Company', 'Code', 'Status', 'Tickets', 'Seats', 'Ticket fare (₹)'],
    ...history.companies.map((c) => [c.rank, c.companyName, c.companyCode, c.status, c.tickets, c.seats, c.ticketFare]),
    [],
    ['TOTAL', '', '', '', history.totals.tickets, history.totals.seats, history.totals.ticketFare]
  ];
  const info = [
    ['Rupadiya Bus Samiti — All Companies Booking History'], [],
    ['Period', history.window.label],
    ['Companies', history.totals.companies],
    ['Active (with seats sold)', history.totals.active],
    ['Total tickets', history.totals.tickets],
    ['Total seats', history.totals.seats]
  ];
  return {
    buffer: buildXlsx([
      { name: 'All Companies', rows, headerRows: 1 },
      { name: 'Summary', rows: info, headerRows: 1 }
    ]),
    filename: `network-booking-history-${safeFile(history.window.label)}.xlsx`
  };
}

module.exports = { companyReport, reportToCsv, networkStats, rangeWindow, parseWindow, ownHistory, networkHistory, ownHistoryXlsx, networkHistoryXlsx };
