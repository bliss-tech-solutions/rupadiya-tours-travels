const mongoose = require('mongoose');
const { WITHDRAWAL_STATUS } = require('../../config/constants');

const withdrawalSchema = new mongoose.Schema({
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  companyCode: {
    type: Number,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 500
  },
  payoutDetails: {
    method: { type: String, enum: ['bank', 'upi'], default: 'bank' },
    accountName: { type: String, default: '' },
    accountNumberMasked: { type: String, default: '' },
    ifscCode: { type: String, default: '' },
    upiId: { type: String, default: '' }
  },
  status: {
    type: String,
    enum: Object.values(WITHDRAWAL_STATUS),
    default: WITHDRAWAL_STATUS.PENDING
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
  }
}, {
  timestamps: true
});

withdrawalSchema.index({ agentId: 1 });
withdrawalSchema.index({ companyCode: 1, status: 1 });

module.exports = mongoose.model('WithdrawalRequest', withdrawalSchema);
