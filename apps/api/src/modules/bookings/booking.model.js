const mongoose = require('mongoose');
const { BOOKING_STATUS, PAYMENT_STATUS } = require('../../config/constants');

// Children under 5 travelling free on an adult's lap (no seat)
const infantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  age: { type: Number, required: true, min: 0, max: 4 },
  gender: { type: String, enum: ['male', 'female', 'other'], required: true }
}, { _id: false });

const passengerTicketSchema = new mongoose.Schema({
  seatNumber: { type: String, required: true },
  name: { type: String, required: true },
  age: { type: Number, required: true },
  gender: { type: String, enum: ['male', 'female', 'other'], required: true },
  fare: { type: Number, required: true },
  isChild: { type: Boolean, default: false },          // seated passenger aged 5-11
  infants: { type: [infantSchema], default: [] },
  // Journey tracking by the bus manager
  journeyStatus: { type: String, enum: ['NOT_BOARDED', 'BOARDED', 'NO_SHOW', 'DROPPED'], default: 'NOT_BOARDED' },
  boardedAt: { type: Date, default: null },
  boardedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  droppedAt: { type: Date, default: null },
  boardedAtPoint: { type: String, default: null },   // stop where the manager actually boarded the passenger
  droppedAtPoint: { type: String, default: null }    // stop where the passenger actually got off
}, { _id: false });

// A boarding / dropping point chosen on the bus by the manager (passenger late → next stop, gets off earlier, …)
const plannedPointSchema = new mongoose.Schema({
  id: { type: String, default: null },
  name: { type: String, required: true },
  time: { type: String, default: null }
}, { _id: false });

const journeyChangeSchema = new mongoose.Schema({
  type: { type: String, enum: ['BOARDING', 'DROPPING'], required: true },
  from: { type: String, default: '' },
  to: { type: String, required: true },
  reason: { type: String, default: '' },
  at: { type: Date, default: Date.now },
  by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { _id: false });

const emergencyContactSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  phone: { type: String, default: '' },
  relation: { type: String, default: '' }
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
    email: { type: String, default: '' }, // optional — never a made-up address
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
  emergencyContact: { type: emergencyContactSchema, default: null },
  // RBS ↔ company settlement this ticket was included in (and a later clawback if cancelled afterwards)
  settlement: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'CompanySettlement', default: null },
    clawbackId: { type: mongoose.Schema.Types.ObjectId, ref: 'CompanySettlement', default: null }
  },
  passengers: [passengerTicketSchema],
  boardingPoint: {
    name: { type: String, required: true },
    time: { type: String, default: 'Scheduled Time' }
  },
  droppingPoint: {
    name: { type: String, required: true },
    time: { type: String, default: 'Scheduled Time' }
  },
  // Changes made on the bus by the bus manager. The original boardingPoint / droppingPoint stay as booked.
  journeyPlan: {
    boardingPoint: { type: plannedPointSchema, default: null },
    droppingPoint: { type: plannedPointSchema, default: null }
  },
  journeyLog: { type: [journeyChangeSchema], default: [] },
  fareBreakdown: {
    baseFare: { type: Number, required: true },
    seatCount: { type: Number, required: true },
    subtotal: { type: Number, required: true },
    gstAmount: { type: Number, required: true },
    insuranceAmount: { type: Number, default: 0 },
    insurancePerPassenger: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    platformFee: { type: Number, default: 0 },
    gatewayFee: { type: Number, default: 0 },           // estimate charged to the customer (online only)
    gatewayFeeActual: { type: Number, default: null },  // Razorpay's real fee (₹) after capture
    gatewayTaxActual: { type: Number, default: null },  // GST on that fee (₹)
    agentServiceCharge: { type: Number, default: 0 },
    paymentChannel: { type: String, enum: ['ONLINE', 'WALLET', 'CASH'], default: 'ONLINE' },
    customerTotal: { type: Number, default: null },
    totalPayable: { type: Number, required: true }
  },
  // Agent cash (COD) tickets: amount the agent must hand over at the company office before boarding
  cashCollection: {
    status: { type: String, enum: ['PENDING', 'RECEIVED', null], default: null },
    amountDue: { type: Number, default: 0 },
    receivedAt: { type: Date, default: null },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    receiptNo: { type: String, default: null },
    // "Received" can be reverted if it was marked by mistake; each revert is kept here.
    revertCount: { type: Number, default: 0 },
    history: [{
      _id: false,
      action: { type: String, enum: ['RECEIVED', 'REVERTED'] },
      receiptNo: String,
      amount: Number,
      at: Date,
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      byName: String,
      reason: String
    }]
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
    default: BOOKING_STATUS.PENDING_PAYMENT
  },
  paymentStatus: {
    type: String,
    enum: Object.values(PAYMENT_STATUS),
    default: PAYMENT_STATUS.PENDING
  },
  paymentProvider: {
    type: String,
    enum: ['RAZORPAY', 'AGENT_WALLET', 'dummy', 'razorpay', 'agent_wallet', 'agent_cash'],
    default: 'RAZORPAY'
  },
  paymentOrderId: {
    type: String,
    default: null
  },
  // Sales channel & agent attribution
  channel: {
    type: String,
    enum: ['USER_WEB', 'AGENT_PORTAL', 'COMPANY_DESK', 'ADMIN'],
    default: 'USER_WEB'
  },
  bookedByAgentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  // Service charge an agent collects directly from the customer (not part of wallet debit / gateway charge)
  agentServiceCharge: {
    type: Number,
    default: 0,
    min: 0
  },
  offerCode: {
    type: String,
    default: null
  },
  paymentReference: {
    type: String,
    default: ''
  },
  cancellationDetails: {
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    refundAmount: { type: Number, default: 0 },
    cancellationFee: { type: Number, default: 0 },
    refundId: { type: String, default: null },
    refundRouting: { type: String, default: null },
    reason: { type: String, default: '' }
  }
}, {
  timestamps: true
});

bookingSchema.index({ passengerId: 1 });
bookingSchema.index({ companyCode: 1 });
bookingSchema.index({ tripId: 1 });
bookingSchema.index({ companyCode: 1, 'cashCollection.status': 1 });
bookingSchema.index({ bookedByAgentId: 1, 'cashCollection.status': 1 });
bookingSchema.index({ referralAgentId: 1, createdAt: -1 });

module.exports = mongoose.model('Booking', bookingSchema);
