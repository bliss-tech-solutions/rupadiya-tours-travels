const app = require('./app');
const env = require('./config/env');
const { connectDB } = require('./config/db');

async function startServer() {
  try {
    // Attempt DB connection
    await connectDB();

    const server = app.listen(env.PORT, () => {
      console.log(`====================================================`);
      console.log(`  Rupadiya Bus Booking Platform API v1.0.0          `);
      console.log(`  Server running on http://localhost:${env.PORT}     `);
      console.log(`  Environment: ${env.NODE_ENV}                       `);
      console.log(`====================================================`);
    });

    const shutdown = async (signal) => {
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

