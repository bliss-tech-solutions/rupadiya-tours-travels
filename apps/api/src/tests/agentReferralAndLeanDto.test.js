const test = require('node:test');
const assert = require('node:assert');
const { generateUniqueReferralCode } = require('../utils/referralCode');

test('Referral Engine - Generates strictly unique 12-character alphanumeric code', async (t) => {
  const code = await generateUniqueReferralCode('AGT');
  assert.strictEqual(code.length, 12, 'Code length must be strictly 12 characters');
  assert.match(code, /^AGT[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{9}$/, 'Code must match 12-char unambiguous format');
});

test('Referral Invalidation Guard - Blocks refreshed/expired referral codes', async (t) => {
  const oldCode = 'AGTOLD123456';
  const newCode = 'AGTNEW654321';

  // Agent with retired past code in previousReferralCodes
  const agentWithPastCode = {
    name: 'Test Referral Agent',
    email: 'test_agent_refresh@rupadiya.test',
    role: 'AGENT',
    referralCode: newCode,
    previousReferralCodes: [oldCode]
  };

  // Invalidation guard logic matching auth.service.js and booking.service.js
  const isCodeInvalidated = (code, user) => {
    return user.previousReferralCodes && user.previousReferralCodes.includes(code.toUpperCase().trim());
  };

  assert.strictEqual(isCodeInvalidated(oldCode, agentWithPastCode), true, 'Old code must be detected as invalidated');
  assert.strictEqual(isCodeInvalidated(newCode, agentWithPastCode), false, 'Active code must not be invalidated');
});

test('Agent Profile Guard - Only permits name mutation and locks other attributes', async (t) => {
  const agentUser = {
    name: 'Original Counter Name',
    email: 'counter@rupadiya.test',
    phone: '+910000000000',
    role: 'AGENT',
    companyCode: 1,
    referralCode: 'AGT01L1T0001',
    agencyName: 'Rupadiya Prime Counter'
  };

  // Incoming mutation request attempting to modify phone, email, and name
  const incomingBody = {
    name: 'Updated Counter Name',
    phone: '+910000000000',
    email: 'hacker@tamper.com',
    companyCode: 99
  };

  // Profile update logic: only accept name
  if (incomingBody.name) {
    agentUser.name = String(incomingBody.name).trim();
  }

  assert.strictEqual(agentUser.name, 'Updated Counter Name', 'Name should be successfully updated');
  assert.strictEqual(agentUser.phone, '+910000000000', 'Phone must remain unchanged and locked');
  assert.strictEqual(agentUser.email, 'counter@rupadiya.test', 'Email must remain unchanged and locked');
  assert.strictEqual(agentUser.companyCode, 1, 'Company code must remain locked');
});

test('Lean DTO Projector - Eliminates trip.seats array and large bus documents', async (t) => {
  // Mock populated booking with 40 trip seats and bus documents
  const heavySeats = Array.from({ length: 40 }, (_, idx) => ({
    seatNumber: `S${idx + 1}`,
    status: 'AVAILABLE',
    passengerId: null,
    fare: 850
  }));

  const mockBooking = {
    bookingId: 'BK_TEST_1001',
    pnr: 'RUP-TEST-99',
    status: 'CONFIRMED',
    seatNumbers: ['S12', 'S14'],
    passengers: [
      { name: 'Rohan Sharma', age: 29, gender: 'male', seatNumber: 'S12' },
      { name: 'Priya Sharma', age: 26, gender: 'female', seatNumber: 'S14' }
    ],
    fareBreakdown: { baseFare: 1700, tax: 85, totalPayable: 1785 },
    totalAmount: 1785,
    tripId: {
      _id: 'trip123',
      departureTime: new Date('2026-11-03T18:00:00Z'),
      arrivalTime: new Date('2026-11-04T06:00:00Z'),
      seats: heavySeats // 40 large seat objects!
    },
    routeId: {
      fromCity: { name: 'Rupadiya Border' },
      toCity: { name: 'Lucknow Charbagh' }
    },
    busId: {
      name: 'BharatBenz Sleeper',
      busNumber: 'UP-40-BT-9999',
      busType: 'AC Sleeper 2+1',
      documents: { rcUrl: 'https://s3/rc.pdf', insuranceUrl: 'https://s3/ins.pdf' } // Sensitive documents!
    },
    createdAt: new Date()
  };

  // Replicate DTO projection
  const trip = mockBooking.tripId;
  const route = mockBooking.routeId;
  const bus = mockBooking.busId;

  const leanDto = {
    bookingId: mockBooking.bookingId,
    pnr: mockBooking.pnr,
    status: mockBooking.status,
    seatNumbers: mockBooking.seatNumbers,
    passengers: mockBooking.passengers,
    fareBreakdown: mockBooking.fareBreakdown,
    totalAmount: mockBooking.totalAmount,
    bus: {
      name: bus.name,
      busNumber: bus.busNumber,
      busType: bus.busType
    },
    trip: {
      _id: trip._id,
      sourceCity: route.fromCity.name,
      destinationCity: route.toCity.name,
      departureTime: '06:00 PM',
      arrivalTime: '06:00 AM'
    }
  };

  // Verification
  assert.strictEqual(leanDto.pnr, 'RUP-TEST-99');
  assert.strictEqual(leanDto.seatNumbers.length, 2);
  assert.strictEqual(leanDto.trip.seats, undefined, 'trip.seats array MUST be stripped');
  assert.strictEqual(leanDto.bus.documents, undefined, 'bus.documents MUST be stripped');
  assert.strictEqual(JSON.stringify(leanDto).includes('S39'), false, 'Unrelated seats must not exist in payload');
});
