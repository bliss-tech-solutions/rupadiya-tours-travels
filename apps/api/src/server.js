const app = require('./app');
const env = require('./config/env');
const { connectDB } = require('./config/db');

async function startServer() {
  try {
    // Attempt DB connection
    await connectDB();

    let keepAliveTimer = null;
    const server = app.listen(env.PORT, () => {
      console.log(`====================================================`);
      console.log(`  Rupadiya Bus Booking Platform API v1.0.0          `);
      console.log(`  Server running on http://localhost:${env.PORT}     `);
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

