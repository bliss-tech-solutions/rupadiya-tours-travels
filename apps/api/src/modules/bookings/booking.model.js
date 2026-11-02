const mongoose = require('mongoose');
const { BOOKING_STATUS, PAYMENT_STATUS } = require('../../config/constants');

const passengerTicketSchema = new mongoose.Schema({
  seatNumber: { type: String, required: true },
  name: { type: String, required: true },
  age: { type: Number, required: true },
  gender: { type: String, enum: ['male', 'female', 'other'], required: true },
  fare: { type: Number, required: true }
}, { _id: false });

const bookingSchema = new mongoose.Schema({
  bookingId: {
    type: String,
    required: true,
    unique: true
  },
  pnr: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  passengerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  contactDetails: {
    email: { type: String, required: true },
    phone: { type: String, required: true }
  },
  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    required: true
  },
  routeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route',
    required: true
  },
  busId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus',
    required: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null,
    index: true
  },
  companyCode: {
    type: Number,
    required: true
  },
  referralAgentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  seatNumbers: [{ type: String, required: true }],
  passengers: [passengerTicketSchema],
  boardingPoint: {
    name: { type: String, required: true },
    time: { type: String, default: 'Scheduled Time' }
  },
  droppingPoint: {
    name: { type: String, required: true },
    time: { type: String, default: 'Scheduled Time' }
  },
  fareBreakdown: {
    baseFare: { type: Number, required: true },
    seatCount: { type: Number, required: true },
    subtotal: { type: Number, required: true },
    gstAmount: { type: Number, required: true },
    insuranceAmount: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    totalPayable: { type: Number, required: true }
  },
  insuranceOpted: {
    type: Boolean,
    default: false
  },
  insurancePremium: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: Object.values(BOOKING_STATUS),
    default: BOOKING_STATUS.CONFIRMED
  },
  paymentStatus: {
    type: String,
    enum: Object.values(PAYMENT_STATUS),
    default: PAYMENT_STATUS.SUCCESS
  },
  paymentProvider: {
    type: String,
    default: 'dummy'
  },
  paymentReference: {
    type: String,
    default: ''
  },
  cancellationDetails: {
    cancelledAt: { type: Date, default: null },
    refundAmount: { type: Number, default: 0 },
    cancellationFee: { type: Number, default: 0 },
    reason: { type: String, default: '' }
  }
}, {
  timestamps: true
});

bookingSchema.index({ passengerId: 1 });
bookingSchema.index({ companyCode: 1 });
bookingSchema.index({ tripId: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
