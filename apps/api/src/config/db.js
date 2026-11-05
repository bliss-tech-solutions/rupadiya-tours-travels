const mongoose = require('mongoose');
const env = require('./env');

// Normalize localhost to 127.0.0.1 to avoid Windows IPv6 (::1) connection rejection
function getMongoUri() {
  let uri = env.MONGODB_URI || 'mongodb://127.0.0.1:27017/rupadiya';
  if (uri.includes('localhost:27017')) {
    uri = uri.replace('localhost:27017', '127.0.0.1:27017');
  }
  return uri;
}

let isConnecting = false;
let reconnectTimer = null;
let isConnected = false;

function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

async function connectDB(retries = 5, delayMs = 1500) {
  if (isDbConnected()) {
    isConnected = true;
    return mongoose.connection;
  }

  if (isConnecting) {
    // Wait for in-flight connection attempt
    for (let i = 0; i < 20; i++) {
      if (isDbConnected()) {
        isConnected = true;
        return mongoose.connection;
      }
      await new Promise(r => setTimeout(r, 200));
    }
  }

  isConnecting = true;
  const uri = getMongoUri();

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 4000,
        connectTimeoutMS: 8000,
        socketTimeoutMS: 45000,
        maxPoolSize: 50,
        minPoolSize: 5,
        autoIndex: true,
        dbName: env.MONGODB_DB || 'rupadiya'
      });
      isConnecting = false;
      isConnected = true;
      console.log(`[DB] Connected to MongoDB: ${conn.connection.host}/${conn.connection.name}`);
      return conn.connection;
    } catch (err) {
      console.error(`[DB Error] Connection attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt < retries) {
        console.log(`[DB] Retrying connection in ${delayMs / 1000}s...`);
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }

  isConnecting = false;
  isConnected = false;

  // Fail-closed in production: Never allow payment & booking server to run in degraded DB state
  if (env.NODE_ENV === 'production') {
    console.error(`[FATAL] Exiting process due to database connection failure in production.`);
    process.exit(1);
  }

  console.warn(`[DB Warning] Running without active DB connection. Background auto-reconnect active.`);
  scheduleAutoReconnect();
  return null;
}

function scheduleAutoReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    if (!isDbConnected()) {
      console.log('[DB] Attempting background reconnection...');
      await connectDB(2, 1000);
    }
  }, 4000);
}

mongoose.connection.on('connected', () => {
  isConnected = true;
});

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.warn('[DB] MongoDB disconnected. Scheduling automatic reconnection...');
  scheduleAutoReconnect();
});

mongoose.connection.on('error', (err) => {
  isConnected = false;
  console.error('[DB] MongoDB connection error:', err.message);
  scheduleAutoReconnect();
});

mongoose.connection.on('reconnected', () => {
  isConnected = true;
  console.log('[DB] MongoDB successfully reconnected.');
});

module.exports = { connectDB, isDbConnected, mongoose, getMongoUri };
