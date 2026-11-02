const mongoose = require('mongoose');

const taxEntrySchema = new mongoose.Schema({
  taxType: {
    type: String,
    enum: ['GST', 'TCS'],
    required: true
  },
  refType: {
    type: String,
    enum: ['BOOKING', 'COMMISSION', 'CANCELLATION'],
    required: true
  },
  refId: {
    type: String,
    required: true
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    default: null
  },
  commissionRecordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CommissionRecord',
    default: null
  },
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
    default: null
  },
  taxableAmount: {
    type: Number,
    required: true
  },
  taxRate: {
    type: Number,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  period: {
    type: String, // e.g. "2026-10"
    required: true
  },
  financialYear: {
    type: String, // e.g. "2026-2027"
    required: true
  },
  status: {
    type: String,
    enum: ['ACCRUED', 'REVERSED', 'FILED'],
    default: 'ACCRUED'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

taxEntrySchema.index({ taxType: 1, period: 1 });
taxEntrySchema.index({ companyCode: 1, period: 1 });
taxEntrySchema.index({ companyId: 1, period: 1 });
taxEntrySchema.index({ refId: 1, taxType: 1 });
taxEntrySchema.index({ agentId: 1, taxType: 1 });

const TaxEntry = mongoose.model('TaxEntry', taxEntrySchema);

module.exports = TaxEntry;
