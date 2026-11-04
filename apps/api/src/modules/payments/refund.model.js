const mongoose = require('mongoose');
const { REFUND_STATUS } = require('../../config/constants');

const refundSchema = new mongoose.Schema({
  refundId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    index: true
  },
  pnr: {
    type: String,
    required: true,
    index: true
  },
  companyCode: {
    type: Number,
    required: true,
    index: true
  },
  companyName: {
    type: String,
    default: ''
  },
  customerName: {
    type: String,
    default: ''
  },
  customerPhone: {
    type: String,
    default: ''
  },
  customerEmail: {
    type: String,
    default: ''
  },
  paymentId: {
    type: String,
    default: null,
    index: true
  },
  orderId: {
    type: String,
    default: null
  },
  paymentMethod: {
    type: String,
    default: 'RAZORPAY'
  },
  totalFare: {
    type: Number,
    required: true,
    min: 0
  },
  cancellationFee: {
    type: Number,
    default: 0,
    min: 0
  },
  refundAmount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: Object.values(REFUND_STATUS),
    default: REFUND_STATUS.PENDING,
    index: true
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  processedAt: {
    type: Date,
    default: null
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  refundMode: {
    type: String,
    enum: ['GATEWAY', 'MANUAL_BANK_TRANSFER', 'WALLET'],
    default: 'GATEWAY'
  },
  gatewayRefundId: {
    type: String,
    default: null
  },
  utrNumber: {
    type: String,
    default: null
  },
  notes: {
    type: String,
    default: ''
  },
  rejectionReason: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

refundSchema.index({ status: 1, createdAt: -1 });
refundSchema.index({ companyCode: 1, createdAt: -1 });

module.exports = mongoose.model('Refund', refundSchema);

