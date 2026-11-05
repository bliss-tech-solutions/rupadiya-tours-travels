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
  'http://127.0.0.1:3004',
  'https://scotland-archive-moved-molecules.trycloudflare.com'
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

function isPublicEndpoint(req) {
  const p = (req.originalUrl || req.url || req.path || '').split('?')[0].replace(/\/$/, '');
  if (p === '/health' || p === '/api/v1/health' || p === '/v1/health') return true;
  if (p.startsWith('/api/v1/payments/webhook') || p.startsWith('/v1/payments/webhook')) return true;
  if (p.startsWith('/api/v1/auth/guest-token') || p.startsWith('/v1/auth/guest-token')) return true;
  if (p.startsWith('/uploads')) return true;

  // Public search destination corridors (as explicitly specified by user)
  if (req.method && req.method.toUpperCase() === 'GET') {
    if (p === '/api/v1/routes' || p === '/api/v1/routes/cities' || p === '/v1/routes' || p === '/v1/routes/cities') return true;
    if (p === '/api/v1/offers' || p === '/v1/offers') return true;
    if (p === '/api/v1/trips' || p === '/api/v1/trips/search' || p === '/v1/trips' || p === '/v1/trips/search') return true;
  }
  return false;
}

function originGuard(req, res, next) {
  // 1. Direct browser URL navigation protection
  // Blocks direct address bar navigation to API endpoints in any browser tab
  const secFetchDest = req.headers['sec-fetch-dest'];
  const secFetchMode = req.headers['sec-fetch-mode'];
  const isDirectBrowserNav = secFetchDest === 'document' || secFetchMode === 'navigate';
  if (isDirectBrowserNav && !isPublicEndpoint(req)) {
    return res.status(403).json({
      success: false,
      error: 'Direct browser URL navigation to API endpoints is prohibited. Requests must originate from the verified Rupadiya platform interface.',
      code: 'DIRECT_BROWSER_NAV_PROHIBITED'
    });
  }

  // 2. Open public paths bypass further checks if safe
  if (isPublicEndpoint(req) && !isDirectBrowserNav) {
    return next();
  }

  // Allow in automated test mode
  if (env.NODE_ENV === 'test' && !req.headers.origin && req.method !== 'POST') {
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

  // 3. Cross-site attack prevention (Anti-CSRF)
  if (secFetchSite === 'cross-site' && effectiveOrigin && !allowedOrigins.includes(effectiveOrigin)) {
    return res.status(403).json({
      success: false,
      error: 'Security Violation: Cross-site invocation prohibited.'
    });
  }

  // 4. If an Origin is present, verify against allowed list
  if (effectiveOrigin) {
    if (!allowedOrigins.includes(effectiveOrigin) && !allowedOrigins.includes('*')) {
      return res.status(403).json({
        success: false,
        error: `Security Violation: Unauthorized origin "${effectiveOrigin}". Access denied.`
      });
    }
  }

  // 5. Client Signature / CSRF Token Verification on all non-public endpoints
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

  next();
}

module.exports = {
  originGuard,
  getAllowedOrigins
};
