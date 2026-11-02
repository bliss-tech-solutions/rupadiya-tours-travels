const mongoose = require('mongoose');
const { ROLES, KYC_STATUS } = require('../../config/constants');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, trim: true },
  passwordHash: { type: String, required: true },
  role: {
    type: String,
    enum: Object.values(ROLES),
    default: ROLES.PASSENGER
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null,
    index: true
  },
  companyCode: {
    type: Number,
    min: 1,
    default: null
  },
  referralCode: {
    type: String,
    unique: true,
    sparse: true,
    uppercase: true,
    trim: true,
    default: undefined
  },
  previousReferralCodes: [{
    type: String,
    uppercase: true,
    trim: true
  }],
  referralCodeUpdatedAt: {
    type: Date,
    default: Date.now
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  kycStatus: {
    type: String,
    enum: Object.values(KYC_STATUS),
    default: KYC_STATUS.NOT_SUBMITTED
  },
  bankDetails: {
    accountName: { type: String, default: '' },
    accountNumberMasked: { type: String, default: '' },
    ifscCode: { type: String, default: '' },
    upiId: { type: String, default: '' },
    bankName: { type: String, default: '' }
  },
  agencyName: {
    type: String,
    default: ''
  },
  address: {
    type: String,
    default: ''
  },
  city: {
    type: String,
    default: ''
  },
  state: {
    type: String,
    default: ''
  },
  panNumber: {
    type: String,
    default: ''
  },
  aadharNumber: {
    type: String,
    default: ''
  },
  agentLevel: {
    type: String,
    enum: ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'],
    default: 'SILVER'
  },
  customCashbackPercent: {
    type: Number,
    default: 2.0
  },
  serviceCharges: {
    bookingCharge: { type: Number, default: 50 },
    bookingChargeType: { type: String, enum: ['FIXED', 'PERCENT'], default: 'FIXED' },
    cancellationCharge: { type: Number, default: 100 },
    cancellationChargeType: { type: String, enum: ['FIXED', 'PERCENT'], default: 'FIXED' }
  },
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  lockedUntil: {
    type: Date,
    default: null
  },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

userSchema.index({ phone: 1 });
userSchema.index({ companyCode: 1, role: 1 });
userSchema.index({ companyId: 1, role: 1 });

module.exports = mongoose.model('User', userSchema);
