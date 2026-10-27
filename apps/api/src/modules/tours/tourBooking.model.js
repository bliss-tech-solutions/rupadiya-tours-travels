const mongoose = require('mongoose');

const travelerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  age: { type: Number, required: true },
  gender: { type: String, enum: ['male', 'female', 'other'], default: 'male' },
  phone: { type: String, default: '' }
}, { _id: false });

const tourBookingSchema = new mongoose.Schema({
  bookingId: { type: String, required: true, unique: true },
  tourId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tour', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  bookedByAgentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  companyCode: { type: Number, default: 1 },
  departureDate: { type: Date, required: true },
  travelers: [travelerSchema],
  contactEmail: { type: String, required: true },
  contactPhone: { type: String, required: true },
  baseFareTotal: { type: Number, required: true },
  gstAmount: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  agentCommission: { type: Number, default: 0 },
  paymentStatus: {
    type: String,
    enum: ['PENDING', 'PAID', 'CANCELLED'],
    default: 'PENDING'
  },
  paymentProvider: {
    type: String,
    enum: ['dummy', 'razorpay', 'agent_wallet'],
    default: 'dummy'
  },
  paymentDetails: {
    paymentId: { type: String },
    paidAt: { type: Date }
  },
  specialRequests: { type: String, default: '' }
}, {
  timestamps: true
});

tourBookingSchema.index({ userId: 1 });
tourBookingSchema.index({ bookedByAgentId: 1 });

module.exports = mongoose.model('TourBooking', tourBookingSchema);
