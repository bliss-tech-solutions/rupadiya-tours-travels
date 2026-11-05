const Redis = require('ioredis');

/**
 * Enterprise Redis Client for Rupadiya Bus Booking Platform
 * Connects to Redis Cloud (e.g. redis-19332.c263.us-east-1-2.ec2.cloud.redislabs.com:19332)
 * Provides high-availability distributed locks and pub/sub with resilient fallback.
 */

let redisClient = null;
let isConnected = false;
let initPromise = null;

const redisUrl = process.env.REDIS_URL || 'redis://redis-19332.c263.us-east-1-2.ec2.cloud.redislabs.com:19332';

function init() {
  if (initPromise) return initPromise;
  if (process.env.NODE_ENV === 'test') {
    return Promise.resolve(null);
  }

  initPromise = new Promise((resolve) => {
    try {
      redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        connectTimeout: 4000,
        lazyConnect: true,
        enableOfflineQueue: false,
        retryStrategy: (times) => {
          if (times > 3) return 30000;
          return Math.min(times * 2000, 10000);
        }
      });

      redisClient.on('connect', () => {
        isConnected = true;
        console.log(`[Redis] Connected successfully to endpoint: ${redisUrl.replace(/:[^:@]+@/, ':****@')}`);
      });

      redisClient.on('ready', () => {
        isConnected = true;
        console.log('[Redis] Redis cluster ready for distributed seat locks and caching.');
        resolve(redisClient);
      });

      redisClient.on('error', (err) => {
        isConnected = false;
        if (err.message && err.message.includes('NOAUTH')) {
          console.warn('[Redis] Redis Cloud authentication required. Platform operating seamlessly on in-memory store.');
          console.warn('[Redis] Set REDIS_URL=redis://default:<password>@... in .env to activate distributed synchronization.');
        } else {
          console.warn(`[Redis] Notice: ${err.message}. Seamlessly using local store.`);
        }
        resolve(null);
      });

      redisClient.connect().catch((err) => {
        isConnected = false;
        resolve(null);
      });
    } catch (e) {
      console.warn('[Redis] Initialization fallback:', e.message);
      isConnected = false;
      resolve(null);
    }
  });

  return initPromise;
}

const redisService = {
  init,
  getClient: () => redisClient,
  isAvailable: () => Boolean(isConnected && redisClient && redisClient.status === 'ready'),

  async setHoldLock(tripId, seatNumber, token, ttlSeconds = 600) {
    if (!this.isAvailable()) return false;
    try {
      const key = `rupadiya:hold:${tripId}:${String(seatNumber).trim().toLowerCase()}`;
      const res = await redisClient.set(key, token, 'EX', ttlSeconds, 'NX');
      return res === 'OK';
    } catch (e) {
      return false;
    }
  },

  async releaseHoldLock(tripId, seatNumber) {
    if (!this.isAvailable()) return false;
    try {
      const key = `rupadiya:hold:${tripId}:${String(seatNumber).trim().toLowerCase()}`;
      await redisClient.del(key);
      return true;
    } catch (e) {
      return false;
    }
  },

  async getHeldSeatsForTrip(tripId) {
    if (!this.isAvailable()) return [];
    try {
      const pattern = `rupadiya:hold:${tripId}:*`;
      const keys = await redisClient.keys(pattern);
      const prefix = `rupadiya:hold:${tripId}:`;
      return keys.map(k => k.replace(prefix, ''));
    } catch (e) {
      return [];
    }
  },

  async publish(channel, data) {
    if (!this.isAvailable()) return false;
    try {
      await redisClient.publish(channel, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  },

  async disconnect() {
    if (redisClient) {
      try {
        await redisClient.quit();
      } catch (e) {
        try { redisClient.disconnect(); } catch (e2) {}
      }
      isConnected = false;
      redisClient = null;
      initPromise = null;
    }
  }
};

module.exports = redisService;
