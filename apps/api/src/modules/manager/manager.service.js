const mongoose = require('mongoose');
const Trip = require('../trips/trip.model');
const Booking = require('../bookings/booking.model');
const User = require('../users/user.model');
const Company = require('../companies/company.model');
const ManagerAction = require('./managerAction.model');
const ticketQr = require('../../services/ticketQr.service');
const websocketService = require('../../services/websocket.service');
const notificationService = require('../notifications/notification.service');

/**
 * Bus manager: travels with the bus, verifies and boards passengers, drops them, and
 * starts / completes the journey. Only trips assigned to the manager are accessible.
 * Passengers on an agent cash ticket cannot board until the company office received the cash.
 *
 * The manager can also change where a passenger boards (late passenger → next stop) or gets off.
 * The original booked points stay on the ticket; the change is kept in booking.journeyPlan / journeyLog
 * and the passenger, the company and RBS get a WhatsApp message.
 */

function httpError(message, statusCode = 400, code) {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (code) err.code = code;
  return err;
}

const ACTIVE_BOOKING = ['CONFIRMED', 'COMPLETED'];
const IST_OFFSET_MS = 330 * 60000;

/** "2026-11-25" (India time) → [start, end) as Date. */
function istDayRange(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ''));
  if (!m) return null;
  const start = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]) - IST_OFFSET_MS);
  return [start, new Date(start.getTime() + 24 * 3600000)];
}

function istDateKey(d) {
  return new Date(new Date(d).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

const TRIP_SELECT = 'routeId busId companyCode departureTime arrivalTime status managerId managerTimeline journey seats.seatNumber seats.status seats.row seats.column seats.deck';
const BUS_SELECT = 'busNumber name busType category isAc totalSeats layoutType amenities driverDetails managerContact operatorName';

async function loadAssignedTrip(tripId, manager) {
  if (!mongoose.isValidObjectId(tripId)) throw httpError('Trip not found.', 404);
  const trip = await Trip.findById(tripId)
    .select(TRIP_SELECT)
    .populate('routeId', 'fromCity toCity boardingPoints droppingPoints distanceKm estimatedDurationHours')
    .populate('busId', BUS_SELECT);
  if (!trip) throw httpError('Trip not found.', 404);
  if (!trip.managerId || String(trip.managerId) !== String(manager._id)) {
    throw httpError('This trip is not assigned to you.', 403, 'TRIP_NOT_ASSIGNED');
  }
  return trip;
}

/** Route stops with their clock time for this trip (departure + offset). */
function tripPoints(trip) {
  const dep = new Date(trip.departureTime).getTime();
  const map = (list = []) => [...list]
    .sort((a, b) => (a.timeOffsetMinutes || 0) - (b.timeOffsetMinutes || 0))
    .map((p) => ({ id: p.id, name: p.name, landmark: p.landmark || '', time: new Date(dep + (p.timeOffsetMinutes || 0) * 60000) }));
  return { boardingPoints: map(trip.routeId?.boardingPoints), droppingPoints: map(trip.routeId?.droppingPoints) };
}

function findPoint(points, { id, name }) {
  if (id) return points.find((p) => p.id === String(id)) || null;
  if (name) return points.find((p) => p.name.toLowerCase() === String(name).trim().toLowerCase()) || null;
  return null;
}

const effectiveBoarding = (b) => b.journeyPlan?.boardingPoint || b.boardingPoint || null;
const effectiveDropping = (b) => b.journeyPlan?.droppingPoint || b.droppingPoint || null;

function paymentInfo(b) {
  const isCash = b.paymentProvider === 'agent_cash';
  const pending = isCash && b.cashCollection?.status === 'PENDING';
  return {
    payment: isCash ? (pending ? 'CASH_PENDING' : 'CASH_RECEIVED') : 'PAID',
    paymentStatus: pending ? 'PENDING' : 'COMPLETE',
    paymentMode: isCash ? 'CASH' : (b.paymentProvider === 'wallet' || b.paymentProvider === 'agent_wallet' ? 'WALLET' : 'ONLINE'),
    amountDue: pending ? Number(b.cashCollection?.amountDue || 0) : 0,
    totalFare: Number(b.fareBreakdown?.customerTotal || b.fareBreakdown?.totalPayable || 0)
  };
}

function agentInfo(b) {
  const a = b.bookedByAgentId;
  if (!a) return null;
  return { name: a.name, phone: a.phone, agency: a.agencyName || '', code: a.referralCode || '' };
}

function counts(bookings) {
  const c = { total: 0, boarded: 0, noShow: 0, dropped: 0, notBoarded: 0, cashPending: 0, infants: 0, agentTickets: 0, onlineTickets: 0 };
  for (const b of bookings) {
    const cashPending = b.cashCollection?.status === 'PENDING';
    if (b.bookedByAgentId) c.agentTickets += 1; else c.onlineTickets += 1;
    for (const p of b.passengers || []) {
      c.total += 1;
      c.infants += p.infants?.length || 0;
      if (cashPending) c.cashPending += 1;
      const s = p.journeyStatus || 'NOT_BOARDED';
      if (s === 'BOARDED') c.boarded += 1;
      else if (s === 'DROPPED') { c.dropped += 1; c.boarded += 1; }
      else if (s === 'NO_SHOW') c.noShow += 1;
      else c.notBoarded += 1;
    }
  }
  return c;
}

async function tripCounts(tripId) {
  const bookings = await Booking.find({ tripId, status: { $in: ACTIVE_BOOKING } }).select('passengers cashCollection bookedByAgentId').lean();
  return counts(bookings);
}

async function broadcastProgress(trip) {
  try {
    const c = await tripCounts(trip._id);
    const payload = { tripId: String(trip._id), status: trip.status, counts: c, at: new Date() };
    websocketService.broadcast(`trip:${trip._id}`, 'TRIP_JOURNEY_UPDATE', payload);
    websocketService.broadcast(`company:${trip.companyCode}`, 'TRIP_JOURNEY_UPDATE', payload);
    websocketService.broadcast('admin:all', 'TRIP_JOURNEY_UPDATE', payload);
  } catch (e) { /* realtime best-effort */ }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STALE_CLAIM_MS = 2 * 60000;

/**
 * Runs an action once per clientActionId (double taps, retries and offline replays return the stored result).
 * The id is claimed atomically (unique index) before the work starts, so two identical requests arriving
 * at the same moment cannot both run: the second waits for the first one's result.
 */
async function once(manager, trip, action, clientActionId, fn, attempt = 0) {
  if (!clientActionId) return fn();
  const id = String(clientActionId);
  try {
    await ManagerAction.create({ clientActionId: id, managerId: manager._id, tripId: trip._id, action, status: 'RUNNING' });
  } catch (e) {
    if (e.code !== 11000) throw e;
    for (let i = 0; i < 60; i += 1) {
      const prior = await ManagerAction.findOne({ clientActionId: id }).lean();
      if (!prior) break; // the first attempt failed and released the id → run it now
      if (prior.status !== 'RUNNING') return { ...(prior.result || {}), replayed: true };
      if (Date.now() - new Date(prior.createdAt).getTime() > STALE_CLAIM_MS) {
        await ManagerAction.deleteOne({ _id: prior._id, status: 'RUNNING' });
        break; // a crashed request left its claim behind
      }
      await sleep(100);
    }
    if (attempt >= 2) throw httpError('This action is still being processed. Refresh in a moment.', 409, 'ACTION_IN_PROGRESS');
    return once(manager, trip, action, clientActionId, fn, attempt + 1);
  }
  try {
    const result = await fn();
    await ManagerAction.updateOne({ clientActionId: id }, { $set: { status: 'DONE', result } });
    return result;
  } catch (err) {
    // Let the manager retry the same action after fixing the problem (e.g. cash received now).
    await ManagerAction.deleteOne({ clientActionId: id, status: 'RUNNING' }).catch(() => {});
    throw err;
  }
}

async function findTicket(trip, { qrToken, pnr }) {
  if (qrToken) {
    const parsed = ticketQr.verify(qrToken);
    if (!parsed) throw httpError('This QR code is not a valid Rupadiya ticket.', 400, 'QR_INVALID');
    if (parsed.tripId !== String(trip._id)) throw httpError('This ticket is for a different bus / trip.', 409, 'WRONG_TRIP');
    const b = await Booking.findOne({ bookingId: parsed.bookingId, tripId: trip._id });
    if (!b) throw httpError('Ticket not found on this trip.', 404);
    return b;
  }
  const code = String(pnr || '').trim().toUpperCase();
  if (!code) throw httpError('Scan the ticket QR or enter the PNR.', 400);
  const b = await Booking.findOne({ pnr: code });
  if (!b) throw httpError(`PNR ${code} not found.`, 404);
  if (String(b.tripId) !== String(trip._id)) throw httpError('This ticket is for a different bus / trip.', 409, 'WRONG_TRIP');
  return b;
}

function pickSeats(booking, seatNumbers) {
  const all = booking.passengers.map((p) => p.seatNumber);
  if (!Array.isArray(seatNumbers) || seatNumbers.length === 0) return all;
  const wanted = new Set(seatNumbers.map((s) => String(s).trim().toLowerCase()));
  const picked = all.filter((s) => wanted.has(s.toLowerCase()));
  if (!picked.length) throw httpError('Those seats are not on this ticket.', 400);
  return picked;
}

async function managerContact(manager) {
  const u = await User.findById(manager._id).select('name phone').lean();
  return { name: u?.name || manager.name || '', phone: u?.phone || manager.phone || '' };
}

/**
 * Store a boarding / dropping change on the booking and message passenger + company + RBS.
 * Returns the new planned point, or null when nothing changed.
 */
async function applyPointChange(manager, trip, booking, type, point, reason, seats) {
  const current = type === 'BOARDING' ? effectiveBoarding(booking) : effectiveDropping(booking);
  if (current?.name && current.name.toLowerCase() === point.name.toLowerCase()) return null;

  const planned = { id: point.id || null, name: point.name, time: point.time ? new Date(point.time).toISOString() : null };
  const field = type === 'BOARDING' ? 'journeyPlan.boardingPoint' : 'journeyPlan.droppingPoint';
  const entry = { type, from: current?.name || '', to: point.name, reason: String(reason || '').trim().slice(0, 200), at: new Date(), by: manager._id };
  await Booking.updateOne({ _id: booking._id }, { $set: { [field]: planned }, $push: { journeyLog: entry } });

  const contact = await managerContact(manager);
  const fresh = await Booking.findById(booking._id).lean();
  notificationService.fire('journeyPointChanged', fresh, {
    type,
    from: entry.from,
    to: entry.to,
    reason: entry.reason,
    seats: (seats && seats.length ? seats : fresh.seatNumbers || []).join(', '),
    managerName: contact.name,
    managerPhone: contact.phone,
    changeId: `${type}:${entry.at.getTime()}`
  });
  return planned;
}

function passengerRows(b) {
  const pay = paymentInfo(b);
  const boarding = effectiveBoarding(b);
  const dropping = effectiveDropping(b);
  const boardingChanged = Boolean(b.journeyPlan?.boardingPoint);
  const droppingChanged = Boolean(b.journeyPlan?.droppingPoint);
  return (b.passengers || []).map((p) => ({
    bookingId: b.bookingId,
    pnr: b.pnr,
    bookingStatus: b.status,
    seatNumber: p.seatNumber,
    name: p.name,
    age: p.age,
    gender: p.gender,
    isChild: Boolean(p.isChild),
    infants: p.infants || [],
    journeyStatus: p.journeyStatus || 'NOT_BOARDED',
    boardedAt: p.boardedAt,
    droppedAt: p.droppedAt,
    boardedAtPoint: p.boardedAtPoint || null,
    droppedAtPoint: p.droppedAtPoint || null,
    phone: b.contactDetails?.phone,
    email: b.contactDetails?.email && !/@guest\.rupadiya\.in$/i.test(b.contactDetails.email) ? b.contactDetails.email : null,
    emergencyContact: b.emergencyContact || null,
    boardingPoint: boarding,
    droppingPoint: dropping,
    bookedBoardingPoint: boardingChanged ? b.boardingPoint : null,
    bookedDroppingPoint: droppingChanged ? b.droppingPoint : null,
    ...pay,
    canBoard: b.status === 'CONFIRMED' && b.cashCollection?.status !== 'PENDING',
    bookedBy: b.bookedByAgentId ? 'AGENT' : 'CUSTOMER',
    agent: agentInfo(b)
  }));
}

function busInfo(bus) {
  if (!bus) return null;
  return {
    _id: bus._id,
    busNumber: bus.busNumber,
    name: bus.name,
    busType: bus.busType,
    category: bus.category,
    isAc: bus.isAc,
    totalSeats: bus.totalSeats,
    layoutType: bus.layoutType,
    amenities: bus.amenities || [],
    operatorName: bus.operatorName,
    driver: bus.driverDetails ? {
      name: bus.driverDetails.name || '',
      phone: bus.driverDetails.phone || '',
      alternatePhone: bus.driverDetails.alternatePhone || '',
      licenseNumber: bus.driverDetails.licenseNumber || ''
    } : null
  };
}

async function companyInfo(companyCode) {
  const c = await Company.findOne({ companyCode }).select('name contactPhone notifyPhone').lean();
  return c ? { name: c.name, code: companyCode, phone: c.notifyPhone || c.contactPhone || '' } : { name: `Company #${companyCode}`, code: companyCode, phone: '' };
}

const BOOKING_FIELDS = 'bookingId pnr status seatNumbers passengers contactDetails emergencyContact boardingPoint droppingPoint journeyPlan journeyLog cashCollection paymentProvider fareBreakdown bookedByAgentId createdAt';

class ManagerService {
  async me(manager) {
    const u = await User.findById(manager._id).select('name email phone companyCode').lean();
    return { manager: { _id: manager._id, name: u?.name, email: u?.email, phone: u?.phone, companyCode: u?.companyCode }, company: await companyInfo(u?.companyCode) };
  }

  /** Trips for a day (date=YYYY-MM-DD, India time) or a scope: today / upcoming / history. */
  async listTrips(manager, scope = 'today', date = null) {
    const now = new Date();
    const filter = { managerId: manager._id };
    const range = istDayRange(date);
    if (range) filter.departureTime = { $gte: range[0], $lt: range[1] };
    else if (scope === 'today') {
      const today = istDayRange(istDateKey(now));
      filter.departureTime = { $gte: new Date(today[0].getTime() - 12 * 3600000), $lt: new Date(today[1].getTime() + 12 * 3600000) };
    } else if (scope === 'upcoming') filter.departureTime = { $gte: now };
    else filter.departureTime = { $lt: now };

    const trips = await Trip.find(filter)
      .select('routeId busId companyCode departureTime arrivalTime status journey seats.status')
      .populate('routeId', 'fromCity toCity boardingPoints')
      .populate('busId', BUS_SELECT)
      .sort({ departureTime: scope === 'history' && !range ? -1 : 1 })
      .limit(50)
      .lean();

    const companies = {};
    return Promise.all(trips.map(async (t) => {
      if (!companies[t.companyCode]) companies[t.companyCode] = await companyInfo(t.companyCode);
      return {
        _id: t._id,
        from: t.routeId?.fromCity?.name,
        to: t.routeId?.toCity?.name,
        departureTime: t.departureTime,
        arrivalTime: t.arrivalTime,
        status: t.status,
        journey: t.journey,
        bus: busInfo(t.busId),
        company: companies[t.companyCode],
        seatsBooked: (t.seats || []).filter((s) => s.status === 'BOOKED').length,
        seatsTotal: (t.seats || []).length,
        boardingPointCount: t.routeId?.boardingPoints?.length || 0,
        counts: await tripCounts(t._id)
      };
    }));
  }

  /** Number of assigned trips per day (India time) for the dashboard date strip. */
  async calendar(manager, from, days = 14) {
    const start = istDayRange(from) || istDayRange(istDateKey(new Date()));
    const n = Math.min(Math.max(parseInt(days, 10) || 14, 1), 62);
    const end = new Date(start[0].getTime() + n * 24 * 3600000);
    const trips = await Trip.find({ managerId: manager._id, departureTime: { $gte: start[0], $lt: end } }).select('departureTime status').lean();
    const byDay = {};
    for (const t of trips) {
      const k = istDateKey(t.departureTime);
      byDay[k] = (byDay[k] || 0) + 1;
    }
    return Object.entries(byDay).map(([date, count]) => ({ date, trips: count })).sort((a, b) => a.date.localeCompare(b.date));
  }

  async manifest(manager, tripId) {
    const trip = await loadAssignedTrip(tripId, manager);
    const bookings = await Booking.find({ tripId: trip._id, status: { $in: [...ACTIVE_BOOKING, 'CANCELLED'] } })
      .select(BOOKING_FIELDS)
      .populate('bookedByAgentId', 'name phone agencyName referralCode')
      .sort({ 'boardingPoint.time': 1 })
      .lean();

    const passengers = bookings.flatMap(passengerRows);
    passengers.sort((a, b) => String(a.seatNumber).localeCompare(String(b.seatNumber), undefined, { numeric: true }));

    return {
      trip: {
        _id: trip._id,
        from: trip.routeId?.fromCity?.name,
        to: trip.routeId?.toCity?.name,
        departureTime: trip.departureTime,
        arrivalTime: trip.arrivalTime,
        status: trip.status,
        journey: trip.journey,
        distanceKm: trip.routeId?.distanceKm || null,
        bus: busInfo(trip.busId),
        company: await companyInfo(trip.companyCode),
        seatsTotal: (trip.seats || []).length,
        seatsBooked: (trip.seats || []).filter((s) => s.status === 'BOOKED').length,
        // Physical layout for the seat map (who sits where is matched from `passengers` in the app).
        layout: (trip.seats || []).some((x) => String(x.deck || '').toUpperCase() === 'UPPER' || /^[LU]\d/i.test(String(x.seatNumber))) ? 'SLEEPER' : 'SEATER',
        seats: (trip.seats || []).map((x) => ({ seatNumber: x.seatNumber, row: x.row, column: x.column, deck: x.deck || 'LOWER', status: x.status })),
        ...tripPoints(trip)
      },
      counts: counts(bookings.filter((b) => ACTIVE_BOOKING.includes(b.status))),
      passengers,
      syncedAt: new Date()
    };
  }

  /**
   * Work history: every trip this manager ran (fully, or part of the route after a handover),
   * grouped by India date, newest first, with passenger counts and journey times.
   */
  async history(manager, { from, to, limit = 200 } = {}) {
    const end = istDayRange(to) ? istDayRange(to)[1] : new Date(Date.now() + 2 * 3600000);
    const start = istDayRange(from) ? istDayRange(from)[0] : new Date(end.getTime() - 60 * 86400000);
    const trips = await Trip.find({
      $or: [{ managerId: manager._id }, { 'managerTimeline.managerId': manager._id }],
      departureTime: { $gte: start, $lt: end },
      $and: [{ $or: [{ departureTime: { $lte: new Date() } }, { status: { $in: ['DEPARTED', 'COMPLETED', 'CANCELLED'] } }] }]
    })
      .select('routeId busId companyCode departureTime arrivalTime status journey managerId managerTimeline seats.status')
      .populate('routeId', 'fromCity toCity')
      .populate('busId', 'busNumber name busType')
      .sort({ departureTime: -1 })
      .limit(Math.min(Number(limit) || 200, 500))
      .lean();

    const me = String(manager._id);
    const rows = await Promise.all(trips.map(async (t) => {
      const c = await tripCounts(t._id);
      const timeline = t.managerTimeline || [];
      const mine = timeline
        .map((e, i) => ({ e, next: timeline[i + 1] }))
        .filter(({ e }) => String(e.managerId) === me)
        .map(({ e, next }) => ({ from: e.handoverPoint || t.routeId?.fromCity?.name || '', until: next ? (next.handoverPoint || '') : (t.routeId?.toCity?.name || ''), at: e.at }));
      const handedOver = Boolean(timeline.length && String(t.managerId) !== me);
      return {
        _id: t._id,
        date: istDateKey(t.departureTime),
        from: t.routeId?.fromCity?.name,
        to: t.routeId?.toCity?.name,
        departureTime: t.departureTime,
        arrivalTime: t.arrivalTime,
        status: t.status,
        startedAt: t.journey?.startedAt || null,
        completedAt: t.journey?.completedAt || null,
        bus: t.busId ? { busNumber: t.busId.busNumber, name: t.busId.name, busType: t.busId.busType } : null,
        seatsTotal: (t.seats || []).length,
        seatsBooked: (t.seats || []).filter((x) => x.status === 'BOOKED').length,
        counts: c,
        mySegments: mine,
        role: handedOver ? 'HANDED_OVER' : mine.length && mine[0].from && mine[0].from !== t.routeId?.fromCity?.name ? 'TOOK_OVER' : 'FULL'
      };
    }));

    const byDate = new Map();
    for (const r of rows) {
      if (!byDate.has(r.date)) byDate.set(r.date, []);
      byDate.get(r.date).push(r);
    }
    const days = [...byDate.entries()].map(([date, list]) => ({
      date,
      trips: list,
      totals: list.reduce((a, r) => ({
        trips: a.trips + 1,
        passengers: a.passengers + (r.counts.total || 0),
        boarded: a.boarded + (r.counts.boarded || 0),
        dropped: a.dropped + (r.counts.dropped || 0),
        noShow: a.noShow + (r.counts.noShow || 0)
      }), { trips: 0, passengers: 0, boarded: 0, dropped: 0, noShow: 0 })
    }));
    const summary = rows.reduce((a, r) => ({
      trips: a.trips + 1,
      completed: a.completed + (r.status === 'COMPLETED' ? 1 : 0),
      passengers: a.passengers + (r.counts.total || 0),
      boarded: a.boarded + (r.counts.boarded || 0),
      dropped: a.dropped + (r.counts.dropped || 0),
      noShow: a.noShow + (r.counts.noShow || 0),
      buses: a.buses.add(r.bus?.busNumber || '')
    }), { trips: 0, completed: 0, passengers: 0, boarded: 0, dropped: 0, noShow: 0, buses: new Set() });

    return {
      range: { from: istDateKey(start), to: istDateKey(new Date(end.getTime() - 1)) },
      summary: { ...summary, buses: [...summary.buses].filter(Boolean).length, days: days.length },
      days
    };
  }

  /** Look up a ticket from a QR scan or PNR without changing anything (verification screen). */
  async verify(manager, tripId, { qrToken, pnr }) {
    const trip = await loadAssignedTrip(tripId, manager);
    const found = await findTicket(trip, { qrToken, pnr });
    const b = await Booking.findById(found._id).select(BOOKING_FIELDS).populate('bookedByAgentId', 'name phone agencyName referralCode').lean();
    const pay = paymentInfo(b);
    return {
      bookingId: b.bookingId,
      pnr: b.pnr,
      status: b.status,
      cashPending: pay.payment === 'CASH_PENDING',
      canBoard: b.status === 'CONFIRMED' && b.cashCollection?.status !== 'PENDING',
      ...pay,
      bookedBy: b.bookedByAgentId ? 'AGENT' : 'CUSTOMER',
      agent: agentInfo(b),
      bookedAt: b.createdAt,
      phone: b.contactDetails?.phone,
      emergencyContact: b.emergencyContact || null,
      passengers: b.passengers.map((p) => ({
        seatNumber: p.seatNumber, name: p.name, age: p.age, gender: p.gender, isChild: Boolean(p.isChild),
        infants: p.infants || [], journeyStatus: p.journeyStatus || 'NOT_BOARDED',
        boardedAt: p.boardedAt, droppedAt: p.droppedAt, boardedAtPoint: p.boardedAtPoint || null, droppedAtPoint: p.droppedAtPoint || null
      })),
      boardingPoint: effectiveBoarding(b),
      droppingPoint: effectiveDropping(b),
      bookedBoardingPoint: b.journeyPlan?.boardingPoint ? b.boardingPoint : null,
      bookedDroppingPoint: b.journeyPlan?.droppingPoint ? b.droppingPoint : null,
      journeyLog: (b.journeyLog || []).map((l) => ({ type: l.type, from: l.from, to: l.to, reason: l.reason, at: l.at })),
      trip: { from: trip.routeId?.fromCity?.name, to: trip.routeId?.toCity?.name, departureTime: trip.departureTime, busNumber: trip.busId?.busNumber }
    };
  }

  /**
   * Change where a ticket boards / gets off, without boarding it now.
   * Typical use: the passenger is late and will board at the next stop.
   */
  async changePoint(manager, tripId, { qrToken, pnr, boardingPointId, boardingPointName, droppingPointId, droppingPointName, reason, clientActionId }) {
    const trip = await loadAssignedTrip(tripId, manager);
    if (['COMPLETED', 'CANCELLED'].includes(trip.status)) throw httpError(`Trip is ${trip.status.toLowerCase()}.`, 409);
    const wantsBoarding = boardingPointId || boardingPointName;
    const wantsDropping = droppingPointId || droppingPointName;
    if (!wantsBoarding && !wantsDropping) throw httpError('Choose the new boarding or dropping point.', 400);

    return once(manager, trip, 'CHANGE_POINT', clientActionId, async () => {
      const booking = await findTicket(trip, { qrToken, pnr });
      if (booking.status !== 'CONFIRMED') throw httpError(`Ticket is ${booking.status.toLowerCase()}.`, 409, 'TICKET_NOT_VALID');
      const points = tripPoints(trip);
      const result = { pnr: booking.pnr, boardingPoint: null, droppingPoint: null };

      if (wantsBoarding) {
        if (!booking.passengers.some((p) => ['NOT_BOARDED', 'NO_SHOW'].includes(p.journeyStatus || 'NOT_BOARDED'))) {
          throw httpError('Everyone on this ticket has already boarded.', 409);
        }
        const point = findPoint(points.boardingPoints, { id: boardingPointId, name: boardingPointName });
        if (!point) throw httpError('That boarding point is not on this route.', 400);
        result.boardingPoint = await applyPointChange(manager, trip, booking, 'BOARDING', point, reason);
        // A no-show passenger who is now expected at a later stop is waiting again.
        await Booking.updateOne({ _id: booking._id }, { $set: { 'passengers.$[p].journeyStatus': 'NOT_BOARDED' } }, { arrayFilters: [{ 'p.journeyStatus': 'NO_SHOW' }] });
      }
      if (wantsDropping) {
        const point = findPoint(points.droppingPoints, { id: droppingPointId, name: droppingPointName })
          || findPoint(points.boardingPoints, { id: droppingPointId, name: droppingPointName });
        if (!point) throw httpError('That dropping point is not on this route.', 400);
        const fresh = await Booking.findById(booking._id);
        result.droppingPoint = await applyPointChange(manager, trip, fresh, 'DROPPING', point, reason);
      }
      broadcastProgress(trip);
      return result;
    });
  }

  async board(manager, tripId, { qrToken, pnr, seatNumbers, boardingPointId, boardingPointName, reason, clientActionId }) {
    const trip = await loadAssignedTrip(tripId, manager);
    if (['COMPLETED', 'CANCELLED'].includes(trip.status)) throw httpError(`Trip is ${trip.status.toLowerCase()}.`, 409);

    return once(manager, trip, 'BOARD', clientActionId, async () => {
      const booking = await findTicket(trip, { qrToken, pnr });
      if (booking.status !== 'CONFIRMED') throw httpError(`Ticket is ${booking.status.toLowerCase()} — cannot board.`, 409, 'TICKET_NOT_VALID');
      if (booking.cashCollection?.status === 'PENDING') {
        throw httpError('Cash for this ticket has not been handed to the company office. Do not board — ask the agent to pay the office.', 409, 'CASH_PENDING');
      }
      const seats = pickSeats(booking, seatNumbers);

      // Boarded at a different stop than booked (late passenger picked up at the next stop, …)
      let boardedAtPoint = effectiveBoarding(booking)?.name || null;
      if (boardingPointId || boardingPointName) {
        const point = findPoint(tripPoints(trip).boardingPoints, { id: boardingPointId, name: boardingPointName });
        if (!point) throw httpError('That boarding point is not on this route.', 400);
        await applyPointChange(manager, trip, booking, 'BOARDING', point, reason || 'Boarded at a different stop', seats);
        boardedAtPoint = point.name;
      }

      const now = new Date();
      const setOps = {};
      const arrayFilters = [];
      seats.forEach((seat, i) => {
        setOps[`passengers.$[p${i}].journeyStatus`] = 'BOARDED';
        setOps[`passengers.$[p${i}].boardedAt`] = now;
        setOps[`passengers.$[p${i}].boardedBy`] = manager._id;
        setOps[`passengers.$[p${i}].boardedAtPoint`] = boardedAtPoint;
        arrayFilters.push({ [`p${i}.seatNumber`]: seat, [`p${i}.journeyStatus`]: { $in: ['NOT_BOARDED', 'NO_SHOW'] } });
      });
      await Booking.updateOne({ _id: booking._id, status: 'CONFIRMED' }, { $set: setOps }, { arrayFilters });

      const fresh = await Booking.findById(booking._id).lean();
      if (trip.status === 'SCHEDULED') await Trip.updateOne({ _id: trip._id, status: 'SCHEDULED' }, { $set: { status: 'BOARDING' } });
      notificationService.fire('passengerBoarded', fresh, fresh.passengers.find((p) => seats.includes(p.seatNumber)));
      broadcastProgress(trip);
      return {
        pnr: fresh.pnr,
        boardedAtPoint,
        boarded: fresh.passengers.filter((p) => seats.includes(p.seatNumber)).map((p) => ({ seatNumber: p.seatNumber, name: p.name, journeyStatus: p.journeyStatus }))
      };
    });
  }

  async noShow(manager, tripId, { qrToken, pnr, seatNumbers, clientActionId }) {
    const trip = await loadAssignedTrip(tripId, manager);
    if (['COMPLETED', 'CANCELLED'].includes(trip.status)) throw httpError(`Trip is ${trip.status.toLowerCase()}.`, 409);
    return once(manager, trip, 'NO_SHOW', clientActionId, async () => {
      const booking = await findTicket(trip, { qrToken, pnr });
      const seats = pickSeats(booking, seatNumbers);
      const setOps = {};
      const arrayFilters = [];
      seats.forEach((seat, i) => {
        setOps[`passengers.$[p${i}].journeyStatus`] = 'NO_SHOW';
        arrayFilters.push({ [`p${i}.seatNumber`]: seat, [`p${i}.journeyStatus`]: 'NOT_BOARDED' });
      });
      await Booking.updateOne({ _id: booking._id }, { $set: setOps }, { arrayFilters });
      broadcastProgress(trip);
      return { pnr: booking.pnr, noShow: seats };
    });
  }

  async drop(manager, tripId, { qrToken, pnr, seatNumbers, droppingPointId, droppingPointName, reason, clientActionId }) {
    const trip = await loadAssignedTrip(tripId, manager);
    return once(manager, trip, 'DROP', clientActionId, async () => {
      const booking = await findTicket(trip, { qrToken, pnr });
      const seats = pickSeats(booking, seatNumbers);

      let droppedAtPoint = effectiveDropping(booking)?.name || null;
      if (droppingPointId || droppingPointName) {
        const points = tripPoints(trip);
        const point = findPoint(points.droppingPoints, { id: droppingPointId, name: droppingPointName })
          || findPoint(points.boardingPoints, { id: droppingPointId, name: droppingPointName });
        if (!point) throw httpError('That dropping point is not on this route.', 400);
        await applyPointChange(manager, trip, booking, 'DROPPING', point, reason || 'Got off at a different stop', seats);
        droppedAtPoint = point.name;
      }

      const now = new Date();
      const setOps = {};
      const arrayFilters = [];
      seats.forEach((seat, i) => {
        setOps[`passengers.$[p${i}].journeyStatus`] = 'DROPPED';
        setOps[`passengers.$[p${i}].droppedAt`] = now;
        setOps[`passengers.$[p${i}].droppedAtPoint`] = droppedAtPoint;
        arrayFilters.push({ [`p${i}.seatNumber`]: seat, [`p${i}.journeyStatus`]: 'BOARDED' });
      });
      await Booking.updateOne({ _id: booking._id }, { $set: setOps }, { arrayFilters });
      const fresh = await Booking.findById(booking._id).lean();
      const droppedNow = fresh.passengers.filter((p) => seats.includes(p.seatNumber) && p.journeyStatus === 'DROPPED');
      if (droppedNow.length) notificationService.fire('passengerDropped', fresh, droppedNow[0]);
      broadcastProgress(trip);
      return { pnr: fresh.pnr, droppedAtPoint, dropped: droppedNow.map((p) => p.seatNumber) };
    });
  }

  async start(manager, tripId, { clientActionId } = {}) {
    const trip = await loadAssignedTrip(tripId, manager);
    return once(manager, trip, 'START', clientActionId, async () => {
      const updated = await Trip.findOneAndUpdate(
        { _id: trip._id, status: { $in: ['SCHEDULED', 'BOARDING'] } },
        { $set: { status: 'DEPARTED', 'journey.startedAt': new Date(), 'journey.startedBy': manager._id } },
        { new: true }
      );
      if (!updated) throw httpError(`Journey cannot start: trip is ${trip.status.toLowerCase()}.`, 409);

      // Passengers booked at the first stop who did not board are no-shows. Passengers boarding at a
      // later stop (booked there, or moved there by the manager) are still expected on the way.
      const firstStop = tripPoints(trip).boardingPoints[0]?.name?.toLowerCase();
      const waiting = await Booking.find({ tripId: trip._id, status: 'CONFIRMED', 'passengers.journeyStatus': 'NOT_BOARDED' })
        .select('boardingPoint journeyPlan').lean();
      const atFirstStop = waiting
        .filter((b) => !firstStop || (effectiveBoarding(b)?.name || '').toLowerCase() === firstStop)
        .map((b) => b._id);
      if (atFirstStop.length) {
        await Booking.updateMany(
          { _id: { $in: atFirstStop } },
          { $set: { 'passengers.$[p].journeyStatus': 'NO_SHOW' } },
          { arrayFilters: [{ 'p.journeyStatus': 'NOT_BOARDED' }] }
        );
      }
      const c = await tripCounts(trip._id);
      const user = await User.findById(manager._id).select('name').lean();
      notificationService.fire('tripSummary', 'TRIP_STARTED', trip, c, user?.name || '');
      broadcastProgress(updated);
      return { status: updated.status, counts: c };
    });
  }

  async complete(manager, tripId, { clientActionId } = {}) {
    const trip = await loadAssignedTrip(tripId, manager);
    return once(manager, trip, 'COMPLETE', clientActionId, async () => {
      const updated = await Trip.findOneAndUpdate(
        { _id: trip._id, status: 'DEPARTED' },
        { $set: { status: 'COMPLETED', 'journey.completedAt': new Date(), 'journey.completedBy': manager._id } },
        { new: true }
      );
      if (!updated) throw httpError('Start the journey before completing it.', 409);

      // Everyone still on board reaches their dropping point; anyone who never boarded is a no-show.
      const onBoard = await Booking.find({ tripId: trip._id, status: 'CONFIRMED', 'passengers.journeyStatus': 'BOARDED' }).lean();
      const now = new Date();
      for (const b of onBoard) {
        await Booking.updateOne(
          { _id: b._id },
          { $set: { 'passengers.$[p].journeyStatus': 'DROPPED', 'passengers.$[p].droppedAt': now, 'passengers.$[p].droppedAtPoint': effectiveDropping(b)?.name || null } },
          { arrayFilters: [{ 'p.journeyStatus': 'BOARDED' }] }
        );
      }
      await Booking.updateMany(
        { tripId: trip._id, status: 'CONFIRMED' },
        { $set: { 'passengers.$[p].journeyStatus': 'NO_SHOW' } },
        { arrayFilters: [{ 'p.journeyStatus': 'NOT_BOARDED' }] }
      );
      await Booking.updateMany({ tripId: trip._id, status: 'CONFIRMED' }, { $set: { status: 'COMPLETED' } });
      onBoard.forEach((b) => notificationService.fire('passengerDropped', b, b.passengers.find((p) => p.journeyStatus === 'BOARDED')));

      const c = await tripCounts(trip._id);
      notificationService.fire('tripSummary', 'TRIP_COMPLETED', trip, c);
      broadcastProgress(updated);
      return { status: updated.status, counts: c };
    });
  }
}

module.exports = new ManagerService();
module.exports.tripCounts = tripCounts;
module.exports.istDayRange = istDayRange;
