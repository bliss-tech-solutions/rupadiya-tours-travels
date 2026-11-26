const mongoose = require('mongoose');

const lineSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  pnr: String,
  type: { type: String, enum: ['TICKET', 'CLAWBACK'], default: 'TICKET' },
  channel: { type: String, enum: ['ONLINE', 'WALLET', 'CASH'] },
  bookedAt: Date,
  travelDate: Date,
  seats: Number,
  ticketFare: Number,      // ticket price only (no GST / fees); negative for clawbacks
  cashHeld: Number         // cash the company office collected for this ticket (RBS money)
}, { _id: false });

/**
 * One statement between RBS (Rupadiya Bus Samiti) and a company.
 *   ticketFareOwed  − cashHeldByCompany  = net
 *   net > 0 → RBS pays the company;  net < 0 → the company pays RBS.
 */
const companySettlementSchema = new mongoose.Schema({
  statementNo: { type: String, required: true, unique: true },
  companyCode: { type: Number, required: true, index: true },
  companyName: { type: String, default: '' },
  periodFrom: { type: Date, required: true },
  periodTo: { type: Date, required: true },
  ticketCount: { type: Number, default: 0 },
  seatCount: { type: Number, default: 0 },
  ticketFareOwed: { type: Number, default: 0 },
  clawbacks: { type: Number, default: 0 },
  cashHeldByCompany: { type: Number, default: 0 },
  net: { type: Number, default: 0 },
  direction: { type: String, enum: ['RBS_PAYS_COMPANY', 'COMPANY_PAYS_RBS', 'NIL'], default: 'NIL' },
  byChannel: {
    ONLINE: { type: Number, default: 0 },
    WALLET: { type: Number, default: 0 },
    CASH: { type: Number, default: 0 }
  },
  lines: [lineSchema],
  status: { type: String, enum: ['ISSUED', 'SETTLED', 'VOID'], default: 'ISSUED', index: true },
  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  settledAt: { type: Date, default: null },
  settledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  utrNumber: { type: String, default: null },
  notes: { type: String, default: '' }
}, { timestamps: true });

companySettlementSchema.index({ companyCode: 1, periodTo: -1 });

module.exports = mongoose.model('CompanySettlement', companySettlementSchema);
