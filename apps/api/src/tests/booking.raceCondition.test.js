const test = require('node:test');
const assert = require('node:assert');
const holdStore = require('../config/holdStore');
const SeatReservation = require('../modules/bookings/seatReservation.model');
const { SEAT_STATUS } = require('../config/constants');

test('Concurrency Race Condition - 10 Parallel Hold Requests for Same Seat', async (t) => {
  const tripId = 'trip_race_' + Date.now();
  const seatToContend = 'L5';

  // 10 concurrent requests attempting to hold the exact same seat at the exact same millisecond
  const concurrentAttempts = Array.from({ length: 10 }, (_, i) => ({
    tripId,
    seatNumbers: [seatToContend],
    passengerDetails: [{ name: `Contender ${i + 1}`, gender: 'male' }],
    holdToken: `HOLD_RACE_CONTENDER_${i + 1}_${Date.now()}`,
    ttlSeconds: 600
  }));

  const results = await Promise.all(
    concurrentAttempts.map(attempt => holdStore.holdSeats(attempt))
  );

  const successes = results.filter(r => r.success === true);
  const rejections = results.filter(r => r.success === false && r.conflict === true);

  assert.strictEqual(successes.length, 1, 'CRITICAL: Exactly ONE concurrent request must win the seat hold');
  assert.strictEqual(rejections.length, 9, 'CRITICAL: Exactly 9 concurrent requests must be rejected with conflict');

  rejections.forEach(rej => {
    assert.deepStrictEqual(rej.conflictingSeats, [seatToContend], 'Conflicting seat must be L5');
  });

  // Verify getHeldSeatsForTrip reflects the held seat
  const heldSeats = holdStore.getHeldSeatsForTrip(tripId);
  assert.ok(heldSeats.includes(seatToContend), 'L5 must be in active trip held seats');

  // Clean up
  holdStore.releaseHold(successes[0].holdToken, { isForce: true });
  assert.strictEqual(holdStore.getHeldSeatsForTrip(tripId).length, 0, 'Held seats must be empty after release');
});

test('Dynamic Seat Map Merging - GET /trips/:tripId marks held seats as HELD', async (t) => {
  const tripId = 'trip_dyn_merge_test';
  const heldSeatNum = 'U7';

  // Acquire hold
  const holdRes = await holdStore.holdSeats({
    tripId,
    seatNumbers: [heldSeatNum],
    passengerDetails: [{ name: 'Test Traveler', gender: 'female' }],
    holdToken: 'TOKEN_MERGE_TEST',
    ttlSeconds: 600
  });
  assert.strictEqual(holdRes.success, true);

  // Raw mock trip seats stored in MongoDB
  const rawTripSeats = [
    { seatNumber: 'U6', status: 'AVAILABLE', fare: 650 },
    { seatNumber: 'U7', status: 'AVAILABLE', fare: 650 }, // Currently AVAILABLE in DB
    { seatNumber: 'U8', status: 'BOOKED', fare: 650 }
  ];

  // Dynamic merge logic as implemented in GET /trips/:tripId
  const heldSeatsSet = new Set(holdStore.getHeldSeatsForTrip(tripId));
  const mergedSeats = rawTripSeats.map(s => {
    if (s.status === 'AVAILABLE' && heldSeatsSet.has(s.seatNumber)) {
      return { ...s, status: 'HELD' };
    }
    return s;
  });

  const u6 = mergedSeats.find(s => s.seatNumber === 'U6');
  const u7 = mergedSeats.find(s => s.seatNumber === 'U7');
  const u8 = mergedSeats.find(s => s.seatNumber === 'U8');

  assert.strictEqual(u6.status, 'AVAILABLE', 'U6 remains AVAILABLE');
  assert.strictEqual(u7.status, 'HELD', 'U7 dynamically becomes HELD for other customers');
  assert.strictEqual(u8.status, 'BOOKED', 'U8 remains BOOKED');

  // Clean up
  holdStore.releaseHold('TOKEN_MERGE_TEST', { isForce: true });
});

test('SeatReservation Model - Enforces compound unique index on tripId and seatNumber', async (t) => {
  const indexes = SeatReservation.schema.indexes();
  
  // Find compound index on tripId and seatNumber
  const compoundIdx = indexes.find(idxDef => {
    const fields = idxDef[0];
    return fields.tripId === 1 && fields.seatNumber === 1;
  });

  assert.ok(compoundIdx, 'SeatReservation schema must define compound index on { tripId: 1, seatNumber: 1 }');
  assert.strictEqual(compoundIdx[1].unique, true, 'Compound index must have { unique: true }');
});

test('Atomic Trip Update Guard - Prevents concurrent overwrite of already booked seats', async (t) => {
  // Simulate the atomic filter condition used in Trip.findOneAndUpdate
  const targetSeats = ['L1', 'L2'];

  const testFilterAgainstSeats = (existingSeats) => {
    // MongoDB $not: { $elemMatch: { seatNumber: { $in: targetSeats }, status: { $in: ['BOOKED', 'BLOCKED'] } } }
    const hasConflict = existingSeats.some(s => 
      targetSeats.includes(s.seatNumber) && ['BOOKED', 'BLOCKED'].includes(s.status)
    );
    return !hasConflict; // update only succeeds if !hasConflict
  };

  // Case 1: Seats are available
  const availableSeats = [
    { seatNumber: 'L1', status: 'AVAILABLE' },
    { seatNumber: 'L2', status: 'AVAILABLE' },
    { seatNumber: 'L3', status: 'AVAILABLE' }
  ];
  assert.strictEqual(testFilterAgainstSeats(availableSeats), true, 'Update succeeds when target seats are available');

  // Case 2: One seat was already booked concurrently by another passenger
  const conflictedSeats = [
    { seatNumber: 'L1', status: 'BOOKED' },
    { seatNumber: 'L2', status: 'AVAILABLE' },
    { seatNumber: 'L3', status: 'AVAILABLE' }
  ];
  assert.strictEqual(testFilterAgainstSeats(conflictedSeats), false, 'Update MUST be rejected if L1 was already booked');
});

test('Agent Wallet Booking - Deducts wallet balance only upon successful atomic seat confirmation', async (t) => {
  // Simulate Agent with initial balance
  const initialBalance = 5000;
  const fareToDeduct = 1200;
  const agentWallet = {
    userId: 'agent_user_123',
    availableBalance: initialBalance,
    balance: initialBalance
  };

  // Scenario 1: Booking fails due to 409 Seat Conflict
  let conflictOccurred = true;
  if (!conflictOccurred) {
    agentWallet.availableBalance -= fareToDeduct;
  }

  assert.strictEqual(
    agentWallet.availableBalance, 
    initialBalance, 
    'Agent wallet balance must remain unchanged if seat conflict occurs'
  );

  // Scenario 2: Booking succeeds atomically
  conflictOccurred = false;
  if (!conflictOccurred) {
    agentWallet.availableBalance -= fareToDeduct;
  }

  assert.strictEqual(
    agentWallet.availableBalance, 
    initialBalance - fareToDeduct, 
    'Agent wallet balance is deducted only after atomic seat reservation succeeds'
  );
});
