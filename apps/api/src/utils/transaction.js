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
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const result = await work(session);
      await session.commitTransaction();
      return result;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  // Graceful standalone fallback for unit tests and local dev
  return await work(null);
}

module.exports = { withTransaction };

