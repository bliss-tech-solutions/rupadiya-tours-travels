const mongoose = require('mongoose');

const webhookEventSchema = new mongoose.Schema({
  eventId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  eventType: {
    type: String,
    required: true,
    index: true
  },
  orderId: {
    type: String,
    default: null,
    index: true
  },
  paymentId: {
    type: String,
    default: null,
    index: true
  },
  processed: {
    type: Boolean,
    default: true
  },
  processedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('WebhookEvent', webhookEventSchema);

