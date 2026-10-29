const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// Helper to determine key for rate limiting: combines normalized IP with browser session if available
function keyGenerator(req) {
  const sessionPart = req.cookies?.rupadiya_session || req.browserSessionId || '';
  const ip = typeof ipKeyGenerator === 'function' ? ipKeyGenerator(req) : (req.ip || '127.0.0.1');
  return sessionPart ? `${ip}:${sessionPart}` : ip;
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
  limit: 300,
  message: {
    success: false,
    error: 'Too many requests from this client. Please slow down and try again later.'
  }
});

// 2. Strict Auth Limiter: Guard against credential brute-forcing & OTP flood
const authLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,
  message: {
    success: false,
    error: 'Too many authentication attempts. Please wait 15 minutes before trying again.'
  }
});

// 3. Hold & Booking Limiter: Guard against seat hoarding bots
const holdLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 30,
  message: {
    success: false,
    error: 'Too many seat-hold attempts detected. Please try again after 15 minutes.'
  }
});

// 4. Payment Gateway & Topup Limiter: Guard against payment order spam
const paymentLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 25,
  message: {
    success: false,
    error: 'Too many payment requests initiated. Please check your transaction status or try again in a few minutes.'
  }
});

module.exports = {
  globalLimiter,
  authLimiter,
  holdLimiter,
  paymentLimiter
};
