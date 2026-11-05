const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const path = require('path');
const env = require('./config/env');
const { isDbConnected, mongoose, connectDB } = require('./config/db');
const { errorHandler } = require('./middleware/errorHandler.middleware');
const { originGuard, getAllowedOrigins } = require('./middleware/originGuard.middleware');
const { globalLimiter } = require('./middleware/rateLimit.middleware');
const { browserSessionMiddleware } = require('./middleware/session.middleware');
const { tabGuestMiddleware } = require('./middleware/tabGuest.middleware');
const { sanitizeInput } = require('./middleware/sanitize.middleware');

// Feature Routes
const authRoutes = require('./modules/auth/auth.routes');
const routesRoutes = require('./modules/routes/routes.routes');
const tripsRoutes = require('./modules/trips/trips.routes');
const bookingRoutes = require('./modules/bookings/booking.routes');
const walletRoutes = require('./modules/wallets/wallet.routes');
const agentRoutes = require('./modules/agents/agents.routes');
const withdrawalRoutes = require('./modules/withdrawals/withdrawals.routes');
const kycRoutes = require('./modules/kyc/kyc.routes');
const ownerRoutes = require('./modules/companies/owner.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const toursRoutes = require('./modules/tours/tours.routes');
const paymentRoutes = require('./modules/payments/payments.routes');
const uploadRoutes = require('./modules/upload/upload.routes');
const reportRoutes = require('./modules/reports/reports.routes');
const Offer = require('./modules/offers/offer.model');

const app = express();

// Trust proxy for Render / Cloud load balancers (ensures accurate client IP and HTTPS cookies)
app.set('trust proxy', 1);

// Disable ETag generation to prevent 304 Not Modified empty responses on dynamic API routes
app.set('etag', false);

// High-End Security Headers: CSP, Clickjacking (X-Frame-Options), MIME-sniffing, HSTS
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://checkout.razorpay.com"],
      frameSrc: ["'self'", "https://api.razorpay.com", "https://checkout.razorpay.com"],
      connectSrc: ["'self'", "https://api.razorpay.com", "https://lumberjack.razorpay.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  frameguard: { action: 'sameorigin' }
}));

// Dynamic CORS supporting multiple origins and cookies with credentials: true
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (Postman, curl, server-to-server) or test runner
    if (!origin) return callback(null, true);

    const allowed = getAllowedOrigins();
    if (allowed.includes('*') || allowed.includes(origin) || env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true
}));

app.use(cookieParser(env.COOKIE_SECRET));
app.use(compression());

// Webhook raw-body preservation: Razorpay HMAC verification requires unparsed raw buffer
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    if (req.originalUrl && req.originalUrl.includes('/webhook')) {
      req.rawBody = buf;
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Ensure API responses are never cached by client or proxy, and eliminate 304 Not Modified
app.use('/api', (req, res, next) => {
  delete req.headers['if-none-match'];
  delete req.headers['if-modified-since'];
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
});

if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Browser session middleware for unauthenticated visitors
app.use('/api', browserSessionMiddleware);

// Tab-isolated guest session middleware (scoped per browser tab)
app.use('/api', tabGuestMiddleware);

// Origin & Anti-Scraping Guard
app.use('/api', originGuard);

// Global Rate Limiter for all API routes
app.use('/api', globalLimiter);

// High-End Input Sanitization against XSS and NoSQL operator injection
app.use('/api', sanitizeInput);

// Static uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Real Liveness & Readiness Health Check Endpoint
app.get(['/api/v1/health', '/health'], (req, res) => {
  const dbOk = isDbConnected();
  const statusCode = dbOk || env.NODE_ENV === 'test' ? 200 : 503;
  res.status(statusCode).json({
    status: dbOk ? 'healthy' : (env.NODE_ENV === 'test' ? 'ok' : 'unhealthy'),
    service: 'rupadiya-api',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    dbConnected: dbOk,
    dbState: mongoose.connection ? mongoose.connection.readyState : 0
  });
});

// Database Readiness Guard for functional API endpoints
// Intercepts requests when DB is disconnected, rapidly attempts reconnect, or fails fast with 503
// instead of letting Mongoose buffer indefinitely and crash after 10000ms
app.use('/api', async (req, res, next) => {
  if (req.path === '/v1/health' || req.path === '/health') {
    return next();
  }

  if (!isDbConnected()) {
    try {
      await connectDB(2, 400);
    } catch (_) {}

    if (!isDbConnected()) {
      return res.status(503).json({
        success: false,
        error: 'Database connection is temporarily unavailable. Please retry in a few seconds.',
        code: 'DB_UNAVAILABLE'
      });
    }
  }

  next();
});

// Offers endpoint (public)
app.get('/api/v1/offers', async (req, res, next) => {
  try {
    const offers = await Offer.find({ isActive: true, validUntil: { $gte: new Date() } });
    res.json({ success: true, count: offers.length, offers });
  } catch (err) {
    next(err);
  }
});

// Mount modular API v1 routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/routes', routesRoutes);
app.use('/api/v1/trips', tripsRoutes);
app.use('/api/v1/bookings', bookingRoutes);
app.use('/api/v1/wallet', walletRoutes);
app.use('/api/v1/agent', agentRoutes);
app.use('/api/v1/agents', agentRoutes);
app.use('/api/v1/withdrawals', withdrawalRoutes);
app.use('/api/v1/kyc', kycRoutes);
app.use('/api/v1/owner', ownerRoutes);
app.use('/api/v1/companies', ownerRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/tours', toursRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/reports', reportRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Centralized error handler
app.use(errorHandler);

module.exports = app;
