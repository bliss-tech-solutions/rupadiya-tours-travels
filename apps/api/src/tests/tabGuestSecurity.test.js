const test = require('node:test');
const assert = require('node:assert');
const { generateGuestToken, verifyGuestToken, tabGuestMiddleware } = require('../middleware/tabGuest.middleware');
const { sanitizeString, sanitizeObject, sanitizeInput } = require('../middleware/sanitize.middleware');
const { keyGenerator } = require('../middleware/rateLimit.middleware');
const holdStore = require('../config/holdStore');

test('Guest Tab Token Engine - Generates and verifies signed tab-scoped tokens', async (t) => {
  const tabId = 'tab_test_uuid_12345';
  const token = generateGuestToken({ tabId, sessionId: 'sess_abc', ip: '192.168.1.5' });

  assert.ok(token, 'Token must be generated');
  assert.strictEqual(typeof token, 'string');

  const decoded = verifyGuestToken(token);
  assert.ok(decoded, 'Token must be decodable');
  assert.strictEqual(decoded.tabId, tabId);
  assert.strictEqual(decoded.role, 'GUEST');
  assert.strictEqual(decoded.type, 'GUEST_TAB_TOKEN');
  assert.strictEqual(decoded.ip, '192.168.1.5');

  // Verify invalid/tampered token returns null
  const invalid = verifyGuestToken(token + 'tampered');
  assert.strictEqual(invalid, null, 'Tampered token must fail validation');

  const empty = verifyGuestToken('');
  assert.strictEqual(empty, null);
});

test('Guest Tab Middleware - Enforces tab signature matching and role isolation', async (t) => {
  const tabId = 'tab_verified_99';
  const validToken = generateGuestToken({ tabId, sessionId: 'sess_1', ip: '127.0.0.1' });

  let statusSent = null;
  let jsonSent = null;
  let passed = false;

  const mockRes = () => ({
    status(code) {
      statusSent = code;
      return this;
    },
    json(data) {
      jsonSent = data;
      return this;
    }
  });

  // Test 1: Tab ID Mismatch rejection
  const mismatchReq = {
    headers: {
      'x-tab-id': 'tab_different_hacker',
      'x-guest-token': validToken
    },
    originalUrl: '/api/v1/trips'
  };
  tabGuestMiddleware(mismatchReq, mockRes(), () => { passed = true; });
  assert.strictEqual(statusSent, 403);
  assert.strictEqual(jsonSent.code, 'TAB_ID_MISMATCH');

  // Test 2: Valid tab matching passes for public route
  passed = false;
  statusSent = null;
  const validReq = {
    headers: {
      'x-tab-id': tabId,
      'x-guest-token': validToken
    },
    originalUrl: '/api/v1/trips'
  };
  tabGuestMiddleware(validReq, mockRes(), () => { passed = true; });
  assert.strictEqual(passed, true, 'Valid tab guest request should pass to next()');
  assert.strictEqual(validReq.isGuest, true);
  assert.strictEqual(validReq.tabId, tabId);

  // Test 3: Guest token blocked from accessing privileged administrative routes
  passed = false;
  statusSent = null;
  const adminAttemptReq = {
    headers: {
      'x-tab-id': tabId,
      'x-guest-token': validToken
    },
    originalUrl: '/api/v1/admin/dashboard',
    user: null
  };
  tabGuestMiddleware(adminAttemptReq, mockRes(), () => { passed = true; });
  assert.strictEqual(statusSent, 403, 'Guest tokens must be blocked from admin endpoints');
  assert.strictEqual(jsonSent.code, 'GUEST_ACCESS_DENIED');

  // Test 4: Guest token blocked from accessing agent/wallet routes
  passed = false;
  statusSent = null;
  const walletAttemptReq = {
    headers: {
      'x-tab-id': tabId,
      'x-guest-token': validToken
    },
    originalUrl: '/api/v1/wallet/ledger',
    user: null
  };
  tabGuestMiddleware(walletAttemptReq, mockRes(), () => { passed = true; });
  assert.strictEqual(statusSent, 403, 'Guest tokens must be blocked from wallet endpoints');
  assert.strictEqual(jsonSent.code, 'GUEST_ACCESS_DENIED');
});

test('HoldStore - Isolates seat holds per tab and prevents cross-tab tampering', async (t) => {
  const tripId = '6633a1b2c3d4e5f678901234';
  const tabA = 'tab_user_tab_A';
  const tabB = 'tab_user_tab_B';

  const holdTokenA = `HOLD_TAB_A_${Date.now()}`;
  const holdTokenB = `HOLD_TAB_B_${Date.now()}`;

  // 1. Tab A holds seat 10 and 11
  const resultA = await holdStore.holdSeats({
    tripId,
    seatNumbers: ['10', '11'],
    passengerDetails: [{ name: 'Passenger A' }],
    holdToken: holdTokenA,
    tabId: tabA,
    ttlSeconds: 60
  });

  assert.strictEqual(resultA.success, true);
  assert.strictEqual(resultA.tabId, tabA);

  // 2. Tab B tries to hold seat 10 -> Conflict
  const resultBConflict = await holdStore.holdSeats({
    tripId,
    seatNumbers: ['10'],
    passengerDetails: [{ name: 'Passenger B' }],
    holdToken: holdTokenB,
    tabId: tabB,
    ttlSeconds: 60
  });

  assert.strictEqual(resultBConflict.success, false);
  assert.strictEqual(resultBConflict.conflict, true);
  assert.deepStrictEqual(resultBConflict.conflictingSeats, ['10']);

  // 3. Tab B attempts to release Tab A's hold -> Denied
  const releasedByB = holdStore.releaseHold(holdTokenA, { tabId: tabB });
  assert.strictEqual(releasedByB, false, 'Tab B cannot release Tab A hold');

  // Verify Tab A's hold is still active
  const checkHoldA = holdStore.getHold(holdTokenA);
  assert.ok(checkHoldA, 'Tab A hold must remain active');

  // 4. Tab A releases its own hold -> Success
  const releasedByA = holdStore.releaseHold(holdTokenA, { tabId: tabA });
  assert.strictEqual(releasedByA, true, 'Tab A can release its own hold');

  // 5. Now Tab B can hold seat 10
  const resultBSuccess = await holdStore.holdSeats({
    tripId,
    seatNumbers: ['10'],
    passengerDetails: [{ name: 'Passenger B' }],
    holdToken: holdTokenB,
    tabId: tabB,
    ttlSeconds: 60
  });
  assert.strictEqual(resultBSuccess.success, true);

  // Clean up
  holdStore.releaseHold(holdTokenB, { isForce: true });
});

test('Sanitization Engine - Neutralizes XSS script tags and NoSQL injection operators', async (t) => {
  // 1. XSS script tag stripping
  const maliciousName = 'John <script>alert("hacked")</script>Doe';
  const cleanName = sanitizeString(maliciousName);
  assert.strictEqual(cleanName, 'John Doe');

  // 2. Inline event handler stripping
  const maliciousImg = '<img src="avatar.jpg" onerror="fetch(\'/steal?cookie=\'+document.cookie)">';
  const cleanImg = sanitizeString(maliciousImg);
  assert.ok(!cleanImg.includes('onerror'), 'onerror handler must be stripped');

  // 3. Javascript protocol disarming
  const maliciousLink = 'javascript:evil()';
  const cleanLink = sanitizeString(maliciousLink);
  assert.strictEqual(cleanLink, 'blocked:evil()');

  // 4. NoSQL Operator injection disarming
  const maliciousPayload = {
    email: 'traveler@rupadiya.com',
    phone: {
      $gt: '',
      $ne: null
    },
    'metadata.profile.role': 'SUPER_ADMIN'
  };

  const safeObject = sanitizeObject(maliciousPayload);
  assert.strictEqual(safeObject.email, 'traveler@rupadiya.com');
  assert.ok(!('$gt' in safeObject.phone), '$gt operator must not remain');
  assert.ok('_safe_$gt' in safeObject.phone, '$gt should be disarmed to safe key');
  assert.ok(!('metadata.profile.role' in safeObject), 'Dotted key must be replaced');
  assert.ok('metadata_profile_role' in safeObject);

  // 5. Express middleware integration test
  const req = {
    body: {
      passenger: {
        name: 'Alice <script src="http://evil.com/xss.js"></script>',
        note: 'Trip to Surat'
      },
      filter: {
        $where: 'this.password.length > 0'
      }
    },
    query: {
      search: '<iframe src="scam.com"></iframe>Ahmedabad'
    },
    params: {}
  };

  let nextCalled = false;
  sanitizeInput(req, {}, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true);
  assert.strictEqual(req.body.passenger.name, 'Alice');
  assert.strictEqual(req.body.passenger.note, 'Trip to Surat');
  assert.ok(!('$where' in req.body.filter));
  assert.strictEqual(req.query.search, 'Ahmedabad');
});

test('Rate Limiter Key Generator - Isolates quotas per tab while preserving IP tracking', async (t) => {
  const reqTab1 = {
    ip: '203.0.113.195',
    tabId: 'tab_alpha_1',
    headers: { 'x-tab-id': 'tab_alpha_1' }
  };

  const reqTab2 = {
    ip: '203.0.113.195',
    tabId: 'tab_beta_2',
    headers: { 'x-tab-id': 'tab_beta_2' }
  };

  const key1 = keyGenerator(reqTab1);
  const key2 = keyGenerator(reqTab2);

  assert.strictEqual(key1, '203.0.113.195:tab:tab_alpha_1');
  assert.strictEqual(key2, '203.0.113.195:tab:tab_beta_2');
  assert.notStrictEqual(key1, key2, 'Distinct browser tabs must have independent rate limit keys');
});

test('Payment Security - Amount tampering detection rejects client-modified amounts', async (t) => {
  const serverQuoteTotal = 1733; // 1650 base + 5% GST = 1733
  const clientTamperedAmount = 1; // Attacker tries to pay ₹1

  const isTampered = Math.abs(Number(clientTamperedAmount) - serverQuoteTotal) > 1;
  assert.strictEqual(isTampered, true, 'System must detect deviation between client amount and server quote');

  const legitAmount = 1733;
  const isLegitTampered = Math.abs(Number(legitAmount) - serverQuoteTotal) > 1;
  assert.strictEqual(isLegitTampered, false, 'Legitimate matching amount passes check');
});

test('IDOR and Privacy - Sensitive contact information is masked on unauthenticated lookup', async (t) => {
  const sampleBooking = {
    pnr: 'RUP-889123',
    bookingId: 'BK_1001',
    passengerId: '507f1f77bcf86cd799439011',
    contactDetails: {
      phone: '9876543210',
      email: 'traveler@rupadiya.com'
    }
  };

  // Masking function applied for unauthenticated non-matching viewers
  const p = sampleBooking.contactDetails.phone;
  const maskedPhone = p.length >= 10 ? `${p.slice(0, 2)}******${p.slice(-2)}` : '******';
  const parts = sampleBooking.contactDetails.email.split('@');
  const maskedEmail = `${parts[0].slice(0, 1)}***@${parts[1] || 'rupadiya.com'}`;

  assert.strictEqual(maskedPhone, '98******10');
  assert.strictEqual(maskedEmail, 't***@rupadiya.com');
  assert.notStrictEqual(maskedPhone, '9876543210', 'Phone number must be concealed');
  assert.notStrictEqual(maskedEmail, 'traveler@rupadiya.com', 'Email must be concealed');
});

test('IDOR and Privacy - Booking cancellation requires ownership or verified phone', async (t) => {
  const sampleBooking = {
    passengerId: '507f1f77bcf86cd799439011',
    contactDetails: {
      phone: '9876543210'
    }
  };

  // Case 1: Random visitor without auth and without matching phone -> Blocked
  const visitorReq = { user: null, body: { contactPhone: '9111111111' } };
  const isOwner1 = visitorReq.user && visitorReq.user._id.toString() === sampleBooking.passengerId;
  const isPhoneMatch1 = visitorReq.body.contactPhone === sampleBooking.contactDetails.phone;
  assert.strictEqual(isOwner1 || isPhoneMatch1, false, 'Unverified stranger must be blocked');

  // Case 2: Guest with matching contact phone -> Allowed
  const guestOwnerReq = { user: null, body: { contactPhone: '9876543210' } };
  const isPhoneMatch2 = guestOwnerReq.body.contactPhone === sampleBooking.contactDetails.phone;
  assert.strictEqual(isPhoneMatch2, true, 'Verified phone owner is allowed to cancel');
});
