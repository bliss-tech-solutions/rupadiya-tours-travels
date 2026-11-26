const mongoose = require('mongoose');

const reconciliationRunSchema = new mongoose.Schema({
  trigger: {
    type: String,
    enum: ['MANUAL', 'SCHEDULED'],
    default: 'MANUAL'
  },
  status: {
    type: String,
    enum: ['RUNNING', 'COMPLETED', 'FAILED'],
    default: 'RUNNING'
  },
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  days: {
    type: Number,
    default: 2
  },
  counts: {
    checked: { type: Number, default: 0 },
    issues: { type: Number, default: 0 },
    healed: { type: Number, default: 0 }
  },
  details: {
    walletLiabilities: { type: Number, default: 0 },
    agentWalletsTotal: { type: Number, default: 0 },
    companyWalletsTotal: { type: Number, default: 0 },
    razorpayXBalance: { type: Number, default: 0 },
    discrepancies: [{
      type: { type: String },
      referenceId: { type: String },
      description: { type: String },
      actionTaken: { type: String },
      healed: { type: Boolean, default: false }
    }]
  },
  error: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

reconciliationRunSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ReconciliationRun', reconciliationRunSchema);
