const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const isProd = process.env.NODE_ENV === 'production';

// Critical security check: prevent default secrets in production
const INSECURE_DEFAULTS = [
  'rupadiya-access-jwt-secret-key-32chars!!',
  'rupadiya-refresh-jwt-secret-key-32chars!!',
  'rupadiya-cookie-secret-key-32chars!',
  'rupadiya-session-secret-key-32chars!'
];

function validateProductionSecret(name, value, minLength = 32) {
  if (isProd) {
    if (!value) {
      throw new Error(`[CRITICAL SECURITY CONFIG] Environment variable '${name}' is required in production.`);
    }
    if (INSECURE_DEFAULTS.includes(value)) {
      throw new Error(`[CRITICAL SECURITY CONFIG] '${name}' is using an insecure default value in production. Please set a strong, unique secret.`);
    }
    if (value.length < minLength) {
      throw new Error(`[CRITICAL SECURITY CONFIG] '${name}' must be at least ${minLength} characters long in production.`);
    }
  }
}

const accessSecret = process.env.AUTH_ACCESS_SECRET || (isProd ? '' : 'rupadiya-access-jwt-secret-key-32chars!!');
const refreshSecret = process.env.AUTH_REFRESH_SECRET || (isProd ? '' : 'rupadiya-refresh-jwt-secret-key-32chars!!');
const cookieSecret = process.env.COOKIE_SECRET || (isProd ? '' : 'rupadiya-cookie-secret-key-32chars!');
const sessionSecret = process.env.SESSION_SECRET || (isProd ? '' : 'rupadiya-session-secret-key-32chars!');

validateProductionSecret('AUTH_ACCESS_SECRET', accessSecret);
validateProductionSecret('AUTH_REFRESH_SECRET', refreshSecret);
validateProductionSecret('COOKIE_SECRET', cookieSecret);
validateProductionSecret('SESSION_SECRET', sessionSecret);

if (isProd && !process.env.MONGODB_URI) {
  throw new Error(`[CRITICAL SECURITY CONFIG] 'MONGODB_URI' is mandatory in production.`);
}

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
  COOKIE_SAME_SITE: process.env.COOKIE_SAME_SITE || (isProd ? 'none' : 'lax'),
  AUTH_ACCESS_SECRET: accessSecret,
  AUTH_REFRESH_SECRET: refreshSecret,
  COOKIE_SECRET: cookieSecret,
  SESSION_SECRET: sessionSecret,
  AUTH_ACCESS_EXPIRES_IN: process.env.AUTH_ACCESS_EXPIRES_IN || '15m',
  AUTH_REFRESH_EXPIRES_IN: process.env.AUTH_REFRESH_EXPIRES_IN || '24h',
  PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER || 'razorpay',
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  HOLD_DURATION_SECONDS: parseInt(process.env.HOLD_DURATION_SECONDS, 10) || 600, // 10 minutes
  TCS_RATE: parseFloat(process.env.TCS_RATE) || 0.01, // 1%
  GST_RATE: parseFloat(process.env.GST_RATE) || 0.05  // 5%
};

module.exports = env;
