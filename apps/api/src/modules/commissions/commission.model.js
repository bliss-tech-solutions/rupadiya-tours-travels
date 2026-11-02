const mongoose = require('mongoose');
const { DEFAULT_COMMISSION_TIERS, DEFAULT_BONUS_PER_SEAT } = require('../../config/constants');

const commissionTierSchema = new mongoose.Schema({
  level: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
    unique: true
  },
  name: { type: String, required: true },
  ratePerSeat: { type: Number, required: true },
  bonusPerSeat: { type: Number, default: DEFAULT_BONUS_PER_SEAT },
  isActive: { type: Boolean, default: true },
  effectiveFrom: { type: Date, default: Date.now }
}, {
  timestamps: true
});

const commissionRecordSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  pnr: { type: String, required: true },
  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    required: true
  },
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  level: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  seatCount: { type: Number, required: true },
  ratePerSeat: { type: Number, required: true },
  bonusPerSeat: { type: Number, default: 20 },
  effectiveRatePerSeat: { type: Number, required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
  companyCode: { type: Number, default: null },
  grossCommission: { type: Number, required: true },
  tcsRate: { type: Number, default: 0.01 }, // 1% TCS
  tcsDeducted: { type: Number, required: true },
  netCommission: { type: Number, required: true },
  status: {
    type: String,
    enum: ['CREDITED', 'REVERSED'],
    default: 'CREDITED'
  }
}, {
  timestamps: true
});

commissionRecordSchema.index({ agentId: 1, createdAt: -1 });
commissionRecordSchema.index({ bookingId: 1 });
commissionRecordSchema.index({ pnr: 1 });

const CommissionTier = mongoose.model('CommissionTier', commissionTierSchema);
const CommissionRecord = mongoose.model('CommissionRecord', commissionRecordSchema);

module.exports = { CommissionTier, CommissionRecord };
