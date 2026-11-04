const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 4500,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/rupadiya',
  MONGODB_DB: process.env.MONGODB_DB || 'rupadiya',
  REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  WEB_ORIGIN: process.env.WEB_ORIGIN || 'http://localhost:3000',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || '',
  SELF_URL: process.env.SELF_URL || '',
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || undefined,
  COOKIE_SAME_SITE: process.env.COOKIE_SAME_SITE || (process.env.NODE_ENV === 'production' ? 'none' : 'lax'),
  AUTH_ACCESS_SECRET: process.env.AUTH_ACCESS_SECRET || 'rupadiya-access-jwt-secret-key-32chars!!',
  AUTH_REFRESH_SECRET: process.env.AUTH_REFRESH_SECRET || 'rupadiya-refresh-jwt-secret-key-32chars!!',
  COOKIE_SECRET: process.env.COOKIE_SECRET || 'rupadiya-cookie-secret-key-32chars!',
  SESSION_SECRET: process.env.SESSION_SECRET || 'rupadiya-session-secret-key-32chars!',
  AUTH_ACCESS_EXPIRES_IN: process.env.AUTH_ACCESS_EXPIRES_IN || '15m',
  AUTH_REFRESH_EXPIRES_IN: process.env.AUTH_REFRESH_EXPIRES_IN || '24h',
  PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER || 'dummy',
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  HOLD_DURATION_SECONDS: parseInt(process.env.HOLD_DURATION_SECONDS, 10) || 600, // 10 minutes
  TCS_RATE: parseFloat(process.env.TCS_RATE) || 0.01, // 1%
  GST_RATE: parseFloat(process.env.GST_RATE) || 0.05  // 5%
};

module.exports = env;
