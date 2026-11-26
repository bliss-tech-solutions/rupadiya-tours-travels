const mongoose = require('mongoose');

/**
 * Executes work inside an atomic MongoDB transaction session when replica set is active.
 * Automatically aborts and rolls back on exception, or executes with graceful standalone fallback.
 * 
 * @param {Function} work - Async callback receiving `(session)` to pass to participating queries.
 */
async function withTransaction(work) {
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    return await work(null);
  }

  // Detect whether MongoDB server supports transactions (ReplicaSet or Sharded)
  let supportsTxn = false;
  try {
    const topologyType = mongoose.connection.client?.topology?.description?.type;
    supportsTxn = Boolean(topologyType && (topologyType.includes('Replica') || topologyType.includes('Sharded')));
  } catch (e) {
    supportsTxn = false;
  }

  if (supportsTxn) {
    // Concurrent requests on the same wallet / trip can hit a transient write conflict; the whole
    // unit of work is rolled back, so it is safe to run it again (every write uses the session).
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; ; attempt++) {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        const result = await work(session);
        await session.commitTransaction();
        return result;
      } catch (err) {
        try { await session.abortTransaction(); } catch (e) { /* already aborted */ }
        const transient = (typeof err.hasErrorLabel === 'function' && err.hasErrorLabel('TransientTransactionError')) || err.code === 112 || err.code === 251;
        if (transient && attempt < MAX_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, 20 * attempt + Math.floor(Math.random() * 30)));
          continue;
        }
        // Nothing from this unit of work was written: callers must NOT run standalone-style compensation.
        try { err.rolledBack = true; } catch (e) { /* frozen error */ }
        throw err;
      } finally {
        session.endSession();
      }
    }
  }

  // Graceful standalone fallback for unit tests and local dev
  return await work(null);
}

module.exports = { withTransaction };

