const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  companyCode: {
    type: Number,
    required: true,
    unique: true,
    min: 1,
    max: 33
  },
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  contactPhone: { type: String, default: '+91 9876543210' },
  contactEmail: { type: String, default: '' },
  address: { type: String, default: 'Transport Nagar, Rupadiya, Uttar Pradesh' },
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
    targetPassengers: { type: Number, default: 10000 },
    currentPassengers: { type: Number, default: 0 },
    financialYear: { type: String, default: '2026-2027' }
  }
}, {
  timestamps: true
});

companySchema.index({ ownerId: 1 });

module.exports = mongoose.model('Company', companySchema);

