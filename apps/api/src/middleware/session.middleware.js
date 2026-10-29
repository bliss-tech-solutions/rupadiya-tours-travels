const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const env = require('../config/env');

const SESSION_COOKIE_NAME = 'rupadiya_session';
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 Hours

function signSessionId(sessionId) {
  const hmac = crypto.createHmac('sha256', env.SESSION_SECRET || 'rupadiya-session-secret');
  hmac.update(sessionId);
  return `${sessionId}.${hmac.digest('hex')}`;
}

function verifySessionCookie(signedValue) {
  if (!signedValue || typeof signedValue !== 'string') return null;
  const parts = signedValue.split('.');
  if (parts.length !== 2) return null;

  const [sessionId, receivedSignature] = parts;
  const hmac = crypto.createHmac('sha256', env.SESSION_SECRET || 'rupadiya-session-secret');
  hmac.update(sessionId);
  const expectedSignature = hmac.digest('hex');

  // Timing safe comparison to prevent timing attacks
  const isMatch = crypto.timingSafeEqual(
    Buffer.from(receivedSignature, 'utf8'),
    Buffer.from(expectedSignature, 'utf8')
  );

  return isMatch ? sessionId : null;
}

function browserSessionMiddleware(req, res, next) {
  const existingCookie = req.cookies?.[SESSION_COOKIE_NAME];
  let sessionId = verifySessionCookie(existingCookie);

  if (!sessionId) {
    // Generate fresh session ID and sign it
    sessionId = `sess_${uuidv4()}`;
    const signedVal = signSessionId(sessionId);

    const isProd = env.NODE_ENV === 'production';
    res.cookie(SESSION_COOKIE_NAME, signedVal, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_MS
    });
  }

  req.browserSessionId = sessionId;
  next();
}

module.exports = {
  browserSessionMiddleware,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_MS
};

