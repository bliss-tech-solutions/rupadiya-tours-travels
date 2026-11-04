const jwt = require('jsonwebtoken');
const env = require('../config/env');

const GUEST_TOKEN_TYPE = 'GUEST_TAB_TOKEN';
const GUEST_TOKEN_EXPIRES_IN = '24h';

/**
 * Generate a cryptographically signed, tab-scoped Guest JWT
 */
function generateGuestToken({ tabId, sessionId, ip }) {
  const payload = {
    tabId,
    sessionId: sessionId || null,
    ip: ip || '127.0.0.1',
    role: 'GUEST',
    type: GUEST_TOKEN_TYPE
  };

  return jwt.sign(payload, env.AUTH_ACCESS_SECRET, {
    expiresIn: GUEST_TOKEN_EXPIRES_IN
  });
}

/**
 * Verify and decode a guest token
 */
function verifyGuestToken(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const decoded = jwt.verify(token.trim(), env.AUTH_ACCESS_SECRET);
    if (decoded.type !== GUEST_TOKEN_TYPE) return null;
    return decoded;
  } catch {
    return null;
  }
}

// Prefixes strictly prohibited for guest tokens
const FORBIDDEN_GUEST_PREFIXES = [
  '/api/v1/admin',
  '/api/v1/owner',
  '/api/v1/companies',
  '/api/v1/agent',
  '/api/v1/agents',
  '/api/v1/wallet',
  '/api/v1/withdrawals',
  '/api/v1/kyc',
  '/api/v1/reports'
];

/**
 * Tab Guest Middleware:
 * Inspects incoming x-tab-id and x-guest-token headers,
 * authenticates guest tabs, attaches req.tabId, and enforces role boundaries.
 */
function tabGuestMiddleware(req, res, next) {
  const tabIdHeader = req.headers['x-tab-id'];
  const guestTokenHeader = req.headers['x-guest-token'];

  if (tabIdHeader) {
    req.tabId = String(tabIdHeader).trim();
  }

  if (guestTokenHeader) {
    const decoded = verifyGuestToken(guestTokenHeader);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired guest session token. Please refresh your browser tab.',
        code: 'GUEST_TOKEN_INVALID'
      });
    }

    // Verify tab-id header matches token claim
    if (tabIdHeader && decoded.tabId !== tabIdHeader) {
      return res.status(403).json({
        success: false,
        error: 'Guest token does not match the active browser tab signature.',
        code: 'TAB_ID_MISMATCH'
      });
    }

    req.tabId = decoded.tabId;
    req.guestToken = guestTokenHeader;
    req.guestSession = decoded;
    req.isGuest = true;
  }

  // Strict role boundary enforcement for Guest Sessions:
  // If request is made by a guest without user authentication, block access to privileged subtrees
  const originalUrl = req.originalUrl || req.url || '';
  if (req.isGuest && !req.user) {
    const isProhibited = FORBIDDEN_GUEST_PREFIXES.some(prefix => originalUrl.startsWith(prefix));
    if (isProhibited) {
      return res.status(403).json({
        success: false,
        error: `Access Denied: Guest tokens cannot access privileged administrative or financial endpoints (${originalUrl}).`,
        code: 'GUEST_ACCESS_DENIED'
      });
    }
  }

  next();
}

module.exports = {
  generateGuestToken,
  verifyGuestToken,
  tabGuestMiddleware,
  GUEST_TOKEN_TYPE,
  GUEST_TOKEN_EXPIRES_IN
};

