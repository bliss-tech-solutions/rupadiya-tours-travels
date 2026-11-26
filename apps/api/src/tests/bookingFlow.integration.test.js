/**
 * End-to-end integration tests for the money & inventory paths against a real MongoDB.
 *
 * Uses an isolated, randomly named database that is dropped afterwards.
 * Skips automatically when no MongoDB is reachable (set MONGODB_TEST_URI to override).
 */
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const mongoose = require('mongoose');

const BASE_URI = process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = `rupadiya_it_${crypto.randomBytes(4).toString('hex')}`;

const Trip = require('../modules/trips/trip.model');
const Route = require('../modules/routes/route.model');
const Bus = require('../modules/fleet/bus.model');
const User = require('../modules/users/user.model');
const Booking = require('../modules/bookings/booking.model');
const SeatReservation = require('../modules/bookings/seatReservation.model');
const Payment = require('../modules/payments/payment.model');
const { Wallet, WalletLedger } = require('../modules/wallets/wallet.model');
const { CommissionRecord } = require('../modules/commissions/commission.model');
const bookingService = require('../modules/bookings/booking.service');
const paymentService = require('../modules/payments/payment.service');
const walletLedger = require('../services/walletLedger.service');
const holdStore = require('../config/holdStore');

// Never talk to the real gateway from tests.
paymentService.keyId = '';
paymentService.keySecret = '';

let connected = false;
let fx = {};

async function makeUser(role, extra = {}) {
  const id = crypto.randomBytes(4).toString('hex');
  return User.create({
    name: `${role} ${id}`,
    email: `${role.toLowerCase()}_${id}@it.test`,
    phone: `9${crypto.randomInt(100000000, 999999999)}`,
    passwordHash: 'x',
    role,
    companyCode: 1,
    ...extra
  });
}

async function makeTrip() {
  const trip = await Trip.create({
    routeId: fx.route._id,
    busId: fx.bus._id,
    companyCode: 1,
    departureTime: new Date(Date.now() + 72 * 3600 * 1000),
    arrivalTime: new Date(Date.now() + 84 * 3600 * 1000),
    baseFare: 1000,
    seats: Trip.generateSeater40Seats(1000)
  });
  return trip;
}

const pax = (seatNumber, gender = 'male', name = 'Test Traveller') => ({ seatNumber, name, age: 30, gender });

test.before(async () => {
  try {
    await mongoose.connect(BASE_URI, { dbName: DB_NAME, serverSelectionTimeoutMS: 2000 });
    connected = true;
  } catch (e) {
    connected = false;
    return;
  }
  await Promise.all([SeatReservation.init(), Booking.init(), WalletLedger.init(), Wallet.init(), CommissionRecord.init(), Payment.init()]);

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
  fx.bus = await Bus.create({
    busNumber: `UP40IT${crypto.randomInt(1000, 9999)}`,
    name: 'IT Coach',
    companyCode: 1,
    busType: 'AC Seater (2+2)'
  });
});

test.after(async () => {
  if (connected) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  holdStore.destroy();
});

test('hold → second customer is rejected for the same seat; clientRef is echoed', async (t) => {
  if (!connected) return t.skip('MongoDB not available');
  const trip = await makeTrip();
  const ws = require('../services/websocket.service');
  const seen = [];
  const original = ws.broadcastSeatHeld.bind(ws);
  ws.broadcastSeatHeld = (...args) => { seen.push(args); };

  const a = await bookingService.holdSeats({ tripId: trip._id, seatNumbers: ['5'], tabId: 'tabA', clientRef: 'ref-A' });
  assert.ok(a.holdToken);
  assert.strictEqual(seen[0][3], 'ref-A', 'clientRef must be broadcast so the owner can recognise its own hold');

  await assert.rejects(
    bookingService.holdSeats({ tripId: trip._id, seatNumbers: ['5'], tabId: 'tabB' }),
    (err) => err.statusCode === 409
  );
  ws.broadcastSeatHeld = original;
  holdStore.releaseHold(a.holdToken, { isForce: true });
});

test('ladies-seat rule: male cannot take the seat next to a booked female, female can (any channel)', async (t) => {
  if (!connected) return t.skip('MongoDB not available');
  const trip = await makeTrip();

  // Seat 1 booked by a female passenger.
  const h1 = await bookingService.holdSeats({ tripId: trip._id, seatNumbers: ['1'], tabId: 'tab1' });
  await bookingService.confirmBooking({
    holdToken: h1.holdToken, tabId: 'tab1', contactPhone: '9876543210',
    passengers: [pax('1', 'female', 'Asha')], paymentProvider: 'dummy'
  });

  // Male on seat 2 is rejected at hold time…
  await assert.rejects(
    bookingService.holdSeats({ tripId: trip._id, seatNumbers: ['2'], passengers: [pax('2', 'male')], tabId: 't2' }),
    (err) => err.statusCode === 422 && err.code === 'LADIES_SEAT_POLICY'
  );

  // …and also at confirm time even if the hold had no manifest (agent flow).
  const agent = await makeUser('AGENT');
  await walletLedger.credit({ userId: agent._id, amount: 5000, transactionType: 'WALLET_DEPOSIT', referenceType: 'DEPOSIT', referenceId: 'seed', description: 'seed', idempotencyKey: `seed_${agent._id}` });
  const h2 = await bookingService.holdSeats({ tripId: trip._id, seatNumbers: ['2'], passengerId: agent._id });
  await assert.rejects(
    bookingService.confirmBooking({
      holdToken: h2.holdToken, passengerId: agent._id, agentUserId: agent._id, contactPhone: '9876543211',
      passengers: [pax('2', 'male')], paymentProvider: 'agent_wallet', channel: 'AGENT_PORTAL'
    }),
    (err) => err.statusCode === 422
  );
  const walletAfterReject = await Wallet.findOne({ userId: agent._id });
  assert.strictEqual(walletAfterReject.availableBalance, 5000, 'no money may move on a rejected booking');

  // Agent CAN sell the seat to a female passenger.
  const ok = await bookingService.confirmBooking({
    holdToken: h2.holdToken, passengerId: agent._id, agentUserId: agent._id, contactPhone: '9876543211',
    passengers: [pax('2', 'female', 'Meena')], paymentProvider: 'agent_wallet', channel: 'AGENT_PORTAL'
  });
  assert.strictEqual(ok.status, 'CONFIRMED');
});

test('agent wallet: exact debit, ledger row, commission credited, no overdraft under concurrency', async (t) => {
  if (!connected) return t.skip('MongoDB not available');
  const trip = await makeTrip();
  const agent = await makeUser('AGENT');
  // Enough for ONE ticket of 1100 (1000 fare + 5% GST + 5% platform fee) only.
  await walletLedger.credit({ userId: agent._id, amount: 1500, transactionType: 'WALLET_DEPOSIT', referenceType: 'DEPOSIT', referenceId: 'seed', description: 'seed', idempotencyKey: `seed_${agent._id}` });

  const h1 = await bookingService.holdSeats({ tripId: trip._id, seatNumbers: ['9'], passengerId: agent._id });
  const h2 = await bookingService.holdSeats({ tripId: trip._id, seatNumbers: ['10'], passengerId: agent._id });

  const results = await Promise.allSettled([h1, h2].map((h, i) => bookingService.confirmBooking({
    holdToken: h.holdToken, passengerId: agent._id, agentUserId: agent._id, contactPhone: '9876500000',
    passengers: [pax(h.seatNumbers[0])], paymentProvider: 'agent_wallet', channel: 'AGENT_PORTAL'
  })));

  const ok = results.filter((r) => r.status === 'fulfilled');
  const failed = results.filter((r) => r.status === 'rejected');
  assert.strictEqual(ok.length, 1, 'exactly one ticket can be paid');
  assert.strictEqual(failed[0].reason.code, 'INSUFFICIENT_BALANCE');

  const wallet = await Wallet.findOne({ userId: agent._id });
  const commission = (100 + 20) - Math.round((100 + 20) * 0.01); // L1 default tier, 1 seat
  assert.strictEqual(wallet.availableBalance, 1500 - 1100 + commission);

  const debits = await WalletLedger.find({ userId: agent._id, entryType: 'DEBIT' });
  assert.strictEqual(debits.length, 1);
  assert.strictEqual(debits[0].amount, 1100);

  // The losing seat must be free again (compensation on standalone MongoDB).
  const freshTrip = await Trip.findById(trip._id);
  const loserSeat = failed[0].reason && (ok[0].value.seatNumbers[0] === '9' ? '10' : '9');
  assert.strictEqual(freshTrip.seats.find((s) => s.seatNumber === loserSeat).status, 'AVAILABLE');
  assert.strictEqual(await SeatReservation.countDocuments({ tripId: trip._id, seatNumber: loserSeat }), 0);
});

test('double booking is impossible even if two holds slip through for one seat', async (t) => {
  if (!connected) return t.skip('MongoDB not available');
  const trip = await makeTrip();
  // Simulate two holds on the same seat (e.g. two API nodes with separate memory).
  const tokens = ['HOLD_X1', 'HOLD_X2'];
  for (const [i, token] of tokens.entries()) {
    holdStore.seatLocks.delete(`${trip._id}:13`);
    await holdStore.holdSeats({ tripId: String(trip._id), seatNumbers: ['13'], holdToken: token, tabId: `tab${i}`, ttlSeconds: 60 });
  }
  const results = await Promise.allSettled(tokens.map((token, i) => bookingService.confirmBooking({
    holdToken: token, tabId: `tab${i}`, contactPhone: '9876511111',
    passengers: [pax('13')], paymentProvider: 'dummy'
  })));
  assert.strictEqual(results.filter((r) => r.status === 'fulfilled').length, 1, 'exactly one ticket per seat');
  assert.strictEqual(await Booking.countDocuments({ tripId: trip._id, seatNumbers: '13', status: 'CONFIRMED' }), 1);
});

test('cancel twice concurrently → refund and fee credited exactly once', async (t) => {
  if (!connected) return t.skip('MongoDB not available');
  const trip = await makeTrip();
  const agent = await makeUser('AGENT');
  await walletLedger.credit({ userId: agent._id, amount: 5000, transactionType: 'WALLET_DEPOSIT', referenceType: 'DEPOSIT', referenceId: 'seed', description: 'seed', idempotencyKey: `seed_${agent._id}` });
  const h = await bookingService.holdSeats({ tripId: trip._id, seatNumbers: ['20'], passengerId: agent._id });
  const booking = await bookingService.confirmBooking({
    holdToken: h.holdToken, passengerId: agent._id, agentUserId: agent._id, contactPhone: '9876522222',
    passengers: [pax('20')], paymentProvider: 'agent_wallet', channel: 'AGENT_PORTAL'
  });
  const before = (await Wallet.findOne({ userId: agent._id })).availableBalance;

  const results = await Promise.allSettled([1, 2].map(() => bookingService.cancelBooking({ bookingId: booking.bookingId, reason: 'test', cancelledByUserId: agent._id })));
  assert.strictEqual(results.filter((r) => r.status === 'fulfilled').length, 1);

  const ok = results.find((r) => r.status === 'fulfilled').value;
  assert.strictEqual(ok.refundAmount, Math.round(1050 * 0.9)); // > 48h before departure
  const after = (await Wallet.findOne({ userId: agent._id })).availableBalance;
  const commission = 120 - Math.round(120 * 0.01);
  assert.strictEqual(after, before + ok.refundAmount - commission, 'refund once, commission clawed back once');

  const freshTrip = await Trip.findById(trip._id);
  assert.strictEqual(freshTrip.seats.find((s) => s.seatNumber === '20').status, 'AVAILABLE');
});

test('gateway payment: concurrent verify issues one ticket; reused payment is refused', async (t) => {
  if (!connected) return t.skip('MongoDB not available');
  const trip = await makeTrip();
  const h = await bookingService.holdSeats({ tripId: trip._id, seatNumbers: ['30'], passengers: [pax('30')], tabId: 'pay-tab' });
  const order = await paymentService.createOrder({
    amount: h.quote.totalPayable,
    purpose: 'TICKET_BOOKING',
    companyCode: 1,
    metadata: {
      holdToken: h.holdToken, tripId: String(trip._id), seatNumbers: h.seatNumbers,
      passengers: [pax('30')], contactPhone: '9876533333', channel: 'USER_WEB'
    }
  });

  const results = await Promise.allSettled([1, 2, 3].map(() => paymentService.verifyAndFulfill({
    orderId: order.orderId, paymentId: 'pay_sim_concurrent', signature: 'sig_sim'
  })));
  assert.ok(results.every((r) => r.status === 'fulfilled'));
  assert.strictEqual(await Booking.countDocuments({ tripId: trip._id, status: 'CONFIRMED' }), 1, 'one payment → one ticket');

  const payment = await Payment.findOne({ orderId: order.orderId });
  assert.ok(payment.consumedByBooking);
  assert.strictEqual(payment.fulfillmentStatus, 'FULFILLED');

  // Re-using the same captured payment for another booking must fail.
  const h2 = await bookingService.holdSeats({ tripId: trip._id, seatNumbers: ['31'], tabId: 'pay-tab2' });
  await assert.rejects(
    bookingService.confirmBooking({
      holdToken: h2.holdToken, contactPhone: '9876533333', passengers: [pax('31')],
      paymentProvider: 'razorpay', paymentDetails: { orderId: order.orderId, paymentId: 'pay_sim_concurrent' }, trustedPayment: true
    }),
    (err) => err.code === 'PAYMENT_NOT_USABLE'
  );
});

test('gateway payment for a seat taken meanwhile is auto-refunded, not lost', async (t) => {
  if (!connected) return t.skip('MongoDB not available');
  const trip = await makeTrip();
  const h = await bookingService.holdSeats({ tripId: trip._id, seatNumbers: ['33'], passengers: [pax('33')], tabId: 'late-tab' });
  const order = await paymentService.createOrder({
    amount: h.quote.totalPayable,
    purpose: 'TICKET_BOOKING',
    companyCode: 1,
    metadata: { holdToken: h.holdToken, tripId: String(trip._id), seatNumbers: h.seatNumbers, passengers: [pax('33')], contactPhone: '9876544444' }
  });

  // Hold expires and someone else books seat 33 before the payment callback arrives.
  holdStore.releaseHold(h.holdToken, { isForce: true });
  const other = await bookingService.holdSeats({ tripId: trip._id, seatNumbers: ['33'], tabId: 'other' });
  await bookingService.confirmBooking({ holdToken: other.holdToken, tabId: 'other', contactPhone: '9876555555', passengers: [pax('33')], paymentProvider: 'dummy' });

  await assert.rejects(
    paymentService.verifyAndFulfill({ orderId: order.orderId, paymentId: 'pay_sim_late', signature: 'sig_sim' }),
    (err) => /refunded/i.test(err.message)
  );
  const payment = await Payment.findOne({ orderId: order.orderId });
  assert.strictEqual(payment.fulfillmentStatus, 'FAILED_REFUNDED');
  assert.strictEqual(payment.status, 'REFUNDED');
});

test('wallet ledger is idempotent and never overdraws', async (t) => {
  if (!connected) return t.skip('MongoDB not available');
  const u = await makeUser('AGENT');
  const key = `idem_${u._id}`;
  await Promise.all([1, 2, 3, 4, 5].map(() => walletLedger.credit({
    userId: u._id, amount: 100, transactionType: 'WALLET_DEPOSIT', referenceType: 'DEPOSIT', referenceId: 'r', description: 'd', idempotencyKey: key
  })));
  assert.strictEqual((await Wallet.findOne({ userId: u._id })).availableBalance, 100);

  const debits = await Promise.allSettled([1, 2, 3].map((i) => walletLedger.debit({
    userId: u._id, amount: 60, transactionType: 'TICKET_PURCHASE', referenceType: 'BOOKING', referenceId: `b${i}`, description: 'd', idempotencyKey: `d_${u._id}_${i}`
  })));
  assert.strictEqual(debits.filter((r) => r.status === 'fulfilled').length, 1);
  assert.strictEqual((await Wallet.findOne({ userId: u._id })).availableBalance, 40);
});
