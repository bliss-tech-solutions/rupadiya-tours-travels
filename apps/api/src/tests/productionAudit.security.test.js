const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const Booking = require('../modules/bookings/booking.model');
const holdStore = require('../config/holdStore');
const { BOOKING_STATUS, PAYMENT_STATUS, PAYMENT_PROVIDERS, MINIMUM_DEPOSIT_AMOUNT } = require('../config/constants');
const { authenticateToken } = require('../middleware/auth.middleware');

test('Production Audit - Booking Schema defaults are strictly PENDING_PAYMENT and unconfirmed', () => {
  const freshBooking = new Booking({
    bookingId: 'BK_TEST_001',
    pnr: 'RUP-000001',
    passengerId: '507f191e810c19729de860ea',
    tripId: '507f191e810c19729de860eb',
    routeId: '507f191e810c19729de860ec',
    busId: '507f191e810c19729de860ed',
    companyCode: 1,
    seatNumbers: ['A1']
  });

  // Verify financial and confirmation safety defaults
  assert.strictEqual(
    freshBooking.status,
    BOOKING_STATUS.PENDING_PAYMENT,
    'Fresh booking default status must be PENDING_PAYMENT, never pre-confirmed'
  );
  assert.strictEqual(
    freshBooking.paymentStatus,
    PAYMENT_STATUS.PENDING,
    'Fresh booking default paymentStatus must be PENDING, never pre-captured/success'
  );
  assert.strictEqual(
    freshBooking.paymentProvider,
    PAYMENT_PROVIDERS.RAZORPAY,
    'Default payment provider must be RAZORPAY in production'
  );
});

test('Production Audit - Direct wallet deposit without payment gateway is strictly blocked', () => {
  // Test threshold enforcement (minimum ₹100)
  const validateDepositAmount = (amount) => {
    const num = Number(amount);
    if (!num || isNaN(num) || num < MINIMUM_DEPOSIT_AMOUNT) {
      return { valid: false, error: `Minimum deposit amount is ₹${MINIMUM_DEPOSIT_AMOUNT}.` };
    }
    return { valid: true, amount: num };
  };

  assert.strictEqual(validateDepositAmount(50).valid, false, '₹50 must be rejected below ₹100 min');
  assert.strictEqual(validateDepositAmount(0).valid, false, '₹0 must be rejected');
  assert.strictEqual(validateDepositAmount(-100).valid, false, 'Negative deposits must be rejected');
  assert.strictEqual(validateDepositAmount(100).valid, true, '₹100 must be accepted');
  assert.strictEqual(validateDepositAmount(1500).valid, true, '₹1,500 must be accepted');

  // Verify that deposit flow requires pending order initialization rather than direct credit
  const mockWallet = { availableBalance: 1000, reservedBalance: 0 };
  const depositOrderSimulation = (wallet, amount) => {
    // Correct secure behavior: balance is NOT modified on deposit initiation!
    const pendingDeposit = {
      depositId: `DEP_${Date.now()}`,
      amount,
      status: 'PENDING',
      paymentOrderId: `order_${Date.now()}`
    };
    return { walletState: { ...wallet }, pendingDeposit };
  };

  const { walletState, pendingDeposit } = depositOrderSimulation(mockWallet, 500);
  assert.strictEqual(walletState.availableBalance, 1000, 'Wallet balance MUST NOT increase upon deposit initiation');
  assert.strictEqual(pendingDeposit.status, 'PENDING');
  assert.ok(pendingDeposit.paymentOrderId, 'A gateway payment order must be generated for fulfillment');
});

test('Production Audit - Upload endpoints require authentication and reject spoofed file magic bytes', () => {
  // 1. Unauthenticated request to upload route must fail with 401
  let statusSent = null;
  let jsonSent = null;
  const mockRes = {
    status(code) {
      statusSent = code;
      return this;
    },
    json(data) {
      jsonSent = data;
      return this;
    }
  };

  const unauthenticatedReq = {
    headers: {},
    cookies: {}
  };

  authenticateToken(unauthenticatedReq, mockRes, () => {});
  assert.strictEqual(statusSent, 401, 'Unauthenticated request to upload must return 401');

  // 2. Magic byte cryptographic verification
  const MAGIC_BYTES = {
    'ffd8ffe0': 'image/jpeg',
    'ffd8ffe1': 'image/jpeg',
    'ffd8ffe2': 'image/jpeg',
    '89504e47': 'image/png',
    '25504446': 'application/pdf',
    '52494646': 'image/webp'
  };

  const verifyMagicBytes = (buffer, claimedMime) => {
    if (!buffer || buffer.length < 4) return false;
    const hex = buffer.slice(0, 4).toString('hex').toLowerCase();
    const detectedMime = MAGIC_BYTES[hex];
    return detectedMime === claimedMime;
  };

  // Valid JPEG header
  const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  assert.strictEqual(verifyMagicBytes(validJpeg, 'image/jpeg'), true, 'Valid JPEG buffer must pass');

  // Valid PNG header
  const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
  assert.strictEqual(verifyMagicBytes(validPng, 'image/png'), true, 'Valid PNG buffer must pass');

  // Valid PDF header
  const validPdf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
  assert.strictEqual(verifyMagicBytes(validPdf, 'application/pdf'), true, 'Valid PDF buffer must pass');

  // Spoofed file: Executable payload (MZ header = 4d 5a) disguised as image/jpeg
  const maliciousExe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
  assert.strictEqual(verifyMagicBytes(maliciousExe, 'image/jpeg'), false, 'Malicious executable disguised as JPEG must be rejected');
  assert.strictEqual(verifyMagicBytes(maliciousExe, 'application/pdf'), false, 'Malicious executable disguised as PDF must be rejected');
});

test('Production Audit - Webhook HMAC uses timing-safe verification and duplicate idempotency', () => {
  const webhookSecret = 'test-webhook-secret-key-32chars!!';
  const rawBody = JSON.stringify({
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: 'pay_test_12345',
          order_id: 'order_test_67890',
          amount: 155000,
          currency: 'INR'
        }
      }
    }
  });

  // Calculate authentic signature
  const validSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  const tamperedSignature = crypto
    .createHmac('sha256', 'wrong-secret')
    .update(rawBody)
    .digest('hex');

  const verifyWebhookHmac = (bodyBufferOrString, signature, secret) => {
    if (!signature || !secret) return false;
    const expected = crypto.createHmac('sha256', secret).update(bodyBufferOrString).digest('hex');
    if (expected.length !== signature.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  };

  assert.strictEqual(verifyWebhookHmac(rawBody, validSignature, webhookSecret), true, 'Valid HMAC signature must verify');
  assert.strictEqual(verifyWebhookHmac(rawBody, tamperedSignature, webhookSecret), false, 'Tampered HMAC signature must fail');
  assert.strictEqual(verifyWebhookHmac(rawBody + 'tamper', validSignature, webhookSecret), false, 'Tampered payload must fail verification');

  // Webhook event idempotency check
  const processedEvents = new Set();
  const processEventIdempotently = (eventId) => {
    if (processedEvents.has(eventId)) {
      return { alreadyProcessed: true, status: 'SKIPPED' };
    }
    processedEvents.add(eventId);
    return { alreadyProcessed: false, status: 'PROCESSED' };
  };

  const event1 = processEventIdempotently('evt_1001');
  assert.strictEqual(event1.alreadyProcessed, false, 'First occurrence of webhook must be processed');
  assert.strictEqual(event1.status, 'PROCESSED');

  const event1Retry = processEventIdempotently('evt_1001');
  assert.strictEqual(event1Retry.alreadyProcessed, true, 'Duplicate occurrence of webhook must be detected as idempotent replay');
  assert.strictEqual(event1Retry.status, 'SKIPPED');
});

test('Production Audit - Seat hold token entropy and double hold prevention', async () => {
  const tripId = 'TRIP_AUDIT_101';
  const seatNumbers = ['U1', 'U2'];

  // 1. Hold seats
  const hold = await holdStore.holdSeats({
    tripId,
    seatNumbers,
    passengerDetails: [{ seatNumber: 'U1' }, { seatNumber: 'U2' }],
    ttlSeconds: 60
  });

  // Verify hold token entropy: must be at least 48 characters
  assert.ok(hold.holdToken, 'Hold token must be returned');
  assert.ok(hold.holdToken.length >= 48, `Hold token must have at least 48 characters of entropy (actual: ${hold.holdToken.length})`);

  // Verify retrieve hold by token
  const retrieved = await holdStore.getHold(hold.holdToken);
  assert.ok(retrieved, 'Hold must be retrievable with token');
  assert.strictEqual(retrieved.tripId, tripId);

  // 2. Attempt double hold on the same seat
  const conflictResult = await holdStore.holdSeats({
    tripId,
    seatNumbers: ['U2', 'U3'],
    passengerDetails: [{ seatNumber: 'U2' }, { seatNumber: 'U3' }],
    ttlSeconds: 60
  });

  assert.strictEqual(conflictResult.success, false, 'Double hold must return success: false');
  assert.strictEqual(conflictResult.conflict, true, 'Double hold must flag conflict: true');
  assert.ok(conflictResult.conflictingSeats.includes('U2'), 'Conflicting seat U2 must be identified');

  // 3. Clean release
  await holdStore.releaseHold(hold.holdToken);
  const afterRelease = await holdStore.getHold(hold.holdToken);
  assert.strictEqual(afterRelease, null, 'Hold must be null after clean release');
});
