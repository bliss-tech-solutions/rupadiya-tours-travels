const mongoose = require('mongoose');
const env = require('./env');

let isConnected = false;

async function connectDB() {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  try {
    const conn = await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true,
      dbName: env.MONGODB_DB
    });
    isConnected = true;
    console.log(`[DB] Connected to MongoDB: ${conn.connection.host}/${conn.connection.name}`);
    return conn.connection;
  } catch (err) {
    isConnected = false;
    console.error(`[DB Error] Could not connect to MongoDB: ${err.message}`);
    
    // Fail-closed in production: Never allow payment & booking server to run in degraded DB state
    if (env.NODE_ENV === 'production') {
      console.error(`[FATAL] Exiting process due to database connection failure in production.`);
      process.exit(1);
    }
    
    console.warn(`[DB Warning] Running with limited DB persistence. Check MONGODB_URI in .env.`);
    return null;
  }
}

mongoose.connection.on('connected', () => {
  isConnected = true;
});

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.warn('[DB] MongoDB disconnected');
});

function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

module.exports = { connectDB, mongoose, isDbConnected };
