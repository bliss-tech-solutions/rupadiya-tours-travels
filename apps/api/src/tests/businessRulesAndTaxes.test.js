const test = require('node:test');
const assert = require('node:assert');
const { DEFAULT_COMMISSION_TIERS, DEFAULT_BONUS_PER_SEAT, DEFAULT_TCS_RATE, DEFAULT_GST_RATE } = require('../config/constants');
const Bus = require('../modules/fleet/bus.model');
const websocketService = require('../services/websocket.service');

test('Business Rules - 5-Level Commission Tier Rates and Bonus Configuration', () => {
  assert.strictEqual(DEFAULT_COMMISSION_TIERS.length, 5, 'Must have exactly 5 tiers');
  
  // Verify tier rates match PDF page 5 rule 1
  const l1 = DEFAULT_COMMISSION_TIERS.find(t => t.level === 1);
  const l2 = DEFAULT_COMMISSION_TIERS.find(t => t.level === 2);
  const l3 = DEFAULT_COMMISSION_TIERS.find(t => t.level === 3);
  const l4 = DEFAULT_COMMISSION_TIERS.find(t => t.level === 4);
  const l5 = DEFAULT_COMMISSION_TIERS.find(t => t.level === 5);

  assert.strictEqual(l1.ratePerSeat, 100, 'Level 1 must be ₹100');
  assert.strictEqual(l2.ratePerSeat, 100, 'Level 2 must be ₹100');
  assert.strictEqual(l3.ratePerSeat, 100, 'Level 3 must be ₹100');
  assert.strictEqual(l4.ratePerSeat, 200, 'Level 4 must be ₹200');
  assert.strictEqual(l5.ratePerSeat, 300, 'Level 5 must be ₹300');

  assert.strictEqual(DEFAULT_BONUS_PER_SEAT, 20, 'Configurable bonus per seat default must be ₹20');
  assert.strictEqual(DEFAULT_TCS_RATE, 0.01, 'TCS deduction must be exactly 1%');
  assert.strictEqual(DEFAULT_GST_RATE, 0.05, 'Passenger ticket GST must be exactly 5%');

  // Verify calculation for 2 seats booked on Level 1
  const seatCount = 2;
  const effectiveRateL1 = l1.ratePerSeat + DEFAULT_BONUS_PER_SEAT; // 120
  const gross = effectiveRateL1 * seatCount; // 240
  const tcs = Math.round(gross * DEFAULT_TCS_RATE); // 2
  const net = gross - tcs; // 238

  assert.strictEqual(gross, 240, 'Gross commission for 2 seats at Level 1 should be ₹240');
  assert.strictEqual(tcs, 2, '1% TCS on ₹240 should round to ₹2');
  assert.strictEqual(net, 238, 'Net credited to agent wallet should be ₹238');
});

test('Business Rules - Bus Legal Paper Expiry Guard (30-day policy)', () => {
  // Compliant bus with valid documents
  const validBus = new Bus({
    busNumber: 'UP-40-TEST-001',
    name: 'BharatBenz Luxury',
    companyCode: 1,
    busType: 'AC Sleeper (2+1)',
    documents: {
      rcExpiry: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      insuranceExpiry: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      fitnessCert: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      permitExpiry: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      pucExpiry: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      roadTaxExpiry: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      driverLicenseExpiry: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
    }
  });

  const validCompliance = validBus.checkCompliance();
  assert.strictEqual(validCompliance.isCompliant, true, 'Valid documents bus must be compliant');
  assert.strictEqual(validCompliance.expiredDocs.length, 0);

  // Expired bus (e.g. expired RC and insurance)
  const expiredBus = new Bus({
    busNumber: 'UP-40-TEST-002',
    name: 'Setra Coach',
    companyCode: 2,
    busType: 'AC Seater 2+2',
    documents: {
      rcExpiry: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // Expired 5 days ago
      insuranceExpiry: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // Expired 10 days ago
      fitnessCert: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      permitExpiry: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
    }
  });

  const expiredCompliance = expiredBus.checkCompliance();
  assert.strictEqual(expiredCompliance.isCompliant, false, 'Expired bus must NOT be compliant');
  assert.ok(expiredCompliance.expiredDocs.includes('RC'), 'Should detect expired RC');
  assert.ok(expiredCompliance.expiredDocs.includes('Insurance'), 'Should detect expired Insurance');
});

test('WebSocket Engine - Room Management and Subscription Interface', () => {
  // Test joinRoom and leaveRoom logic
  const mockWs = { send: () => {}, isAlive: true };
  websocketService.clients.set(mockWs, new Set());

  websocketService.joinRoom(mockWs, 'company:1');
  websocketService.joinRoom(mockWs, 'trip:TRP-101');

  assert.ok(websocketService.rooms.has('company:1'), 'Room company:1 should exist');
  assert.ok(websocketService.rooms.get('company:1').has(mockWs), 'mockWs should be in company:1');

  websocketService.leaveRoom(mockWs, 'trip:TRP-101');
  assert.strictEqual(websocketService.rooms.has('trip:TRP-101'), false, 'Empty room should be pruned');

  websocketService.cleanupClient(mockWs);
  assert.strictEqual(websocketService.rooms.has('company:1'), false, 'Client cleanup should prune room');
  assert.strictEqual(websocketService.clients.has(mockWs), false, 'Client should be unregistered');
});

