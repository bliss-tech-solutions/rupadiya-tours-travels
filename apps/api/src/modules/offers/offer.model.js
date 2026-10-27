const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  discountPercent: { type: Number, required: true, min: 1, max: 90 },
  maxDiscountAmount: { type: Number, default: 500 },
  minBookingAmount: { type: Number, default: 500 },
  validUntil: { type: Date, required: true },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('Offer', offerSchema);

