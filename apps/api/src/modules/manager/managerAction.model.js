const mongoose = require('mongoose');

/**
 * Every boarding / drop / trip action from the bus-manager app carries a clientActionId,
 * so an action queued offline and replayed after reconnecting, or sent twice by a double tap,
 * is applied only once.
 */
const managerActionSchema = new mongoose.Schema({
  clientActionId: { type: String, required: true, unique: true },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },
  action: { type: String, required: true },
  // RUNNING while the first request works on it; parallel duplicates (double taps) wait for DONE.
  status: { type: String, enum: ['RUNNING', 'DONE'], default: 'DONE' },
  result: { type: mongoose.Schema.Types.Mixed, default: null }
}, { timestamps: true });

module.exports = mongoose.models.ManagerAction || mongoose.model('ManagerAction', managerActionSchema);
