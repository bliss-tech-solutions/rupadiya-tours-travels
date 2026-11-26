const mongoose = require('mongoose');
const { ROLES, KYC_STATUS } = require('../../config/constants');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  // Optional: phone-only (OTP / guest) accounts have no email. Never store a made-up address.
  email: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true,
    default: undefined,
    set: (v) => (v === null || v === undefined || String(v).trim() === '' ? undefined : v)
  },
  phone: { type: String, required: true, trim: true },
  passwordHash: { type: String, required: true },
  role: {
    type: String,
    enum: Object.values(ROLES),
    default: ROLES.PASSENGER
  },
  // Only meaningful for SUPER_ADMIN. PRIMARY = main RBS account (manages admins, exports user data).
  adminLevel: {
    type: String,
    enum: ['PRIMARY', 'STANDARD', null],
    default: null
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
    // Full number is needed by the company owner to send payouts; never returned by default.
    accountNumber: { type: String, default: '', select: false },
    ifscCode: { type: String, default: '' },
    upiId: { type: String, default: '' },
    bankName: { type: String, default: '' }
  },
  // RazorpayX payout beneficiary (cached so each agent is created once)
  payoutProfile: {
    contactId: { type: String, default: null },
    fundAccountId: { type: String, default: null },
    fingerprint: { type: String, default: null }
  },
  // Bus-manager onboarding details (captured on the multi-step "Add manager" flow)
  managerProfile: {
    idType: { type: String, default: '' },        // e.g. Aadhaar, Driving Licence
    idNumber: { type: String, default: '' },
    idProofUrl: { type: String, default: '' },
    photoUrl: { type: String, default: '' },
    address: { type: String, default: '' },
    notes: { type: String, default: '' }
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
