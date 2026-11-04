const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

function getClientIp(req) {
  if (typeof req.ip === 'string' && req.ip) return req.ip;
  if (req.headers && req.headers['x-forwarded-for']) {
    return req.headers['x-forwarded-for'].split(',')[0].trim();
  }
  if (req.socket && req.socket.remoteAddress) {
    return req.socket.remoteAddress;
  }
  if (typeof ipKeyGenerator === 'function') {
    const generated = ipKeyGenerator(req);
    if (typeof generated === 'string') return generated;
  }
  return '127.0.0.1';
}

// Helper to determine key for rate limiting: combines normalized IP with tab ID or browser session
function keyGenerator(req) {
  const tabPart = req.tabId || req.headers?.['x-tab-id'] || '';
  const sessionPart = req.cookies?.rupadiya_session || req.browserSessionId || '';
  const ip = getClientIp(req);

  if (tabPart) {
    return `${ip}:tab:${tabPart}`;
  }
  return sessionPart ? `${ip}:sess:${sessionPart}` : ip;
}

// IP-only key generator for minting guest tokens and brute force defense
function ipOnlyKeyGenerator(req) {
  return getClientIp(req);
}

// Helper to determine if request should bypass generic scrapers/DDoS limits
// Never throttle local development, tests, healthchecks, or authenticated operator portal calls
function isOperatorOrDev(req) {
  if (process.env.NODE_ENV !== 'production') return true;
  if (req.headers && (req.headers.authorization || req.headers['x-admin-key'])) return true;
  if (req.cookies && (req.cookies.owner_token || req.cookies.agent_token || req.cookies.admin_token || req.cookies.rupadiya_token)) return true;
  const url = req.originalUrl || req.url || '';
  if (
    url.includes('/owner/') ||
    url.includes('/agent/') ||
    url.includes('/admin/') ||
    url.includes('/auth/me') ||
    url.includes('/health')
  ) {
    return true;
  }
  return false;
}

const commonOptions = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator,
  validate: {
    keyGeneratorIpFallback: false,
    xForwardedForHeader: false
  }
};

// 1. Global Rate Limiter: General defense against DDoS / brute scrapers
const globalLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 2000,
  skip: isOperatorOrDev,
  message: {
    success: false,
    error: 'Too many requests from this client. Please slow down and try again later.'
  }
});

// 2. Strict Auth Limiter: Guard against credential brute-forcing & OTP flood
const authLimiter = rateLimit({
  ...commonOptions,
  keyGenerator: ipOnlyKeyGenerator, // IP-bound to prevent tab-switching brute force
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: process.env.NODE_ENV !== 'production' ? 1000 : 25,
  skip: (req) => process.env.NODE_ENV === 'test',
  message: {
    success: false,
    error: 'Too many authentication attempts. Please wait 15 minutes before trying again.'
  }
});

// 3. Guest Token Limiter: Prevent token generation spam
const guestTokenLimiter = rateLimit({
  ...commonOptions,
  keyGenerator: ipOnlyKeyGenerator,
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: process.env.NODE_ENV !== 'production' ? 5000 : 100,
  skip: isOperatorOrDev,
  message: {
    success: false,
    error: 'Too many guest tokens requested from this network. Please reuse your current browser session.'
  }
});

// 4. Hold Limiter: Guard against seat hoarding bots per tab & IP
const holdLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: process.env.NODE_ENV !== 'production' ? 1000 : 60,
  skip: isOperatorOrDev,
  message: {
    success: false,
    error: 'Too many seat-hold attempts detected. Please try again after 15 minutes.'
  }
});

// 5. Booking Confirmation Limiter: Guard against rapid booking spam
const confirmLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: process.env.NODE_ENV !== 'production' ? 1000 : 50,
  skip: isOperatorOrDev,
  message: {
    success: false,
    error: 'Too many booking confirmation attempts. Please verify your existing reservations.'
  }
});

// 6. Payment Gateway & Topup Limiter: Guard against payment order spam
const paymentLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: process.env.NODE_ENV !== 'production' ? 1000 : 60,
  skip: isOperatorOrDev,
  message: {
    success: false,
    error: 'Too many payment requests initiated. Please check your transaction status or try again in a few minutes.'
  }
});

// 7. Search Scraper Limiter: Guard search endpoints against high-frequency scrapers
const searchLimiter = rateLimit({
  ...commonOptions,
  windowMs: 1 * 60 * 1000, // 1 minute
  limit: process.env.NODE_ENV !== 'production' ? 2000 : 120,
  skip: isOperatorOrDev,
  message: {
    success: false,
    error: 'Search request rate exceeded. Please slow down.'
  }
});

module.exports = {
  globalLimiter,
  authLimiter,
  guestTokenLimiter,
  holdLimiter,
  confirmLimiter,
  paymentLimiter,
  searchLimiter,
  keyGenerator,
  getClientIp
};
