const mongoose = require('mongoose');
const { KYC_STATUS } = require('../../config/constants');

const kycSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  companyCode: {
    type: Number,
    default: null
  },
  documentType: {
    type: String,
    enum: ['AADHAAR', 'PAN', 'TRADE_LICENSE', 'VOTER_ID', 'NEPAL_CITIZENSHIP', 'NEPAL_NATIONAL_ID'],
    required: true
  },
  documentNumberMasked: {
    type: String,
    required: true
  },
  fileUrl: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: Object.values(KYC_STATUS),
    default: KYC_STATUS.PENDING
  },
  fileUrlBack: { type: String, default: '' },
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

kycSchema.index({ userId: 1 });
kycSchema.index({ status: 1 });
kycSchema.index({ companyCode: 1 });

module.exports = mongoose.model('KycDocument', kycSchema);
