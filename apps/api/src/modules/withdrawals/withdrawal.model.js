const mongoose = require('mongoose');
const { WITHDRAWAL_STATUS } = require('../../config/constants');

const withdrawalSchema = new mongoose.Schema({
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null,
    index: true
  },
  companyCode: {
    type: Number,
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 500
  },
  payoutDetails: {
    method: { type: String, enum: ['bank', 'upi'], default: 'bank' },
    accountName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    accountNumberMasked: { type: String, default: '' },
    ifscCode: { type: String, default: '' },
    bankName: { type: String, default: '' },
    upiId: { type: String, default: '' }
  },
  status: {
    type: String,
    enum: Object.values(WITHDRAWAL_STATUS),
    default: WITHDRAWAL_STATUS.PENDING
  },
  utrNumber: {
    type: String,
    default: '',
    index: true
  },
  paymentReference: {
    type: String,
    default: ''
  },
  disbursedAt: {
    type: Date,
    default: null
  },
  rejectionReason: {
    type: String,
    default: ''
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

withdrawalSchema.index({ companyCode: 1, status: 1 });
withdrawalSchema.index({ companyId: 1, status: 1 });
withdrawalSchema.index({ agentId: 1, createdAt: -1 });

module.exports = mongoose.model('WithdrawalRequest', withdrawalSchema);
