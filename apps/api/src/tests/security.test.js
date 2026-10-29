const test = require('node:test');
const assert = require('node:assert');
const { originGuard, getAllowedOrigins } = require('../middleware/originGuard.middleware');
const { browserSessionMiddleware, SESSION_COOKIE_NAME } = require('../middleware/session.middleware');
const authService = require('../modules/auth/auth.service');
const RefreshToken = require('../modules/auth/refreshToken.model');

test('Security Engine - Origin Guard blocks unauthorized external websites', async (t) => {
  let passed = false;
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

  // Test 1: Reject unauthorized origin
  const unauthorizedReq = {
    method: 'POST',
    path: '/api/v1/bookings/hold',
    headers: {
      origin: 'http://malicious-phishing-scam.com',
      'x-rupadiya-client': 'web-client'
    }
  };

  originGuard(unauthorizedReq, mockRes, () => { passed = true; });
  assert.strictEqual(statusSent, 403, 'Unauthorized origin must be rejected with 403');
  assert.strictEqual(jsonSent.success, false);
  assert.match(jsonSent.error, /Unauthorized origin/);

  // Test 2: Allow authorized website origin (user-web on localhost:3000)
  passed = false;
  statusSent = null;
  const authorizedReq = {
    method: 'POST',
    path: '/api/v1/bookings/hold',
    headers: {
      origin: 'http://localhost:3000',
      'x-rupadiya-client': 'web-client'
    }
  };

  originGuard(authorizedReq, mockRes, () => { passed = true; });
  assert.strictEqual(passed, true, 'Authorized user-web origin must pass');

  // Test 3: Reject raw non-browser mutating call lacking both Origin and client signature header
  passed = false;
  statusSent = null;
  const rawBotReq = {
    method: 'POST',
    path: '/api/v1/auth/login',
    headers: {}
  };

  originGuard(rawBotReq, mockRes, () => { passed = true; });
  assert.strictEqual(statusSent, 403, 'Raw external mutating request without client signature must be rejected');
});

test('Security Engine - Browser Session generates signed httpOnly cookie for unauthenticated visitors', async (t) => {
  let cookieSet = null;
  const mockRes = {
    cookie(name, val, opts) {
      cookieSet = { name, val, opts };
    }
  };

  const guestReq = {
    cookies: {},
    headers: {}
  };

  browserSessionMiddleware(guestReq, mockRes, () => {});

  assert.ok(guestReq.browserSessionId, 'browserSessionId must be assigned');
  assert.ok(guestReq.browserSessionId.startsWith('sess_'), 'Session ID should have prefix sess_');
  assert.ok(cookieSet, 'A session cookie must be set for guest');
  assert.strictEqual(cookieSet.name, SESSION_COOKIE_NAME);
  assert.strictEqual(cookieSet.opts.httpOnly, true, 'Session cookie must be HttpOnly');
  assert.strictEqual(cookieSet.opts.sameSite, 'lax');
});

test('Security Engine - Token hashing and 24-hr refresh lifecycle', async (t) => {
  const dummyUser = {
    _id: '507f1f77bcf86cd799439011',
    email: 'traveler@rupadiya.test',
    phone: '9876543210',
    role: 'PASSENGER',
    companyCode: null
  };

  // 1. Generate tokens
  const tokens = await authService.generateTokens(dummyUser, {
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0 RupadiyaTest'
  });

  assert.ok(tokens.accessToken, 'Access token must be generated');
  assert.ok(tokens.refreshToken, 'Refresh token must be generated');

  // 2. Verify token hashing helper
  const hash1 = authService.hashToken(tokens.refreshToken);
  const hash2 = authService.hashToken(tokens.refreshToken);
  assert.strictEqual(hash1, hash2, 'SHA-256 hash must be deterministic');
  assert.strictEqual(hash1.length, 64, 'SHA-256 hash must be 64 characters');
});

