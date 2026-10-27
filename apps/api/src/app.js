const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const env = require('./config/env');
const { errorHandler } = require('./middleware/errorHandler.middleware');

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
const Offer = require('./modules/offers/offer.model');

const app = express();

// Disable ETag generation to prevent 304 Not Modified empty responses on dynamic API routes
app.set('etag', false);

// Security and utility middleware
app.use(helmet());
app.use(cors({
  origin: [
    env.WEB_ORIGIN,
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
  ],
  credentials: true
}));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure API responses are never cached by client or proxy
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'rupadiya-api',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
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
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/tours', toursRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Centralized error handler
app.use(errorHandler);

module.exports = app;

