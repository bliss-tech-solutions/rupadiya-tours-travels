const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  companyCode: {
    type: Number,
    required: true,
    unique: true,
    min: 1,
    max: 35
  },
  rank: {
    type: Number,
    min: 1,
    max: 35,
    index: true
  },
  shortCode: {
    type: String,
    uppercase: true,
    trim: true,
    index: true
  },
  name: { type: String, required: true, trim: true },
  shareCapital: { type: Number, default: 0 },
  slug: { type: String, required: true, unique: true },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  contactPhone: { type: String, default: '' },
  contactEmail: { type: String, default: '' },
  city: { type: String, default: 'Rupadiya' },
  state: { type: String, default: 'Uttar Pradesh' },
  address: { type: String, default: '' },
  status: {
    type: String,
    enum: ['ACTIVE', 'SUSPENDED'],
    default: 'ACTIVE'
  },
  paymentMethods: [
    {
      method: { type: String, enum: ['upi', 'card', 'netbanking', 'cash'] },
      enabled: { type: Boolean, default: true }
    }
  ],
  // WhatsApp number that receives trip start / completion summaries for this company
  notifyPhone: { type: String, default: '' },
  // Agent cash (COD) rules for this company
  cashPolicy: {
    enabled: { type: Boolean, default: true },
    cutoffHours: { type: Number, default: 2, min: 0, max: 72 },          // no new cash tickets this close to departure
    agentCreditLimit: { type: Number, default: 25000, min: 0 }            // max unpaid cash per agent
  },
  // Bank account where RBS pays this company's settlement
  settlementBank: {
    accountName: { type: String, default: '' },
    accountNumber: { type: String, default: '', select: false },
    accountNumberMasked: { type: String, default: '' },
    ifscCode: { type: String, default: '' },
    bankName: { type: String, default: '' },
    upiId: { type: String, default: '' }
  },
  annualTarget: {
    targetPassengers: { type: Number, default: 12000 },
    currentPassengers: { type: Number, default: 0 },
    financialYear: { type: String, default: '2026-2027' }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Company', companySchema);
