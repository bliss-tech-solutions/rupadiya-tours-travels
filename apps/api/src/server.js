const http = require('http');
const app = require('./app');
const env = require('./config/env');
const { connectDB } = require('./config/db');
const websocketService = require('./services/websocket.service');
const redisService = require('./config/redis');

async function startServer() {
  try {
    // Attempt DB connection with automatic retries
    await connectDB(5, 1500);

    // Make sure there is always exactly one primary super admin.
    try {
      await require('./services/adminAccounts.service').ensurePrimaryAdmin();
    } catch (e) {
      console.warn('[Admin] ensurePrimaryAdmin failed:', e.message);
    }

    const server = http.createServer(app);

    // Initialize Real-time WebSocket Server on /ws
    websocketService.init(server);
    redisService.init();

    // Wire hold expiration cleanup directly to real-time seat release broadcast
    const holdStore = require('./config/holdStore');
    holdStore.onHoldExpired = (tripId, seatNumbers) => {
      try {
        if (tripId && seatNumbers && seatNumbers.length > 0) {
          websocketService.broadcastSeatReleased(tripId.toString(), seatNumbers);
        }
      } catch (err) {
        console.error('[WebSocket] Error broadcasting expired seats:', err.message);
      }
    };

    // WhatsApp / email notification sender (single leader across instances).
    try {
      const notificationService = require('./modules/notifications/notification.service');
      await notificationService.ensureTemplates();
      if (process.env.DISABLE_NOTIFICATIONS !== 'true') notificationService.start();
    } catch (e) {
      console.warn('[Notifications] start failed:', e.message);
    }

    // RazorpayX payout safety net: re-check payouts whose webhook may have been missed.
    const payoutService = require('./modules/withdrawals/payout.service');
    const payoutSweepTimer = setInterval(() => {
      payoutService.sweep().catch((err) => console.warn('[Payout sweep]', err.message));
    }, 10 * 60 * 1000);
    if (payoutSweepTimer.unref) payoutSweepTimer.unref();

    // Razorpay ↔ ledger reconciliation every 6 hours (last 2 days, safe auto-heal).
    const reconciliationService = require('./modules/finance/reconciliation.service');
    const reconTimer = setInterval(() => {
      reconciliationService.run({ days: 2, autoHeal: true, trigger: 'SCHEDULED' })
        .catch((err) => console.warn('[Reconciliation]', err.message));
    }, 6 * 60 * 60 * 1000);
    if (reconTimer.unref) reconTimer.unref();

    let keepAliveTimer = null;
    server.listen(env.PORT, () => {
      console.log(`====================================================`);
      console.log(`  Rupadiya Bus Booking Platform API v1.0.0          `);
      console.log(`  HTTP Server running on http://localhost:${env.PORT} `);
      console.log(`  WebSocket Server active on ws://localhost:${env.PORT}/ws `);
      console.log(`  Environment: ${env.NODE_ENV}                       `);
      console.log(`====================================================`);

      // Automated 9-Minute Keep-Alive Health Ping (Cold-start prevention)
      const KEEP_ALIVE_INTERVAL_MS = 9 * 60 * 1000;
      keepAliveTimer = setInterval(async () => {
        try {
          const pingUrl = process.env.SELF_URL || `http://127.0.0.1:${env.PORT}/api/v1/health`;
          const res = await fetch(pingUrl);
          if (res.ok) {
            console.log(`[Keep-Alive Ping] 9-min health check OK at ${new Date().toISOString()}`);
          }
        } catch (e) {}
      }, KEEP_ALIVE_INTERVAL_MS);
    });

    const shutdown = async (signal) => {
      if (keepAliveTimer) clearInterval(keepAliveTimer);
      console.log(`[Server] Received ${signal}, closing server gracefully...`);
      // Hand the WhatsApp sender lease back (keeps the linked session) so a restart sends immediately.
      try {
        const notificationService = require('./modules/notifications/notification.service');
        notificationService.stop();
        await require('./providers/whatsapp/BaileysProvider').stop().catch(() => {});
        await notificationService.releaseLease();
      } catch (e) { /* best-effort */ }
      setTimeout(() => process.exit(0), 3000).unref();
      server.close(() => {
        console.log('[Server] HTTP server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('[Server Error] Startup failed:', err);
    process.exit(1);
  }
}

startServer();
