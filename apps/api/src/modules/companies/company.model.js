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
  annualTarget: {
    targetPassengers: { type: Number, default: 12000 },
    currentPassengers: { type: Number, default: 0 },
    financialYear: { type: String, default: '2026-2027' }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Company', companySchema);
