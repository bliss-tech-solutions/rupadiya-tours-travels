/**
 * Integration tests for platform features: admin levels, fees, cash (COD), settlements,
 * company scoping, passenger details, notifications and bus-manager boarding.
 *
 * Uses an isolated, randomly named MongoDB database that is dropped afterwards.
 * Skips automatically when no MongoDB is reachable (set MONGODB_TEST_URI to override).
 */
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const mongoose = require('mongoose');

const BASE_URI = process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = `rupadiya_pf_${crypto.randomBytes(4).toString('hex')}`;

const User = require('../modules/users/user.model');
const Trip = require('../modules/trips/trip.model');
const Route = require('../modules/routes/route.model');
const Bus = require('../modules/fleet/bus.model');
const Booking = require('../modules/bookings/booking.model');
const SeatReservation = require('../modules/bookings/seatReservation.model');
const { Wallet, WalletLedger } = require('../modules/wallets/wallet.model');
const { CommissionRecord } = require('../modules/commissions/commission.model');
const holdStore = require('../config/holdStore');
const paymentService = require('../modules/payments/payment.service');
const { requirePrimaryAdmin } = require('../middleware/rbac.middleware');
const { ensurePrimaryAdmin } = require('../services/adminAccounts.service');

paymentService.keyId = '';
paymentService.keySecret = '';

let connected = false;
const fx = {};

async function makeUser(role, extra = {}) {
  const id = crypto.randomBytes(4).toString('hex');
  return User.create({
    name: `${role} ${id}`,
    email: `${role.toLowerCase()}_${id}@pf.test`,
    phone: `9${crypto.randomInt(100000000, 999999999)}`,
    passwordHash: 'x',
    role,
    companyCode: 1,
    ...extra
  });
}

async function makeTrip({ companyCode = 1, hoursAhead = 72 } = {}) {
  return Trip.create({
    routeId: fx.route._id,
    busId: fx.bus._id,
    companyCode,
    departureTime: new Date(Date.now() + hoursAhead * 3600 * 1000),
    arrivalTime: new Date(Date.now() + (hoursAhead + 12) * 3600 * 1000),
    baseFare: 1000,
    seats: Trip.generateSeater40Seats(1000)
  });
}

const pax = (seatNumber, gender = 'male', name = 'Test Traveller', age = 30) => ({ seatNumber, name, age, gender });

function runMiddleware(mw, user) {
  return new Promise((resolve) => {
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { resolve({ status: this.statusCode, body: b }); } };
    mw({ user }, res, () => resolve({ status: 200, next: true }));
  });
}

test.before(async () => {
  try {
    await mongoose.connect(BASE_URI, { dbName: DB_NAME, serverSelectionTimeoutMS: 2000 });
    connected = true;
  } catch (e) {
    connected = false;
    return;
  }
  await Promise.all([SeatReservation.init(), Booking.init(), WalletLedger.init(), Wallet.init(), CommissionRecord.init(), User.init()]);
  fx.route = await Route.create({
    companyCode: 1,
    fromCity: { id: 'rupaidiha', name: 'Rupaidiha', state: 'UP' },
    toCity: { id: 'ahmedabad', name: 'Ahmedabad', state: 'GJ' },
    distanceKm: 1200,
    estimatedDurationHours: 24,
    baseFare: 1000,
    boardingPoints: [{ id: 'bp1', name: 'Rupaidiha Bus Stand', timeOffsetMinutes: 0 }],
    droppingPoints: [{ id: 'dp1', name: 'Ahmedabad Geeta Mandir', timeOffsetMinutes: 0 }]
  });
  fx.bus = await Bus.create({ busNumber: `UP40PF${crypto.randomInt(1000, 9999)}`, name: 'PF Coach', companyCode: 1, busType: 'AC Seater (2+2)' });
});

test.after(async () => {
  if (connected) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  holdStore.destroy();
});

// ---------------------------------------------------------------------------
// Phase 1 — super admin levels
// ---------------------------------------------------------------------------
test('primary admin: oldest super admin is promoted, others are STANDARD, only primary passes the guard', async (t) => {
  if (!connected) return t.skip('MongoDB not available');
  const first = await makeUser('SUPER_ADMIN', { companyCode: null });
  const second = await makeUser('SUPER_ADMIN', { companyCode: null });

  await ensurePrimaryAdmin();
  await ensurePrimaryAdmin(); // idempotent

  const [a, b] = await Promise.all([User.findById(first._id), User.findById(second._id)]);
  assert.strictEqual(a.adminLevel, 'PRIMARY');
  assert.strictEqual(b.adminLevel, 'STANDARD');
  assert.strictEqual(await User.countDocuments({ role: 'SUPER_ADMIN', adminLevel: 'PRIMARY' }), 1);

  assert.strictEqual((await runMiddleware(requirePrimaryAdmin, a)).status, 200);
  const denied = await runMiddleware(requirePrimaryAdmin, b);
  assert.strictEqual(denied.status, 403);
  assert.strictEqual(denied.body.code, 'PRIMARY_ADMIN_REQUIRED');
  assert.strictEqual((await runMiddleware(requirePrimaryAdmin, await makeUser('COMPANY_OWNER'))).status, 403);
});

// ---------------------------------------------------------------------------
// Phase 2 — fee breakdown
// ---------------------------------------------------------------------------
const bookingService = require('../modules/bookings/booking.service');
const walletLedger = require('../services/walletLedger.service');
const cashCollection = require('../services/cashCollection.service');
const Company = require('../modules/companies/company.model');

async function fundAgent(agent, amount = 20000) {
  await walletLedger.credit({ userId: agent._id, amount, transactionType: 'WALLET_DEPOSIT', referenceType: 'DEPOSIT', referenceId: 'seed', description: 'seed', idempotencyKey: `seed_${agent._id}_${amount}` });
}

test('fees: online adds platform + gateway fee; wallet/cash skip gateway fee; insurance fixed ₹28/passenger', async (t) => {
  if (!connected) return t.skip('MongoDB not available');
  const trip = await makeTrip();

  const online = await bookingService.calculateQuote({ tripId: trip._id, seatNumbers: ['1'], paymentChannel: 'ONLINE' });
  assert.strictEqual(online.subtotal, 1000);
  assert.strictEqual(online.gstAmount, 50);
  assert.strictEqual(online.platformFee, 50, 'platform fee is 5% of the fare');
  assert.strictEqual(online.gatewayFee, Math.round(1100 * 0.025)); // 28
  assert.strictEqual(online.totalPayable, 1100 + Math.round(1100 * 0.025));

  // The agent booking charge has been removed — any value sent by a client is ignored.
  const wallet = await bookingService.calculateQuote({ tripId: trip._id, seatNumbers: ['1'], paymentChannel: 'WALLET', agentServiceCharge: 40 });
  assert.strictEqual(wallet.gatewayFee, 0);
  assert.strictEqual(wallet.agentServiceCharge, 0, 'agent booking charge removed');
  assert.strictEqual(wallet.totalPayable, 1100);
  assert.strictEqual(wallet.customerTotal, 1100, 'no agent charge added');

  const agentOnline = await bookingService.calculateQuote({ tripId: trip._id, seatNumbers: ['1'], paymentChannel: 'ONLINE', agentServiceCharge: 40 });
  assert.strictEqual(agentOnline.agentServiceCharge, 0);
  assert.strictEqual(agentOnline.totalPayable, 1100 + Math.round(1100 * 0.025), 'same as a normal online ticket — no agent charge');

  const ins = await bookingService.calculateQuote({ tripId: trip._id, seatNumbers: ['1', '2'], paymentChannel: 'CASH', insuranceOpted: true, insurancePerPassenger: 12 });
  assert.strictEqual(ins.insurancePerPassenger, 28, 'insurance is a fixed ₹28 per passenger; client value ignored');
  assert.strictEqual(ins.insuranceAmount, 56);
});

// ---------------------------------------------------------------------------
// Phase 3 — agent cash (COD)
// ---------------------------------------------------------------------------
test('cash: ticket confirmed as CASH_PENDING, no commission until company receives it (once)', async (t) => {
  if (!connected) return t.skip('MongoDB not available');
  const trip = await makeTrip();
  const agent = await makeUser('AGENT');
  const owner = await makeUser('COMPANY_OWNER');

  const h = await bookingService.holdSeats({ tripId: trip._id, seatNumbers: ['5'], passengerId: agent._id, actor: agent });
  const booking = await bookingService.confirmBooking({
    holdToken: h.holdToken, passengerId: agent._id, agentUserId: agent._id, contactPhone: '9876500001',
    passengers: [pax('5')], paymentProvider: 'agent_cash', channel: 'AGENT_PORTAL', agentServiceCharge: 30
  });
  assert.strictEqual(booking.paymentStatus, 'CASH_PENDING');
  assert.strictEqual(booking.cashCollection.status, 'PENDING');
  assert.strictEqual(booking.cashCollection.amountDue, 1100);
  assert.strictEqual(await CommissionRecord.countDocuments({ bookingId: booking._id }), 0, 'commission held back');
  assert.strictEqual((await Wallet.findOne({ userId: agent._id }))?.availableBalance || 0, 0, 'nothing debited from wallet');

  const runs = await Promise.all([1, 2].map(() => cashCollection.markReceived({ bookingIds: [booking.bookingId], companyCode: 1, actorId: owner._id })));
  assert.strictEqual(runs.reduce((s, r) => s + r.received, 0), 1, 'received exactly once');

  const after = await Booking.findById(booking._id);
  assert.strictEqual(after.paymentStatus, 'SUCCESS');
  assert.strictEqual(after.cashCollection.status, 'RECEIVED');
  assert.ok(after.cashCollection.receiptNo);
  assert.ok(await CommissionRecord.countDocuments({ bookingId: booking._id }) >= 1, 'commission released on receipt');

  const summary = await cashCollection.agentSummary(agent._id);
  assert.strictEqual(summary.totals.handedOver, 1100);
  assert.strictEqual(summary.totals.pendingHandover, 0);
});

test('cash: a receipt marked by mistake can be reverted (commission held back) and received again', async (t) => {
  if (!connected) return t.skip('MongoDB not available');
  const trip = await makeTrip();
  const agent = await makeUser('AGENT');
  const owner = await makeUser('COMPANY_OWNER');
  const h = await bookingService.holdSeats({ tripId: trip._id, seatNumbers: ['9'], passengerId: agent._id, actor: agent });
  const booking = await bookingService.confirmBooking({
    holdToken: h.holdToken, passengerId: agent._id, agentUserId: agent._id, contactPhone: '9876500077',
    passengers: [pax('9')], paymentProvider: 'agent_cash', channel: 'AGENT_PORTAL'
  });
  const bal = async () => (await Wallet.findOne({ userId: agent._id }))?.availableBalance || 0;

  const r1 = await cashCollection.markReceived({ bookingIds: [booking.bookingId], companyCode: 1, actorId: owner._id });
  const commission = await bal();
  assert.ok(commission > 0, 'commission credited on receipt');

  await assert.rejects(cashCollection.revertReceived({ bookingId: booking.bookingId, companyCode: 1, actorId: owner._id, reason: '' }), (e) => e.statusCode === 400);
  await assert.rejects(cashCollection.revertReceived({ bookingId: booking.bookingId, companyCode: 2, actorId: owner._id, reason: 'wrong ticket' }), (e) => e.statusCode === 404);

  // Two clicks at once revert only once.
  const reverts = await Promise.allSettled([1, 2].map(() => cashCollection.revertReceived({ bookingId: booking.bookingId, companyCode: 1, actorId: owner._id, reason: 'selected wrong ticket' })));
  assert.strictEqual(reverts.filter((r) => r.status === 'fulfilled').length, 1, 'reverted exactly once');
  assert.strictEqual(reverts.find((r) => r.status === 'fulfilled').value.receiptNo, r1.receiptNo);

  let after = await Booking.findById(booking._id);
  assert.strictEqual(after.cashCollection.status, 'PENDING');
  assert.strictEqual(after.paymentStatus, 'CASH_PENDING');
  assert.strictEqual(after.cashCollection.receiptNo, null);
  assert.strictEqual(after.cashCollection.revertCount, 1);
  assert.deepStrictEqual(after.cashCollection.history.map((x) => x.action), ['RECEIVED', 'REVERTED']);
  assert.strictEqual(await bal(), 0, 'commission taken back');
  assert.strictEqual(await CommissionRecord.countDocuments({ bookingId: booking._id, status: 'CREDITED' }), 0);

  // Received again → commission paid again exactly once.
  const r2 = await cashCollection.markReceived({ bookingIds: [booking.bookingId], companyCode: 1, actorId: owner._id });
  assert.strictEqual(r2.received, 1);
  assert.notStrictEqual(r2.receiptNo, r1.receiptNo);
  assert.strictEqual(await bal(), commission, 'commission re-credited once');

  // Revert + receive a second time still balances.
  await cashCollection.revertReceived({ bookingId: booking.bookingId, companyCode: 1, actorId: owner._id, reason: 'again by mistake' });
  assert.strictEqual(await bal(), 0);
  await cashCollection.markReceived({ bookingIds: [booking.bookingId], companyCode: 1, actorId: owner._id });
  assert.strictEqual(await bal(), commission);

  // Not allowed once a passenger has boarded.
  await Booking.updateOne({ _id: booking._id }, { $set: { 'passengers.0.journeyStatus': 'BOARDED' } });
  await assert.rejects(cashCollection.revertReceived({ bookingId: booking.bookingId, companyCode: 1, actorId: owner._id, reason: 'late' }), (e) => e.statusCode === 409);
  after = await Booking.findById(booking._id);
  assert.strictEqual(after.cashCollection.status, 'RECEIVED');
});

test('cash: credit limit and departure cut-off are enforced; unpaid cash cancel refunds nothing', async (t) => {
  if (!connected) return t.skip('MongoDB not available');
  const companyCode = 33; // company codes are 1-35
  await Company.create({ companyCode, name: `Cash Co ${companyCode}`, slug: `cash-co-${companyCode}`, cashPolicy: { enabled: true, cutoffHours: 4, agentCreditLimit: 1500 } });
  const trip = await makeTrip({ companyCode });
  const soonTrip = await makeTrip({ companyCode, hoursAhead: 2 });
  const agent = await makeUser('AGENT', { companyCode });

  const h1 = await bookingService.holdSeats({ tripId: trip._id, seatNumbers: ['1'], passengerId: agent._id, actor: agent });
  const b1 = await bookingService.confirmBooking({ holdToken: h1.holdToken, passengerId: agent._id, agentUserId: agent._id, contactPhone: '9876500002', passengers: [pax('1')], paymentProvider: 'agent_cash', channel: 'AGENT_PORTAL' });

  const h2 = await bookingService.holdSeats({ tripId: trip._id, seatNumbers: ['2'], passengerId: agent._id, actor: agent });
  await assert.rejects(
    bookingService.confirmBooking({ holdToken: h2.holdToken, passengerId: agent._id, agentUserId: agent._id, contactPhone: '9876500002', passengers: [pax('2')], paymentProvider: 'agent_cash', channel: 'AGENT_PORTAL' }),
    (e) => e.code === 'CASH_LIMIT' && e.statusCode === 402
  );

  const h3 = await bookingService.holdSeats({ tripId: soonTrip._id, seatNumbers: ['3'], passengerId: agent._id, actor: agent });
  await assert.rejects(
    bookingService.confirmBooking({ holdToken: h3.holdToken, passengerId: agent._id, agentUserId: agent._id, contactPhone: '9876500002', passengers: [pax('3')], paymentProvider: 'agent_cash', channel: 'AGENT_PORTAL' }),
    (e) => e.code === 'CASH_CUTOFF'
  );

  const cancel = await bookingService.cancelBooking({ bookingId: b1.bookingId, reason: 'test', cancelledByUserId: agent._id });
  assert.strictEqual(cancel.refundAmount, 0);
  assert.strictEqual(cancel.refundRouting, 'UNPAID_CASH_NO_REFUND');
  assert.strictEqual((await Wallet.findOne({ userId: agent._id }))?.availableBalance || 0, 0);
});

// ---------------------------------------------------------------------------
// Phase 5 — agents only sell their own company's buses
// ---------------------------------------------------------------------------
test('scope: an agent cannot hold or book another company\'s bus', async (t) => {
  if (!connected) return t.skip('MongoDB not available');
  const foreignTrip = await makeTrip({ companyCode: 7 });
  const agent = await makeUser('AGENT', { companyCode: 1 });
  await assert.rejects(
    bookingService.holdSeats({ tripId: foreignTrip._id, seatNumbers: ['1'], passengerId: agent._id, actor: agent }),
    (e) => e.code === 'AGENT_COMPANY_SCOPE' && e.statusCode === 403
  );
  // A customer (no agent actor) can book any company.
  const ok = await bookingService.holdSeats({ tripId: foreignTrip._id, seatNumbers: ['1'], tabId: 'cust' });
  assert.ok(ok.holdToken);
});

// ---------------------------------------------------------------------------
// Phase 6 — emergency contact, lap infants, child flag
// ---------------------------------------------------------------------------
test('passengers: emergency contact, lap infants and child flag are validated and stored', async (t) => {
  if (!connected) return t.skip('MongoDB not available');
  const trip = await makeTrip();
  const adult = { ...pax('11', 'female', 'Sunita Devi', 32), infants: [{ name: 'Baby Riya', age: 2, gender: 'female' }] };
  const child = pax('12', 'male', 'Aman', 8);

  await assert.rejects(
    bookingService.holdSeats({ tripId: trip._id, seatNumbers: ['11'], passengers: [{ ...pax('11'), infants: [{ name: 'Kid', age: 6, gender: 'male' }] }], tabId: 'x1' }),
    /under 5/
  );

  const h = await bookingService.holdSeats({ tripId: trip._id, seatNumbers: ['11', '12'], passengers: [adult, child], tabId: 'fam' });
  await assert.rejects(
    bookingService.confirmBooking({ holdToken: h.holdToken, tabId: 'fam', contactPhone: '9876500003', passengers: [adult, child], paymentProvider: 'dummy', emergencyContact: { name: 'Ramesh', phone: '123', relation: 'Husband' } }),
    /emergency contact number/
  );
  const b = await bookingService.confirmBooking({
    holdToken: h.holdToken, tabId: 'fam', contactPhone: '9876500003', passengers: [adult, child], paymentProvider: 'dummy',
    emergencyContact: { name: 'Ramesh Kumar', phone: '9812345678', relation: 'Husband' }
  });
  assert.deepStrictEqual(b.emergencyContact, { name: 'Ramesh Kumar', phone: '9812345678', relation: 'Husband' });
  const p11 = b.passengers.find((p) => p.seatNumber === '11');
  const p12 = b.passengers.find((p) => p.seatNumber === '12');
  assert.strictEqual(p11.infants.length, 1);
  assert.strictEqual(p11.infants[0].name, 'Baby Riya');
  assert.strictEqual(p12.isChild, true);
  assert.strictEqual(b.fareBreakdown.subtotal, 2000, 'infants are free');
});

// ---------------------------------------------------------------------------
// Phase 4 — RBS ↔ company settlement
// ---------------------------------------------------------------------------
const settlementService = require('../modules/settlements/settlement.service');

test('settlement: fare owed − cash held, each ticket once, clawback after late cancel', async (t) => {
  if (!connected) return t.skip('MongoDB not available');
  const companyCode = 34;
  await Company.create({ companyCode, name: 'Settle Co', slug: 'settle-co-34' });
  const trip = await makeTrip({ companyCode });
  const agent = await makeUser('AGENT', { companyCode });
  const owner = await makeUser('COMPANY_OWNER', { companyCode });
  await fundAgent(agent, 5000);

  // Online customer ticket (seat 1): fare 1000
  const h1 = await bookingService.holdSeats({ tripId: trip._id, seatNumbers: ['1'], passengers: [pax('1')], tabId: 's1' });
  await bookingService.confirmBooking({ holdToken: h1.holdToken, tabId: 's1', contactPhone: '9876511111', passengers: [pax('1')], paymentProvider: 'dummy' });
  // Wallet agent ticket (seat 2): fare 1000
  const h2 = await bookingService.holdSeats({ tripId: trip._id, seatNumbers: ['2'], passengerId: agent._id, actor: agent });
  const wallet = await bookingService.confirmBooking({ holdToken: h2.holdToken, passengerId: agent._id, agentUserId: agent._id, contactPhone: '9876522222', passengers: [pax('2')], paymentProvider: 'agent_wallet', channel: 'AGENT_PORTAL' });
  // Cash ticket received (seat 3): fare 1000, cash 1100 held by company
  const h3 = await bookingService.holdSeats({ tripId: trip._id, seatNumbers: ['3'], passengerId: agent._id, actor: agent });
  const cash = await bookingService.confirmBooking({ holdToken: h3.holdToken, passengerId: agent._id, agentUserId: agent._id, contactPhone: '9876533333', passengers: [pax('3')], paymentProvider: 'agent_cash', channel: 'AGENT_PORTAL' });
  await cashCollection.markReceived({ bookingIds: [cash.bookingId], companyCode, actorId: owner._id });
  // Cash ticket NOT yet received (seat 4): not owed yet
  const h4 = await bookingService.holdSeats({ tripId: trip._id, seatNumbers: ['4'], passengerId: agent._id, actor: agent });
  await bookingService.confirmBooking({ holdToken: h4.holdToken, passengerId: agent._id, agentUserId: agent._id, contactPhone: '9876544444', passengers: [pax('4')], paymentProvider: 'agent_cash', channel: 'AGENT_PORTAL' });

  const from = new Date(Date.now() - 86400000);
  const to = new Date(Date.now() + 60000);
  const preview = await settlementService.compute(companyCode, from, to);
  assert.strictEqual(preview.ticketCount, 3);
  assert.strictEqual(preview.ticketFareOwed, 3000);
  assert.strictEqual(preview.cashHeldByCompany, 1100);
  assert.strictEqual(preview.net, 1900);
  assert.strictEqual(preview.direction, 'RBS_PAYS_COMPANY');

  const admin = await makeUser('SUPER_ADMIN', { companyCode: null });
  const statement = await settlementService.issue({ companyCode, from, to, actorId: admin._id });
  assert.strictEqual(statement.net, 1900);

  // Same tickets are never counted twice.
  await assert.rejects(settlementService.issue({ companyCode, from, to, actorId: admin._id }), (e) => e.statusCode === 409);

  // Wallet ticket cancelled after it was settled → clawed back next time.
  await bookingService.cancelBooking({ bookingId: wallet.bookingId, reason: 'late', cancelledByUserId: agent._id });
  const next = await settlementService.compute(companyCode, from, new Date(Date.now() + 120000));
  assert.strictEqual(next.clawbacks, 1000);
  assert.strictEqual(next.net, -1000);
  assert.strictEqual(next.direction, 'COMPANY_PAYS_RBS');

  const settled = await settlementService.markSettled({ settlementId: statement._id, actorId: admin._id, utrNumber: 'utr123456' });
  assert.strictEqual(settled.status, 'SETTLED');
  await assert.rejects(settlementService.markSettled({ settlementId: statement._id, actorId: admin._id, utrNumber: 'UTR999999' }), (e) => e.statusCode === 409);
  assert.ok(settlementService.toCsv(settled).includes(cash.pnr));
});

// ---------------------------------------------------------------------------
// Phase 5 — company reports & network stats (no personal data)
// ---------------------------------------------------------------------------
const companyReports = require('../services/companyReports.service');

test('reports: network stats show counts only; company report totals by channel', async (t) => {
  if (!connected) return t.skip('MongoDB not available');
  const stats = await companyReports.networkStats('1m');
  const row = stats.companies.find((c) => c.companyCode === 34);
  assert.ok(row && row.tickets >= 1, 'company 34 has bookings from the settlement test');
  const keys = Object.keys(row).sort();
  assert.deepStrictEqual(keys, ['companyCode', 'companyName', 'rank', 'seats', 'status', 'tickets'], 'no personal data in network stats');

  const report = await companyReports.companyReport(34, '3m');
  assert.ok(report.totals.tickets >= 3);
  assert.strictEqual(report.byChannel.length, 3);
  assert.ok(report.byChannel.find((c) => c.channel === 'CASH').tickets >= 1);
  assert.ok(companyReports.reportToCsv(report, 'Settle Co').includes('By payment'));
});

// ---------------------------------------------------------------------------
// Phase 7 — notifications outbox (fake providers)
// ---------------------------------------------------------------------------
const notificationService = require('../modules/notifications/notification.service');
const { NotificationJob, MessageTemplate } = require('../modules/notifications/models');

test('notifications: templates render, dedupe, throttle, wait while disconnected, never block', async (t) => {
  if (!connected) return t.skip('MongoDB not available');
  const sent = [];
  const fakeWa = { ready: false, isReady() { return this.ready; }, async sendText(to, text) { sent.push({ to, text }); }, async hasSavedSession() { return false; } };
  const fakeMail = { isConfigured: () => true, async send(m) { sent.push({ to: m.to, subject: m.subject }); } };
  notificationService.setProviders({ whatsapp: fakeWa, email: fakeMail });
  await NotificationJob.deleteMany({});
  await notificationService.ensureTemplates();
  assert.ok(await MessageTemplate.countDocuments() >= 15);

  // Rendering: unknown placeholders vanish, email values are HTML-escaped.
  assert.strictEqual(notificationService.constructor ? require('../modules/notifications/notification.service').render('Hi {{name}} {{nope}}!', { name: 'Asha' }) : '', 'Hi Asha !');
  assert.strictEqual(require('../modules/notifications/notification.service').render('{{name}}', { name: '<b>x</b>' }, { html: true }), '&lt;b&gt;x&lt;/b&gt;');

  const trip = await makeTrip();
  const h = await bookingService.holdSeats({ tripId: trip._id, seatNumbers: ['21'], passengers: [pax('21', 'female', 'Meera')], tabId: 'n1' });
  const booking = await bookingService.confirmBooking({
    holdToken: h.holdToken, tabId: 'n1', contactPhone: '9876598765', contactEmail: 'meera@example.com',
    passengers: [pax('21', 'female', 'Meera')], paymentProvider: 'dummy'
  });
  await new Promise((r) => setTimeout(r, 300)); // fire-and-forget enqueue
  await notificationService.bookingConfirmed(booking); // duplicate call → deduped

  const jobs = await NotificationJob.find({ refId: booking.bookingId }).lean();
  assert.strictEqual(jobs.length, 2, 'one WhatsApp + one email, deduplicated');
  const wa = jobs.find((j) => j.channel === 'WHATSAPP');
  assert.match(wa.body, new RegExp(booking.pnr));
  assert.match(wa.body, /Meera/);

  // WhatsApp disconnected: email still goes, WhatsApp waits (no attempt burned).
  let r = await notificationService.processOnce();
  assert.strictEqual(r.sent, 1);
  r = await notificationService.processOnce();
  assert.strictEqual(r.sent, 0);
  assert.strictEqual((await NotificationJob.findById(wa._id)).status, 'PENDING');

  fakeWa.ready = true;
  notificationService.nextWhatsappAt = 0;
  r = await notificationService.processOnce();
  assert.strictEqual(r.sent, 1);
  assert.strictEqual((await NotificationJob.findById(wa._id)).status, 'SENT');
  assert.ok(sent.some((m) => m.to === '9876598765'));
  assert.ok(notificationService.nextWhatsappAt > Date.now(), 'next WhatsApp message is throttled');

  // A permanently failing number is marked FAILED without retry storms.
  fakeWa.sendText = async () => { const e = new Error('not on WhatsApp'); e.permanent = true; throw e; };
  await notificationService.enqueue({ event: 'PAYOUT_PAID', audience: 'AGENT', channel: 'WHATSAPP', to: '9000000001', data: { amount: '500', utr: 'X' } });
  notificationService.nextWhatsappAt = 0;
  r = await notificationService.processOnce();
  assert.ok(r.failed);
});

// ---------------------------------------------------------------------------
// Phase 8 — bus manager boarding
// ---------------------------------------------------------------------------
const managerService = require('../modules/manager/manager.service');
const ticketQr = require('../services/ticketQr.service');

test('manager: QR/PNR boarding, cash block, wrong trip, idempotent replay, start → complete with summaries', async (t) => {
  if (!connected) return t.skip('MongoDB not available');
  const manager = await makeUser('BUS_MANAGER');
  const otherManager = await makeUser('BUS_MANAGER');
  const owner = await makeUser('COMPANY_OWNER');
  const agent = await makeUser('AGENT');
  const trip = await makeTrip({ hoursAhead: 5 });
  const otherTrip = await makeTrip({ hoursAhead: 5 });
  await Trip.updateOne({ _id: trip._id }, { $set: { managerId: manager._id } });

  // Online ticket (2 seats) and an unpaid cash ticket.
  const h1 = await bookingService.holdSeats({ tripId: trip._id, seatNumbers: ['1', '2'], passengers: [pax('1', 'female', 'Kavya'), pax('2', 'male', 'Raj')], tabId: 'm1' });
  const paid = await bookingService.confirmBooking({ holdToken: h1.holdToken, tabId: 'm1', contactPhone: '9876501010', passengers: [pax('1', 'female', 'Kavya'), pax('2', 'male', 'Raj')], paymentProvider: 'dummy' });
  const h2 = await bookingService.holdSeats({ tripId: trip._id, seatNumbers: ['3'], passengerId: agent._id, actor: agent });
  const cash = await bookingService.confirmBooking({ holdToken: h2.holdToken, passengerId: agent._id, agentUserId: agent._id, contactPhone: '9876502020', passengers: [pax('3')], paymentProvider: 'agent_cash', channel: 'AGENT_PORTAL' });
  const h3 = await bookingService.holdSeats({ tripId: otherTrip._id, seatNumbers: ['1'], passengers: [pax('1')], tabId: 'm2' });
  const foreign = await bookingService.confirmBooking({ holdToken: h3.holdToken, tabId: 'm2', contactPhone: '9876503030', passengers: [pax('1')], paymentProvider: 'dummy' });

  assert.ok(paid.qrToken && ticketQr.verify(paid.qrToken), 'ticket carries a signed QR');

  // Access control.
  await assert.rejects(managerService.manifest(otherManager, trip._id), (e) => e.code === 'TRIP_NOT_ASSIGNED');
  const manifest = await managerService.manifest(manager, trip._id);
  assert.strictEqual(manifest.counts.total, 3);
  assert.strictEqual(manifest.passengers.find((p) => p.seatNumber === '3').payment, 'CASH_PENDING');

  // Forged / foreign tickets.
  await assert.rejects(managerService.board(manager, trip._id, { qrToken: paid.qrToken.slice(0, -2) + 'xx' }), (e) => e.code === 'QR_INVALID');
  await assert.rejects(managerService.board(manager, trip._id, { qrToken: foreign.qrToken }), (e) => e.code === 'WRONG_TRIP');

  // Cash not handed over → cannot board.
  await assert.rejects(managerService.board(manager, trip._id, { pnr: cash.pnr }), (e) => e.code === 'CASH_PENDING');

  // Board via QR, replay the same offline action.
  const r1 = await managerService.board(manager, trip._id, { qrToken: paid.qrToken, clientActionId: 'act-1' });
  const r2 = await managerService.board(manager, trip._id, { qrToken: paid.qrToken, clientActionId: 'act-1' });
  assert.strictEqual(r1.boarded.length, 2);
  assert.strictEqual(r2.replayed, true);

  // Company receives cash → passenger can board.
  await cashCollection.markReceived({ bookingIds: [cash.bookingId], companyCode: 1, actorId: owner._id });
  await managerService.board(manager, trip._id, { pnr: cash.pnr, clientActionId: 'act-2' });

  await managerService.drop(manager, trip._id, { pnr: paid.pnr, seatNumbers: ['2'], clientActionId: 'act-3' });
  await assert.rejects(managerService.complete(manager, trip._id, {}), /Start the journey/);

  const started = await managerService.start(manager, trip._id, { clientActionId: 'act-4' });
  assert.strictEqual(started.status, 'DEPARTED');
  assert.strictEqual(started.counts.boarded, 3);

  const done = await managerService.complete(manager, trip._id, { clientActionId: 'act-5' });
  assert.strictEqual(done.status, 'COMPLETED');
  assert.strictEqual(done.counts.dropped, 3);
  assert.strictEqual((await Booking.findById(paid._id)).status, 'COMPLETED');

  await new Promise((r) => setTimeout(r, 400));
  const queued = await NotificationJob.find({ refId: String(trip._id) }).lean();
  assert.ok(queued.some((j) => j.event === 'TRIP_STARTED' && j.audience === 'COMPANY'), 'company gets journey-started summary');
  assert.ok(queued.some((j) => j.event === 'TRIP_COMPLETED'), 'trip completed summary queued');
  assert.ok(await NotificationJob.exists({ event: 'PASSENGER_BOARDED', refId: paid.bookingId }));
  assert.ok(await NotificationJob.exists({ event: 'PASSENGER_DROPPED', refId: paid.bookingId }));
});

test('manager: late passenger moved to next stop, drop-point change, WhatsApp to passenger/company/RBS, day list', async (t) => {
  if (!connected) return t.skip('MongoDB not available');
  const manager = await makeUser('BUS_MANAGER');
  const route = await Route.create({
    companyCode: 1,
    fromCity: { id: 'rupaidiha', name: 'Rupaidiha', state: 'UP' },
    toCity: { id: 'surat', name: 'Surat', state: 'GJ' },
    distanceKm: 1300, estimatedDurationHours: 26, baseFare: 1000,
    boardingPoints: [
      { id: 'b1', name: 'Rupaidiha Bus Stand', timeOffsetMinutes: 0 },
      { id: 'b2', name: 'Nanpara Chauraha', timeOffsetMinutes: 45 }
    ],
    droppingPoints: [
      { id: 'd1', name: 'Vadodara Highway', timeOffsetMinutes: 1400 },
      { id: 'd2', name: 'Surat Central', timeOffsetMinutes: 1500 }
    ]
  });
  const trip = await Trip.create({
    routeId: route._id, busId: fx.bus._id, companyCode: 1, managerId: manager._id,
    departureTime: new Date(Date.now() + 5 * 3600000), arrivalTime: new Date(Date.now() + 31 * 3600000),
    baseFare: 1000, seats: Trip.generateSeater40Seats(1000)
  });

  const h1 = await bookingService.holdSeats({ tripId: trip._id, seatNumbers: ['5'], passengers: [pax('5', 'female', 'Late Lata')], tabId: 'pc1' });
  const late = await bookingService.confirmBooking({ holdToken: h1.holdToken, tabId: 'pc1', contactPhone: '+977 9812345678', passengers: [pax('5', 'female', 'Late Lata')], paymentProvider: 'dummy' });
  const h2 = await bookingService.holdSeats({ tripId: trip._id, seatNumbers: ['20'], passengers: [pax('20', 'male', 'On Time')], tabId: 'pc2' });
  const onTime = await bookingService.confirmBooking({ holdToken: h2.holdToken, tabId: 'pc2', contactPhone: '9876509090', passengers: [pax('20', 'male', 'On Time')], paymentProvider: 'dummy' });

  assert.strictEqual(late.contactDetails.phone, '9779812345678', 'Nepal number stored with +977');

  // Day list (India date) and calendar
  const istKey = new Date(trip.departureTime.getTime() + 330 * 60000).toISOString().slice(0, 10);
  const day = await managerService.listTrips(manager, 'today', istKey);
  assert.ok(day.some((x) => String(x._id) === String(trip._id)), 'trip listed for its date');
  const cal = await managerService.calendar(manager, istKey, 3);
  assert.ok(cal.some((d) => d.date === istKey && d.trips >= 1));

  // Manifest shows booking source, payment status and stop times
  const m = await managerService.manifest(manager, trip._id);
  const row = m.passengers.find((p) => p.seatNumber === '5');
  assert.strictEqual(row.bookedBy, 'CUSTOMER');
  assert.strictEqual(row.paymentStatus, 'COMPLETE');
  assert.strictEqual(m.trip.boardingPoints.length, 2);
  assert.ok(m.trip.bus.busNumber);

  // Passenger is late → moved to the next stop (does not board yet)
  const moved = await managerService.changePoint(manager, trip._id, { pnr: late.pnr, boardingPointId: 'b2', reason: 'Passenger late', clientActionId: 'cp-1' });
  assert.strictEqual(moved.boardingPoint.name, 'Nanpara Chauraha');
  const replay = await managerService.changePoint(manager, trip._id, { pnr: late.pnr, boardingPointId: 'b2', clientActionId: 'cp-1' });
  assert.strictEqual(replay.replayed, true, 'double tap applied once');
  await assert.rejects(managerService.changePoint(manager, trip._id, { pnr: late.pnr, boardingPointId: 'nope' }), /not on this route/);

  // On-time passenger boards; journey starts: only the first-stop passenger can become a no-show.
  await managerService.board(manager, trip._id, { pnr: onTime.pnr, clientActionId: 'bd-1' });
  await managerService.start(manager, trip._id, { clientActionId: 'st-1' });
  let lateDoc = await Booking.findById(late._id).lean();
  assert.strictEqual(lateDoc.passengers[0].journeyStatus, 'NOT_BOARDED', 'passenger expected at next stop is not a no-show');

  // Boards at the next stop, later gets off earlier than booked.
  await managerService.board(manager, trip._id, { pnr: late.pnr, boardingPointId: 'b2', clientActionId: 'bd-2' });
  await managerService.drop(manager, trip._id, { pnr: late.pnr, droppingPointId: 'd2', reason: 'Going further to Surat', clientActionId: 'dr-1' });
  lateDoc = await Booking.findById(late._id).lean();
  assert.strictEqual(lateDoc.passengers[0].boardedAtPoint, 'Nanpara Chauraha');
  assert.strictEqual(lateDoc.passengers[0].droppedAtPoint, 'Surat Central');
  assert.strictEqual(lateDoc.journeyPlan.droppingPoint.name, 'Surat Central');
  assert.strictEqual(lateDoc.boardingPoint.name, 'Rupaidiha Bus Stand', 'booked point kept on the ticket');
  assert.strictEqual(lateDoc.journeyLog.length, 2);

  await new Promise((r) => setTimeout(r, 400));
  const jobs = await NotificationJob.find({ event: 'JOURNEY_POINT_CHANGED', refId: late.bookingId }).lean();
  assert.ok(jobs.some((j) => j.audience === 'PASSENGER' && j.to === '9779812345678'), 'passenger (Nepal number) told on WhatsApp');
  assert.ok(jobs.some((j) => j.body.includes('Nanpara Chauraha')));
  assert.ok(jobs.some((j) => j.body.includes('Vadodara Highway → Surat Central')));
});

test('phone: India / Nepal numbers are normalised and formatted', () => {
  const phone = require('../utils/phone');
  assert.strictEqual(phone.normalisePhone('+91 98765 43210'), '9876543210');
  assert.strictEqual(phone.normalisePhone('9812345678', 'NP'), '9779812345678');
  assert.strictEqual(phone.normalisePhone('+9779812345678'), '9779812345678');
  assert.strictEqual(phone.normalisePhone('9512345678', 'NP'), null);
  assert.strictEqual(phone.normalisePhone('5876543210'), null);
  assert.strictEqual(phone.toInternational('9779812345678'), '9779812345678');
  assert.strictEqual(phone.toInternational('9876543210'), '919876543210');
  assert.strictEqual(phone.formatPhone('9779812345678'), '+977 981-2345678');
});

test('search: shows all buses on a route for the day (every company, scheduled + boarding)', async (t) => {
  if (!connected) return t.skip('MongoDB not available');
  const ownInventory = require('../providers/inventory/OwnInventoryProvider');
  const Company = require('../modules/companies/company.model');

  await Company.updateOne({ companyCode: 1 }, { $setOnInsert: { companyCode: 1, name: 'Company One', slug: `c1-${crypto.randomInt(1e6)}`, status: 'ACTIVE' } }, { upsert: true });
  await Company.updateOne({ companyCode: 2 }, { $setOnInsert: { companyCode: 2, name: 'Company Two', slug: `c2-${crypto.randomInt(1e6)}`, status: 'ACTIVE' } }, { upsert: true });
  const bus2 = await Bus.create({ busNumber: `UP40SRCH${crypto.randomInt(1000, 9999)}`, name: 'Second Coach', companyCode: 2, busType: 'AC Seater (2+2)' });

  // Tomorrow in India time; all three trips are on that India date (independent of the server time zone).
  const { istDateKey } = require('../utils/istDate');
  const day = istDateKey(new Date(Date.now() + 24 * 3600000));
  const hh = (h) => String(h).padStart(2, '0');
  const mk = async (companyCode, busId, hour, status) => Trip.create({
    routeId: fx.route._id, busId, companyCode,
    departureTime: new Date(`${day}T${hh(hour)}:00:00+05:30`),
    arrivalTime: new Date(new Date(`${day}T${hh(hour)}:00:00+05:30`).getTime() + 12 * 3600000),
    baseFare: 1000, status, seats: Trip.generateSeater40Seats(1000)
  });
  const a = await mk(1, fx.bus._id, 7, 'SCHEDULED');     // company 1, scheduled
  const b = await mk(2, bus2._id, 9, 'SCHEDULED');       // company 2, scheduled
  const c = await mk(1, fx.bus._id, 20, 'BOARDING');     // company 1, already boarding but not departed

  const results = await ownInventory.searchTrips({ fromCityId: 'rupaidiha', toCityId: 'ahmedabad', travelDate: day });
  const ids = new Set(results.map((r) => String(r._id)));

  assert.ok(ids.has(String(a._id)), 'company 1 scheduled bus shown');
  assert.ok(ids.has(String(b._id)), 'company 2 bus shown (all companies on the route)');
  assert.ok(ids.has(String(c._id)), 'boarding bus still shown (bookable until departure)');
  const companyCodes = new Set(results.filter((r) => ids.has(String(r._id)) && [String(a._id), String(b._id)].includes(String(r._id))).map((r) => r.companyCode));
  assert.ok(companyCodes.has(1) && companyCodes.has(2), 'buses from both companies are returned');
  assert.ok(results.find((r) => String(r._id) === String(b._id)).companyName === 'Company Two', 'company name on the card');
});

test('search: India-time travel date and departed buses are hidden', async (t) => {
  if (!connected) return t.skip('MongoDB not available');
  const ownInventory = require('../providers/inventory/OwnInventoryProvider');
  const { istDateKey } = require('../utils/istDate');
  const mk = (departureTime, status = 'SCHEDULED') => Trip.create({
    routeId: fx.route._id, busId: fx.bus._id, companyCode: 1,
    departureTime, arrivalTime: new Date(departureTime.getTime() + 12 * 3600000),
    baseFare: 1000, status, seats: Trip.generateSeater40Seats(1000)
  });
  // A date 3 days ahead (India time) and a 02:00 IST bus on it = 20:30 UTC the day before.
  const key = istDateKey(new Date(Date.now() + 3 * 86400000));
  const early = await mk(new Date(`${key}T02:00:00+05:30`));
  const late = await mk(new Date(`${key}T23:30:00+05:30`));
  const prevKey = istDateKey(new Date(new Date(`${key}T12:00:00+05:30`).getTime() - 86400000));

  const onDay = new Set((await ownInventory.searchTrips({ fromCityId: 'rupaidiha', toCityId: 'ahmedabad', travelDate: key })).map((r) => String(r._id)));
  assert.ok(onDay.has(String(early._id)), '02:00 IST bus is on its India date');
  assert.ok(onDay.has(String(late._id)), '23:30 IST bus is on its India date');
  const dayBefore = new Set((await ownInventory.searchTrips({ fromCityId: 'rupaidiha', toCityId: 'ahmedabad', travelDate: prevKey })).map((r) => String(r._id)));
  assert.ok(!dayBefore.has(String(early._id)), 'early bus is not listed on the previous date');

  // Departed an hour ago (still SCHEDULED/BOARDING in the DB): not listed today, not bookable.
  const gone = await mk(new Date(Date.now() - 3600000), 'BOARDING');
  const today = new Set((await ownInventory.searchTrips({ fromCityId: 'rupaidiha', toCityId: 'ahmedabad', travelDate: istDateKey(new Date()) })).map((r) => String(r._id)));
  assert.ok(!today.has(String(gone._id)), 'departed bus is hidden');
  await assert.rejects(bookingService.holdSeats({ tripId: gone._id, seatNumbers: ['1'], passengerId: null }), (e) => e.statusCode === 409);
});

test('manager app: seat layout in manifest; date-wise history incl. mid-route handover', async (t) => {
  if (!connected) return t.skip('MongoDB not available');
  const mgrA = await makeUser('BUS_MANAGER');
  const mgrB = await makeUser('BUS_MANAGER');
  const trip = await makeTrip({ hoursAhead: 1 });
  await Trip.updateOne({ _id: trip._id }, { $set: { managerId: mgrA._id, managerTimeline: [{ managerId: mgrA._id, managerName: 'A', handoverPoint: '', at: new Date() }] } });

  const h = await bookingService.holdSeats({ tripId: trip._id, seatNumbers: ['9'], passengers: [pax('9', 'male', 'Seat Nine')], tabId: 'hist1' });
  const b = await bookingService.confirmBooking({ holdToken: h.holdToken, tabId: 'hist1', contactPhone: '9876507070', passengers: [pax('9', 'male', 'Seat Nine')], paymentProvider: 'dummy' });

  const m = await managerService.manifest(mgrA, trip._id);
  assert.strictEqual(m.trip.layout, 'SEATER');
  assert.strictEqual(m.trip.seats.length, 40, 'every seat of the bus is sent for the seat map');
  const s9 = m.trip.seats.find((x) => x.seatNumber === '9');
  assert.ok(s9.row && s9.column, 'seat position for the layout');
  assert.strictEqual(s9.status, 'BOOKED');

  await managerService.board(mgrA, trip._id, { pnr: b.pnr, clientActionId: 'hist-b1' });
  await managerService.start(mgrA, trip._id, { clientActionId: 'hist-s1' });
  // Mid-route handover A → B, then B completes.
  await Trip.updateOne({ _id: trip._id }, { $set: { managerId: mgrB._id }, $push: { managerTimeline: { managerId: mgrB._id, managerName: 'B', handoverPoint: 'Lucknow', at: new Date() } } });
  await managerService.complete(mgrB, trip._id, { clientActionId: 'hist-c1' });

  const histA = await managerService.history(mgrA, {});
  const rowA = histA.days.flatMap((d) => d.trips).find((x) => String(x._id) === String(trip._id));
  assert.ok(rowA, 'trip in A history even after handing over');
  assert.strictEqual(rowA.role, 'HANDED_OVER');
  assert.strictEqual(rowA.mySegments[0].until, 'Lucknow', 'A ran the bus until the handover stop');
  assert.strictEqual(rowA.status, 'COMPLETED');
  assert.strictEqual(rowA.counts.dropped, 1);

  const histB = await managerService.history(mgrB, {});
  const rowB = histB.days.flatMap((d) => d.trips).find((x) => String(x._id) === String(trip._id));
  assert.strictEqual(rowB.role, 'TOOK_OVER');
  assert.strictEqual(rowB.mySegments[0].from, 'Lucknow');
  assert.ok(histB.days[0].date && histB.days[0].totals.trips >= 1, 'grouped by date with day totals');
  assert.ok(histB.summary.trips >= 1 && histB.summary.completed >= 1);
});
