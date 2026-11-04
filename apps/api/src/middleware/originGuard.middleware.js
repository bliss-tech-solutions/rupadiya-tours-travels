const env = require('../config/env');

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3002',
  'http://localhost:3003',
  'http://127.0.0.1:3003',
  'http://localhost:3004',
  'http://127.0.0.1:3004'
];

function getAllowedOrigins() {
  const custom = [
    env.WEB_ORIGIN,
    process.env.ALLOWED_ORIGINS
  ]
    .filter(Boolean)
    .flatMap(s => s.split(',').map(item => item.trim().replace(/\/$/, '')));

  return Array.from(new Set([...DEFAULT_ALLOWED_ORIGINS, ...custom]));
}

const VALID_CLIENT_IDENTIFIERS = new Set([
  'web-client',
  'agent-portal',
  'company-portal',
  'admin-portal',
  'test-runner'
]);

function originGuard(req, res, next) {
  // 1. Whitelist open public paths
  const path = req.path || req.originalUrl || '';
  if (
    path === '/health' ||
    path === '/api/v1/health' ||
    path.startsWith('/api/v1/auth/guest-token') ||
    path.startsWith('/api/v1/payments/webhook') ||
    path.startsWith('/uploads')
  ) {
    return next();
  }

  // Allow in automated test mode
  if (env.NODE_ENV === 'test' && !req.headers.origin) {
    return next();
  }

  const allowedOrigins = getAllowedOrigins();
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const secFetchSite = req.headers['sec-fetch-site'];
  const clientIdentifier = req.headers['x-rupadiya-client'];

  // Normalize origin
  let effectiveOrigin = origin ? origin.replace(/\/$/, '') : null;
  if (!effectiveOrigin && referer) {
    try {
      const parsed = new URL(referer);
      effectiveOrigin = parsed.origin.replace(/\/$/, '');
    } catch {
      effectiveOrigin = null;
    }
  }

  // 2. Cross-site attack prevention
  if (secFetchSite === 'cross-site' && effectiveOrigin && !allowedOrigins.includes(effectiveOrigin)) {
    return res.status(403).json({
      success: false,
      error: 'Security Violation: Cross-site invocation prohibited.'
    });
  }

  // 3. If an Origin is present, verify against allowed list
  if (effectiveOrigin) {
    if (!allowedOrigins.includes(effectiveOrigin) && !allowedOrigins.includes('*')) {
      return res.status(403).json({
        success: false,
        error: `Security Violation: Unauthorized origin "${effectiveOrigin}". Access denied.`
      });
    }
  }

  // 4. For state-mutating requests (POST, PUT, PATCH, DELETE), require client handshake
  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase());
  if (isMutating) {
    // If no origin, no referer, and no client header, this is an unverified direct external script/bot
    if (!effectiveOrigin && !clientIdentifier) {
      return res.status(403).json({
        success: false,
        error: 'Direct API invocation prohibited. Requests must originate from the verified Rupadiya platform interface.'
      });
    }

    if (clientIdentifier && !VALID_CLIENT_IDENTIFIERS.has(clientIdentifier)) {
      return res.status(403).json({
        success: false,
        error: 'Invalid client application signature.'
      });
    }
  }

  next();
}

module.exports = {
  originGuard,
  getAllowedOrigins
};
