const mongoose = require('mongoose');

const paymentMethodConfigSchema = new mongoose.Schema({
  scope: {
    type: String,
    enum: ['GLOBAL', 'COMPANY'],
    required: true,
    default: 'GLOBAL'
  },
  companyCode: {
    type: Number,
    default: null // Set when scope is 'COMPANY'
  },
  allowedMethods: {
    upi: { type: Boolean, default: true },
    card: { type: Boolean, default: true },
    netbanking: { type: Boolean, default: true },
    wallet: { type: Boolean, default: true }
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

paymentMethodConfigSchema.index({ scope: 1, companyCode: 1 }, { unique: true });

module.exports = mongoose.model('PaymentMethodConfig', paymentMethodConfigSchema);

