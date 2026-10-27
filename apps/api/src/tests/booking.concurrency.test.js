const test = require('node:test');
const assert = require('node:assert');
const holdStore = require('../config/holdStore');

test('Concurrency Hold Engine - Prevents Double Booking', async (t) => {
  const tripId = 'trip_test_101';
  const seats = ['S12', 'S13'];

  // User 1 requests hold on seats S12 and S13
  const hold1 = await holdStore.holdSeats({
    tripId,
    seatNumbers: seats,
    passengerDetails: [{ name: 'User 1', gender: 'male' }],
    holdToken: 'TOKEN_USER_1',
    ttlSeconds: 600
  });

  assert.strictEqual(hold1.success, true, 'User 1 should acquire hold successfully');

  // User 2 simultaneously attempts to hold S12 (conflict)
  const hold2 = await holdStore.holdSeats({
    tripId,
    seatNumbers: ['S12', 'S14'],
    passengerDetails: [{ name: 'User 2', gender: 'female' }],
    holdToken: 'TOKEN_USER_2',
    ttlSeconds: 600
  });

  assert.strictEqual(hold2.success, false, 'User 2 must be rejected due to conflict');
  assert.strictEqual(hold2.conflict, true);
  assert.deepStrictEqual(hold2.conflictingSeats, ['S12']);

  // User 1 releases hold
  holdStore.releaseHold('TOKEN_USER_1');

  // User 2 retries after release
  const hold3 = await holdStore.holdSeats({
    tripId,
    seatNumbers: ['S12', 'S14'],
    passengerDetails: [{ name: 'User 2', gender: 'female' }],
    holdToken: 'TOKEN_USER_2',
    ttlSeconds: 600
  });

  assert.strictEqual(hold3.success, true, 'User 2 can now hold after release');

  holdStore.releaseHold('TOKEN_USER_2');
});

test('Company Isolation Guard - Blocks Cross-Tenant Leaks', async (t) => {
  const { requireCompanyScope } = require('../middleware/companyScope.middleware');

  // Mock Request from Owner of Company 1
  const reqOwner1 = {
    user: { role: 'COMPANY_OWNER', companyCode: 1 }
  };
  let nextCalled = false;
  requireCompanyScope(reqOwner1, {}, () => { nextCalled = true; });

  assert.strictEqual(nextCalled, true);
  assert.deepStrictEqual(reqOwner1.companyFilter, { companyCode: 1 }, 'Company filter must be strictly { companyCode: 1 }');
  assert.strictEqual(reqOwner1.effectiveCompanyCode, 1);
});

