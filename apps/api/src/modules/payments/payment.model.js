const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  paymentId: {
    type: String,
    default: null,
    index: true,
    sparse: true
  },
  signature: {
    type: String,
    default: null
  },
  amount: {
    type: Number,
    required: true,
    min: 1
  },
  currency: {
    type: String,
    default: 'INR',
    uppercase: true
  },
  status: {
    type: String,
    enum: ['CREATED', 'ATTEMPTED', 'CAPTURED', 'FAILED', 'REFUNDED'],
    default: 'CREATED',
    index: true
  },
  purpose: {
    type: String,
    enum: ['WALLET_DEPOSIT', 'TICKET_BOOKING', 'COMPANY_WALLET_DEPOSIT', 'TOUR_BOOKING'],
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  companyCode: {
    type: Number,
    default: null
  },
  paymentMethod: {
    type: String,
    enum: ['UPI', 'CARD', 'NETBANKING', 'WALLET', 'RAZORPAY', 'UNKNOWN'],
    default: 'RAZORPAY'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  idempotencyKey: {
    type: String,
    unique: true,
    sparse: true
  },
  verifiedAt: {
    type: Date,
    default: null
  },
  failureReason: {
    type: String,
    default: null
  },
  refundDetails: {
    refundId: { type: String, default: null },
    amount: { type: Number, default: 0 },
    status: { type: String, default: null },
    refundedAt: { type: Date, default: null }
  },
  rawGatewayResponse: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
}, {
  timestamps: true
});

paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ purpose: 1, status: 1 });

module.exports = mongoose.model('Payment', paymentSchema);

