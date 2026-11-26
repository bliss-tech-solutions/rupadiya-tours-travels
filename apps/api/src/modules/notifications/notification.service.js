const crypto = require('crypto');
const os = require('os');
const { NotificationJob, MessageTemplate, PlatformSetting, WorkerLease } = require('./models');
const DEFAULT_TEMPLATES = require('./defaultTemplates');
const PREVIOUS_DEFAULTS = [require('./defaultTemplates.v1')];
const { normalisePhone, formatPhone } = require('../../utils/phone');

/**
 * Notifications (WhatsApp via the RBS business number + email).
 *
 * Business code calls one of the event helpers (bookingConfirmed, tripStarted, …). They render the
 * admin-editable template for every audience/channel and put the messages in an outbox
 * (NotificationJob). A single sender (leader lease across API instances) delivers them:
 *   - WhatsApp: throttled ~1 message every 2.5-4.5 s, retried with backoff, never older than 24 h.
 *   - Email: SMTP; skipped when SMTP is not configured.
 * Sending can never block or fail a booking.
 */

const SENDER_LEASE = 'notification-sender';
const LEASE_MS = 45 * 1000;
const LEASE_TICK_MS = 15 * 1000;
const BACKOFF_MIN = [1, 5, 15, 60];
const MAX_ATTEMPTS = 5;
const INSTANCE_ID = `${os.hostname()}:${process.pid}:${crypto.randomBytes(3).toString('hex')}`;

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Fill {{placeholders}}. Unknown placeholders become empty; values are trimmed and length-limited.
 * A line whose placeholders are *all* empty is dropped (e.g. "👶 *Infants:* {{infants}}" when there
 * are none), so messages never show half-empty lines.
 */
function render(template, data = {}, { html = false } = {}) {
  const value = (key) => {
    const v = data[key];
    if (v === undefined || v === null) return '';
    const clean = String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, 500);
    return html ? escapeHtml(clean) : clean;
  };
  const out = [];
  for (const line of String(template || '').split('\n')) {
    const keys = [...line.matchAll(PLACEHOLDER)].map((m) => m[1]);
    if (keys.length && keys.every((k) => value(k) === '')) continue;
    out.push(line.replace(PLACEHOLDER, (_, key) => value(key)));
  }
  // Collapse runs of blank lines left behind by dropped lines.
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function textToHtml(text) {
  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#0f172a">${escapeHtml(text).replace(/\n/g, '<br>')}</div>`;
}

const istDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '');
const istTime = (d) => (d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : '');
const realEmail = (e) => Boolean(e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && !/@guest\.rupadiya\.in$|@rupadiya\.test$|@rupadiya\.com$/i.test(e));
const webUrl = () => (process.env.PUBLIC_WEB_URL || process.env.WEB_ORIGIN || 'http://localhost:3000').split(',')[0].replace(/\/$/, '').replace('*', 'localhost:3000');

class NotificationService {
  constructor() {
    this.whatsapp = null;   // injected lazily (Baileys) or by tests
    this.email = null;
    this.timer = null;
    this.leaseTimer = null;
    this.isLeader = false;
    this.nextWhatsappAt = 0;
    this.busy = false;
  }

  providers() {
    if (!this.whatsapp) this.whatsapp = require('../../providers/whatsapp/BaileysProvider');
    if (!this.email) this.email = require('../../providers/email/EmailProvider');
    return { whatsapp: this.whatsapp, email: this.email };
  }

  setProviders({ whatsapp, email }) {
    if (whatsapp) this.whatsapp = whatsapp;
    if (email) this.email = email;
  }

  // ------------------------------------------------------------------ templates & settings

  /**
   * Insert missing templates and upgrade stored ones that are still an untouched older default.
   * A template an admin has edited never matches an old default, so it is left exactly as it is.
   */
  async ensureTemplates() {
    const norm = (x) => String(x || '').replace(/\r\n/g, '\n').trim();
    for (const t of DEFAULT_TEMPLATES) {
      const key = `${t.event}:${t.audience}:${t.channel}`;
      await MessageTemplate.updateOne(
        { key },
        { $setOnInsert: { key, event: t.event, audience: t.audience, channel: t.channel, subject: t.subject || '', body: t.body, enabled: true } },
        { upsert: true }
      );
      const previous = PREVIOUS_DEFAULTS
        .map((list) => list.find((o) => o.event === t.event && o.audience === t.audience && o.channel === t.channel))
        .filter(Boolean);
      if (!previous.length) continue;
      const stored = await MessageTemplate.findOne({ key }).select('body subject').lean();
      const untouched = stored && previous.some((o) => norm(o.body) === norm(stored.body) && norm(o.subject) === norm(stored.subject));
      if (untouched && norm(stored.body) !== norm(t.body)) {
        await MessageTemplate.updateOne({ key }, { $set: { body: t.body, subject: t.subject || '' } });
      }
    }
  }

  async adminPhones() {
    const s = await PlatformSetting.findOne({ key: 'adminNotifyPhones' }).lean();
    const list = Array.isArray(s?.value) ? s.value : String(process.env.ADMIN_NOTIFY_PHONES || '').split(',');
    return [...new Set(list.map((p) => normalisePhone(p)).filter(Boolean))];
  }

  async companyPhone(companyCode) {
    const Company = require('../companies/company.model');
    const User = require('../users/user.model');
    const company = await Company.findOne({ companyCode }).select('name notifyPhone contactPhone ownerId').lean();
    let phone = company?.notifyPhone || company?.contactPhone || '';
    if (!phone) {
      const owner = company?.ownerId
        ? await User.findById(company.ownerId).select('phone').lean()
        : await User.findOne({ role: 'COMPANY_OWNER', companyCode }).select('phone').lean();
      phone = owner?.phone || '';
    }
    return { phone: normalisePhone(phone) || '', name: company?.name || `Company #${companyCode}` };
  }

  // ------------------------------------------------------------------ enqueue

  /**
   * Render the template for (event, audience, channel) and add it to the outbox.
   * Duplicate dedupeKeys are ignored, so retries of business code never double-message.
   */
  async enqueue({ event, audience, channel, to, data, dedupeKey = null, refType = null, refId = null }) {
    try {
      if (!to) return null;
      const key = `${event}:${audience}:${channel}`;
      let tpl = await MessageTemplate.findOne({ key }).lean();
      if (!tpl) {
        const def = DEFAULT_TEMPLATES.find((t) => `${t.event}:${t.audience}:${t.channel}` === key);
        if (!def) return null;
        tpl = { ...def, enabled: true };
      }
      if (!tpl.enabled) return null;

      const body = render(tpl.body, data);
      const job = {
        event, audience, channel, to: String(to),
        subject: channel === 'EMAIL' ? render(tpl.subject || event, data) : '',
        body,
        html: channel === 'EMAIL' ? textToHtml(body) : '',
        dedupeKey: dedupeKey ? `${dedupeKey}:${audience}:${channel}:${to}` : null,
        refType,
        refId: refId ? String(refId) : null
      };
      return await NotificationJob.create(job);
    } catch (err) {
      if (err.code === 11000) return null; // already queued
      console.warn('[Notify enqueue]', event, err.message);
      return null;
    }
  }

  async bookingContext(bookingOrId) {
    const Booking = require('../bookings/booking.model');
    const Company = require('../companies/company.model');
    let booking;
    if (typeof bookingOrId === 'string') {
      booking = await Booking.findOne({ $or: [{ bookingId: bookingOrId }, { pnr: bookingOrId.toUpperCase() }] }).lean();
    } else if (bookingOrId && bookingOrId._bsontype === 'ObjectId') {
      booking = await Booking.findById(bookingOrId).lean();
    } else {
      booking = bookingOrId?.toObject ? bookingOrId.toObject() : bookingOrId;
    }
    if (!booking) return null;
    const Trip = require('../trips/trip.model');
    const trip = await Trip.findById(booking.tripId?._id || booking.tripId).select('departureTime arrivalTime routeId busId companyCode')
      .populate('routeId', 'fromCity toCity').populate('busId', 'busNumber name').lean();
    const company = await Company.findOne({ companyCode: booking.companyCode }).select('name').lean();
    const infants = (booking.passengers || []).reduce((n, p) => n + (p.infants?.length || 0), 0);
    return {
      booking,
      trip,
      data: {
        name: booking.passengers?.[0]?.name || 'Passenger',
        pnr: booking.pnr,
        from: trip?.routeId?.fromCity?.name || '',
        to: trip?.routeId?.toCity?.name || '',
        date: istDate(trip?.departureTime),
        time: istTime(trip?.departureTime),
        seats: (booking.seatNumbers || []).join(', '),
        boarding: booking.boardingPoint?.name || '',
        boardingTime: booking.boardingPoint?.time || '',
        dropping: booking.droppingPoint?.name || '',
        busNumber: trip?.busId?.busNumber || '',
        companyName: company?.name || '',
        amount: Number(booking.fareBreakdown?.customerTotal || booking.fareBreakdown?.totalPayable || 0).toLocaleString('en-IN'),
        refundAmount: Number(booking.cancellationDetails?.refundAmount || 0).toLocaleString('en-IN'),
        ticketUrl: `${webUrl()}/ticket/${booking.bookingId}`,
        bookUrl: webUrl(),
        infants: infants ? `${infants} on lap` : '',
        arrival: trip?.arrivalTime ? `${istDate(trip.arrivalTime)}, ${istTime(trip.arrivalTime)}` : '',
        passengerCount: String((booking.passengers || []).length || ''),
        passengerList: (booking.passengers || []).map((p) => `${p.name}${p.seatNumber ? ` (${p.seatNumber})` : ''}`).join(', ')
      }
    };
  }

  // ------------------------------------------------------------------ events

  async bookingConfirmed(booking) {
    const ctx = await this.bookingContext(booking).catch(() => null);
    if (!ctx) return;
    const b = ctx.booking;
    const ref = { refType: 'BOOKING', refId: b.bookingId, dedupeKey: `CONF:${b.bookingId}` };
    await this.enqueue({ event: 'BOOKING_CONFIRMED', audience: 'PASSENGER', channel: 'WHATSAPP', to: b.contactDetails?.phone, data: ctx.data, ...ref });
    if (realEmail(b.contactDetails?.email)) {
      await this.enqueue({ event: 'BOOKING_CONFIRMED', audience: 'PASSENGER', channel: 'EMAIL', to: b.contactDetails.email, data: ctx.data, ...ref });
    }
  }

  async bookingCancelled(booking) {
    const ctx = await this.bookingContext(booking).catch(() => null);
    if (!ctx) return;
    const b = ctx.booking;
    const ref = { refType: 'BOOKING', refId: b.bookingId, dedupeKey: `CANC:${b.bookingId}` };
    await this.enqueue({ event: 'BOOKING_CANCELLED', audience: 'PASSENGER', channel: 'WHATSAPP', to: b.contactDetails?.phone, data: ctx.data, ...ref });
    if (realEmail(b.contactDetails?.email)) {
      await this.enqueue({ event: 'BOOKING_CANCELLED', audience: 'PASSENGER', channel: 'EMAIL', to: b.contactDetails.email, data: ctx.data, ...ref });
    }
    if (b.bookedByAgentId) {
      const User = require('../users/user.model');
      const agent = await User.findById(b.bookedByAgentId).select('phone').lean();
      await this.enqueue({ event: 'BOOKING_CANCELLED', audience: 'AGENT', channel: 'WHATSAPP', to: agent?.phone, data: ctx.data, ...ref });
    }
  }

  async refundProcessed(refund) {
    const Booking = require('../bookings/booking.model');
    const booking = await Booking.findById(refund.bookingId).lean();
    const ctx = booking ? await this.bookingContext(booking) : null;
    if (!ctx) return;
    const data = { ...ctx.data, refundAmount: Number(refund.refundAmount || 0).toLocaleString('en-IN') };
    const ref = { refType: 'REFUND', refId: refund.refundId, dedupeKey: `REFUND:${refund.refundId}` };
    await this.enqueue({ event: 'REFUND_PROCESSED', audience: 'PASSENGER', channel: 'WHATSAPP', to: booking.contactDetails?.phone, data, ...ref });
    if (realEmail(booking.contactDetails?.email)) {
      await this.enqueue({ event: 'REFUND_PROCESSED', audience: 'PASSENGER', channel: 'EMAIL', to: booking.contactDetails.email, data, ...ref });
    }
  }

  async cashReceived(booking, receiptNo) {
    const ctx = await this.bookingContext(booking).catch(() => null);
    if (!ctx?.booking?.bookedByAgentId) return;
    const User = require('../users/user.model');
    const agent = await User.findById(ctx.booking.bookedByAgentId).select('phone').lean();
    const data = { ...ctx.data, amount: Number(ctx.booking.cashCollection?.amountDue || 0).toLocaleString('en-IN'), receiptNo };
    await this.enqueue({ event: 'CASH_RECEIVED', audience: 'AGENT', channel: 'WHATSAPP', to: agent?.phone, data, refType: 'BOOKING', refId: ctx.booking.bookingId, dedupeKey: `CASH:${ctx.booking.bookingId}` });
  }

  async passengerBoarded(booking, passenger) {
    const ctx = await this.bookingContext(booking).catch(() => null);
    if (!ctx) return;
    const data = { ...ctx.data, name: passenger?.name || ctx.data.name, seats: passenger?.seatNumber || ctx.data.seats };
    // One welcome message per ticket (to the booking contact), not one per seat.
    await this.enqueue({ event: 'PASSENGER_BOARDED', audience: 'PASSENGER', channel: 'WHATSAPP', to: ctx.booking.contactDetails?.phone, data, refType: 'BOOKING', refId: ctx.booking.bookingId, dedupeKey: `BOARD:${ctx.booking.bookingId}` });
  }

  async passengerDropped(booking, passenger) {
    const ctx = await this.bookingContext(booking).catch(() => null);
    if (!ctx) return;
    const data = { ...ctx.data, name: passenger?.name || ctx.data.name };
    await this.enqueue({ event: 'PASSENGER_DROPPED', audience: 'PASSENGER', channel: 'WHATSAPP', to: ctx.booking.contactDetails?.phone, data, refType: 'BOOKING', refId: ctx.booking.bookingId, dedupeKey: `DROP:${ctx.booking.bookingId}` });
  }

  /**
   * The bus manager changed where a passenger boards or gets off (late passenger boards at the next stop,
   * passenger leaves earlier, …). The passenger, the company and RBS admins are told on WhatsApp.
   */
  async journeyPointChanged(booking, { type, from, to, reason, seats, managerName, managerPhone, changeId }) {
    const ctx = await this.bookingContext(booking).catch(() => null);
    if (!ctx) return;
    const label = type === 'DROPPING' ? 'Dropping point' : 'Boarding point';
    const changeText = from ? `${label} changed: ${from} → ${to}.` : `${label}: ${to}.`;
    const data = {
      ...ctx.data,
      seats: seats || ctx.data.seats,
      changeText,
      reason: reason || 'Updated by the bus manager',
      managerName: managerName || '',
      managerPhone: managerPhone ? `(${formatPhone(managerPhone)})` : ''
    };
    const ref = { refType: 'BOOKING', refId: ctx.booking.bookingId, dedupeKey: `POINT:${ctx.booking.bookingId}:${changeId || `${type}:${to}`}` };
    await this.enqueue({ event: 'JOURNEY_POINT_CHANGED', audience: 'PASSENGER', channel: 'WHATSAPP', to: ctx.booking.contactDetails?.phone, data, ...ref });
    const { phone: companyPhone } = await this.companyPhone(ctx.booking.companyCode);
    await this.enqueue({ event: 'JOURNEY_POINT_CHANGED', audience: 'COMPANY', channel: 'WHATSAPP', to: companyPhone, data, ...ref });
    for (const phone of await this.adminPhones()) {
      await this.enqueue({ event: 'JOURNEY_POINT_CHANGED', audience: 'ADMIN', channel: 'WHATSAPP', to: phone, data, ...ref });
    }
  }

  async tripSummary(event, trip, counts, managerName = '') {
    const Trip = require('../trips/trip.model');
    const t = await Trip.findById(trip._id || trip).select('departureTime routeId busId companyCode')
      .populate('routeId', 'fromCity toCity').populate('busId', 'busNumber').lean();
    if (!t) return;
    const { phone: companyPhone, name: companyName } = await this.companyPhone(t.companyCode);
    const data = {
      busNumber: t.busId?.busNumber || '',
      from: t.routeId?.fromCity?.name || '',
      to: t.routeId?.toCity?.name || '',
      date: istDate(t.departureTime),
      time: istTime(t.departureTime),
      companyName,
      managerName,
      boarded: counts.boarded ?? 0,
      dropped: counts.dropped ?? 0,
      noShow: counts.noShow ?? 0,
      total: counts.total ?? 0
    };
    const ref = { refType: 'TRIP', refId: String(t._id), dedupeKey: `${event}:${t._id}` };
    await this.enqueue({ event, audience: 'COMPANY', channel: 'WHATSAPP', to: companyPhone, data, ...ref });
    for (const phone of await this.adminPhones()) {
      await this.enqueue({ event, audience: 'ADMIN', channel: 'WHATSAPP', to: phone, data, ...ref });
    }
  }

  async payoutPaid(withdrawal) {
    const User = require('../users/user.model');
    const agent = await User.findById(withdrawal.agentId).select('phone').lean();
    await this.enqueue({
      event: 'PAYOUT_PAID', audience: 'AGENT', channel: 'WHATSAPP', to: agent?.phone,
      data: { amount: Number(withdrawal.amount).toLocaleString('en-IN'), utr: withdrawal.utrNumber || withdrawal.payout?.utr || '' },
      refType: 'WITHDRAWAL', refId: String(withdrawal._id), dedupeKey: `PAYOUT:${withdrawal._id}:${withdrawal.payout?.attempt || 0}`
    });
  }

  /** Fire-and-forget wrapper so callers never await or fail on notifications. */
  fire(method, ...args) {
    Promise.resolve()
      .then(() => this[method](...args))
      .catch((err) => console.warn(`[Notify ${method}]`, err.message));
  }

  // ------------------------------------------------------------------ sender

  async acquireLease() {
    const now = new Date();
    try {
      const lease = await WorkerLease.findOneAndUpdate(
        { _id: SENDER_LEASE, $or: [{ holder: INSTANCE_ID }, { expiresAt: { $lt: now } }] },
        { $set: { holder: INSTANCE_ID, expiresAt: new Date(now.getTime() + LEASE_MS) } },
        { upsert: true, new: true }
      );
      this.isLeader = lease?.holder === INSTANCE_ID;
    } catch (err) {
      // Duplicate key on upsert: another holder has an unexpired lease. If that holder is a dead
      // process on this same machine (e.g. the API was just restarted), take over straight away.
      this.isLeader = await this.takeOverStaleLocalLease();
    }
    return this.isLeader;
  }

  /** The lease holder is "hostname:pid:rand". Take it over if it is this host and that pid is gone. */
  async takeOverStaleLocalLease() {
    try {
      const lease = await WorkerLease.findById(SENDER_LEASE).lean();
      if (!lease) return false;
      if (lease.holder === INSTANCE_ID) return true;
      const [host, pidStr] = String(lease.holder).split(':');
      if (host !== os.hostname()) return false;
      const pid = Number(pidStr);
      let alive = false;
      if (pid && pid !== process.pid) {
        try { process.kill(pid, 0); alive = true; } catch (e) { alive = e.code === 'EPERM'; }
      }
      if (alive) return false;
      const r = await WorkerLease.updateOne(
        { _id: SENDER_LEASE, holder: lease.holder },
        { $set: { holder: INSTANCE_ID, expiresAt: new Date(Date.now() + LEASE_MS) } }
      );
      return r.modifiedCount === 1;
    } catch (e) {
      return false;
    }
  }

  /**
   * Make this instance the sender now (an admin pressed Connect on it). Another live instance
   * notices on its next lease tick and closes its WhatsApp socket.
   */
  async claimLeadership() {
    await WorkerLease.updateOne(
      { _id: SENDER_LEASE },
      { $set: { holder: INSTANCE_ID, expiresAt: new Date(Date.now() + LEASE_MS) } },
      { upsert: true }
    );
    this.isLeader = true;
    return true;
  }

  /** Give up the lease on shutdown so a restarted API can send immediately. */
  async releaseLease() {
    try {
      await WorkerLease.deleteOne({ _id: SENDER_LEASE, holder: INSTANCE_ID });
    } catch (e) { /* ignore */ }
    this.isLeader = false;
  }

  /** Who holds the sender lease (for the admin connection panel). */
  async leaseInfo() {
    const lease = await WorkerLease.findById(SENDER_LEASE).lean().catch(() => null);
    return {
      thisInstance: INSTANCE_ID,
      holder: lease?.holder || null,
      expiresAt: lease?.expiresAt || null,
      isLeader: this.isLeader
    };
  }

  // ------------------------------------------------------------------ counts for the admin page

  /**
   * WhatsApp message counts (no message content): today's totals, today by message type and a
   * day-by-day history for the last `days` days. Days are India time.
   */
  async whatsappStats(days = 30) {
    const n = Math.min(Math.max(parseInt(days, 10) || 30, 1), 180);
    const IST = 330 * 60000;
    const now = new Date();
    const todayKey = new Date(now.getTime() + IST).toISOString().slice(0, 10);
    const startToday = new Date(Date.parse(`${todayKey}T00:00:00Z`) - IST);
    const from = new Date(startToday.getTime() - (n - 1) * 86400000);

    const countFields = {
      total: { $sum: 1 },
      sent: { $sum: { $cond: [{ $eq: ['$status', 'SENT'] }, 1, 0] } },
      delivered: { $sum: { $cond: [{ $ifNull: ['$deliveredAt', false] }, 1, 0] } },
      read: { $sum: { $cond: [{ $ifNull: ['$readAt', false] }, 1, 0] } },
      failed: { $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] } },
      expired: { $sum: { $cond: [{ $eq: ['$status', 'EXPIRED'] }, 1, 0] } },
      waiting: { $sum: { $cond: [{ $in: ['$status', ['PENDING', 'SENDING']] }, 1, 0] } }
    };
    const base = { channel: 'WHATSAPP' };

    const [historyRaw, byEventRaw, todayRows, pendingRows, emailRows] = await Promise.all([
      NotificationJob.aggregate([
        { $match: { ...base, createdAt: { $gte: from } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } }, ...countFields } }
      ]),
      NotificationJob.aggregate([
        { $match: { ...base, createdAt: { $gte: startToday } } },
        { $group: { _id: { event: '$event', audience: '$audience' }, ...countFields } },
        { $sort: { total: -1 } }
      ]),
      NotificationJob.aggregate([{ $match: { ...base, createdAt: { $gte: startToday } } }, { $group: { _id: null, ...countFields } }]),
      NotificationJob.aggregate([{ $match: { ...base, status: { $in: ['PENDING', 'SENDING'] } } }, { $group: { _id: null, count: { $sum: 1 }, oldest: { $min: '$createdAt' } } }]),
      NotificationJob.aggregate([{ $match: { channel: 'EMAIL', createdAt: { $gte: startToday } } }, { $group: { _id: null, total: { $sum: 1 }, sent: { $sum: { $cond: [{ $eq: ['$status', 'SENT'] }, 1, 0] } } } }])
    ]);

    const pick = (r = {}) => ({
      total: r.total || 0, sent: r.sent || 0, delivered: r.delivered || 0, read: r.read || 0,
      failed: r.failed || 0, expired: r.expired || 0, waiting: r.waiting || 0
    });
    const map = new Map(historyRaw.map((h) => [h._id, h]));
    const history = [];
    for (let i = 0; i < n; i += 1) {
      const key = new Date(startToday.getTime() - i * 86400000 + IST).toISOString().slice(0, 10);
      history.push({ date: key, ...pick(map.get(key)) });
    }
    const totals = history.reduce((acc, d) => {
      Object.keys(acc).forEach((k) => { acc[k] += d[k]; });
      return acc;
    }, { total: 0, sent: 0, delivered: 0, read: 0, failed: 0, expired: 0, waiting: 0 });

    return {
      today: { date: todayKey, ...pick(todayRows[0]) },
      queue: { waiting: pendingRows[0]?.count || 0, oldestWaitingAt: pendingRows[0]?.oldest || null },
      email: { today: emailRows[0]?.total || 0, sentToday: emailRows[0]?.sent || 0 },
      byEventToday: byEventRaw.map((r) => ({ event: r._id.event, audience: r._id.audience, ...pick(r) })),
      history,
      totals: { days: n, ...totals }
    };
  }

  /** Deliver at most one due message. Returns what happened (used by tests). */
  async processOnce() {
    const now = new Date();
    await NotificationJob.updateMany({ status: 'PENDING', expiresAt: { $lt: now } }, { $set: { status: 'EXPIRED' } });
    // Recover jobs stuck in SENDING (crash mid-send).
    await NotificationJob.updateMany({ status: 'SENDING', lockedAt: { $lt: new Date(now.getTime() - 5 * 60000) } }, { $set: { status: 'PENDING' } });

    const { whatsapp, email } = this.providers();
    const channels = [];
    if (email.isConfigured()) channels.push('EMAIL');
    if (whatsapp.isReady() && Date.now() >= this.nextWhatsappAt) channels.push('WHATSAPP');

    if (!email.isConfigured()) {
      await NotificationJob.updateMany({ status: 'PENDING', channel: 'EMAIL' }, { $set: { status: 'SKIPPED', lastError: 'SMTP not configured' } });
    }
    if (!channels.length) return { sent: 0 };

    const job = await NotificationJob.findOneAndUpdate(
      { status: 'PENDING', channel: { $in: channels }, nextAttemptAt: { $lte: now } },
      { $set: { status: 'SENDING', lockedAt: now }, $inc: { attempts: 1 } },
      { sort: { createdAt: 1 }, new: true }
    );
    if (!job) return { sent: 0 };

    try {
      let waMessageId = null;
      if (job.channel === 'WHATSAPP') {
        const sent = await whatsapp.sendText(job.to, job.body);
        waMessageId = sent?.id || null;
        this.nextWhatsappAt = Date.now() + 2500 + Math.floor(Math.random() * 2000);
      } else {
        await email.send({ to: job.to, subject: job.subject, text: job.body, html: job.html });
      }
      await NotificationJob.updateOne({ _id: job._id }, { $set: { status: 'SENT', sentAt: new Date(), waMessageId, lastError: null } });
      return { sent: 1, jobId: job._id };
    } catch (err) {
      if (err.notConnected) {
        await NotificationJob.updateOne({ _id: job._id }, { $set: { status: 'PENDING', nextAttemptAt: new Date(Date.now() + 60000), lastError: err.message }, $inc: { attempts: -1 } });
        return { sent: 0, waiting: true };
      }
      const giveUp = err.permanent || job.attempts >= MAX_ATTEMPTS;
      const delayMin = BACKOFF_MIN[Math.min(job.attempts - 1, BACKOFF_MIN.length - 1)];
      await NotificationJob.updateOne(
        { _id: job._id },
        {
          $set: giveUp
            ? { status: 'FAILED', lastError: String(err.message).slice(0, 300) }
            : { status: 'PENDING', nextAttemptAt: new Date(Date.now() + delayMin * 60000), lastError: String(err.message).slice(0, 300) }
        }
      );
      return { sent: 0, failed: true, error: err.message };
    }
  }

  /** Start the background sender (one leader across instances). */
  start() {
    if (this.timer) return;
    const tick = async () => {
      if (this.busy) return;
      this.busy = true;
      try {
        if (this.isLeader) await this.processOnce();
      } catch (err) {
        console.warn('[Notify sender]', err.message);
      } finally {
        this.busy = false;
      }
    };
    const leaseTick = async () => {
      const wasLeader = this.isLeader;
      await this.acquireLease();
      const { whatsapp } = this.providers();
      if (this.isLeader && !wasLeader) {
        // Resume a previously linked WhatsApp session automatically.
        if (await whatsapp.hasSavedSession()) whatsapp.connect().catch((e) => console.warn('[WhatsApp resume]', e.message));
      } else if (!this.isLeader && wasLeader) {
        whatsapp.stop().catch(() => {});
      }
    };
    leaseTick().catch(() => {});
    this.timer = setInterval(tick, 1000);
    this.leaseTimer = setInterval(() => leaseTick().catch(() => {}), LEASE_TICK_MS);
    if (this.timer.unref) this.timer.unref();
    if (this.leaseTimer.unref) this.leaseTimer.unref();
  }

  stop() {
    clearInterval(this.timer);
    clearInterval(this.leaseTimer);
    this.timer = null;
    this.leaseTimer = null;
  }

  instanceId() {
    return INSTANCE_ID;
  }
}

module.exports = new NotificationService();
module.exports.render = render;
