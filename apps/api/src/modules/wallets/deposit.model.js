const mongoose = require('mongoose');

const depositSchema = new mongoose.Schema({
  depositId: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null,
    index: true
  },
  companyCode: {
    type: Number,
    default: null
  },
  amount: {
    type: Number,
    required: true,
    min: 100
  },
  paymentMethod: {
    type: String,
    enum: ['UPI_QR', 'BANK_TRANSFER', 'UPI', 'CARD', 'NETBANKING', 'RAZORPAY', 'WALLET'],
    default: 'UPI'
  },
  referenceId: {
    type: String,
    required: true
  },
  bankDetails: {
    bankName: { type: String, default: '' },
    senderAccount: { type: String, default: '' },
    notes: { type: String, default: '' }
  },
  status: {
    type: String,
    enum: ['PENDING', 'COMPLETED', 'FAILED', 'REJECTED'],
    default: 'PENDING'
  },
  verifiedBy: {
    type: String,
    default: 'SYSTEM_AUTOMATION'
  },
  verifiedAt: {
    type: Date,
    default: null
  },
  rejectionReason: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

depositSchema.index({ userId: 1, createdAt: -1 });
depositSchema.index({ referenceId: 1 });
depositSchema.index({ status: 1 });

module.exports = mongoose.model('DepositRequest', depositSchema);

