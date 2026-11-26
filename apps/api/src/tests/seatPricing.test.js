const test = require('node:test');
const assert = require('node:assert/strict');
const { planFareChanges, MAX_FARE_MULTIPLIER } = require('../services/seatPricing');

test('Seat Pricing Engine - sets fares clamped between 1 and 5x baseFare', () => {
  const baseTrip = {
    _id: 'trip1',
    baseFare: 1000,
    seats: [
      { seatNumber: 'L1', deck: 'LOWER', fare: 1000, status: 'AVAILABLE' },
      { seatNumber: 'L2', deck: 'LOWER', fare: 1000, status: 'AVAILABLE' },
      { seatNumber: 'U1', deck: 'UPPER', fare: 1200, status: 'AVAILABLE' },
      { seatNumber: 'U2', deck: 'UPPER', fare: 1200, status: 'BOOKED' }
    ]
  };

  // 1. Selector UPPER + INCREASE by 200
  const plan1 = planFareChanges(baseTrip, { mode: 'INCREASE', value: 200, valueType: 'AMOUNT' }, { selector: 'UPPER' });
  assert.equal(plan1.changes.length, 1); // U1 changed, U2 skipped because BOOKED
  assert.equal(plan1.changes[0].seatNumber, 'U1');
  assert.equal(plan1.changes[0].before, 1200);
  assert.equal(plan1.changes[0].after, 1400);
  assert.deepEqual(plan1.skippedBooked, ['U2']);

  // 2. Specific seat numbers + SET to 800
  const plan2 = planFareChanges(baseTrip, { mode: 'SET', value: 800, valueType: 'AMOUNT' }, { seatNumbers: ['L1'] });
  assert.equal(plan2.changes.length, 1);
  assert.equal(plan2.changes[0].seatNumber, 'L1');
  assert.equal(plan2.changes[0].after, 800);

  // 3. Clamping: cannot exceed MAX_FARE_MULTIPLIER * baseFare (5000)
  const plan3 = planFareChanges(baseTrip, { mode: 'SET', value: 99999, valueType: 'AMOUNT' }, { seatNumbers: ['L1'] });
  assert.equal(plan3.changes[0].after, 1000 * MAX_FARE_MULTIPLIER);

  // 4. Clamping: cannot drop below ₹1
  const plan4 = planFareChanges(baseTrip, { mode: 'DECREASE', value: 5000, valueType: 'AMOUNT' }, { seatNumbers: ['L1'] });
  assert.equal(plan4.changes[0].after, 1);

  // 5. PERCENT mode: increase LOWER by 10%
  const plan5 = planFareChanges(baseTrip, { mode: 'INCREASE', value: 10, valueType: 'PERCENT' }, { selector: 'LOWER' });
  assert.equal(plan5.changes.length, 2);
  assert.equal(plan5.changes[0].after, 1100);
  assert.equal(plan5.changes[1].after, 1100);
});
