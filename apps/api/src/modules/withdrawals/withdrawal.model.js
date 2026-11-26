const mongoose = require('mongoose');
const { WITHDRAWAL_STATUS } = require('../../config/constants');

const withdrawalSchema = new mongoose.Schema({
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null,
    index: true
  },
  companyCode: {
    type: Number,
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 500
  },
  payoutDetails: {
    method: { type: String, enum: ['bank', 'upi'], default: 'bank' },
    accountName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    accountNumberMasked: { type: String, default: '' },
    ifscCode: { type: String, default: '' },
    bankName: { type: String, default: '' },
    upiId: { type: String, default: '' }
  },
  status: {
    type: String,
    enum: Object.values(WITHDRAWAL_STATUS),
    default: WITHDRAWAL_STATUS.PENDING
  },
  utrNumber: {
    type: String,
    default: '',
    index: true
  },
  paymentReference: {
    type: String,
    default: ''
  },
  disbursedAt: {
    type: Date,
    default: null
  },
  rejectionReason: {
    type: String,
    default: ''
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  notes: {
    type: String,
    default: ''
  },
  // Two-stage approval: the company approves (after checking the agent's KYC), then RBS admin pays.
  // While PROCESSING: AWAITING_ADMIN_PAYMENT = company approved, waiting for admin to pay;
  //                   DISBURSING = admin sent the bank payout, waiting for confirmation.
  processingStage: {
    type: String,
    enum: ['AWAITING_ADMIN_PAYMENT', 'DISBURSING', null],
    default: null
  },
  approvals: {
    company: {
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      name: { type: String, default: '' },
      at: { type: Date, default: null },
      kycStatusAtApproval: { type: String, default: '' }
    },
    admin: {
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      name: { type: String, default: '' },
      at: { type: Date, default: null },
      mode: { type: String, enum: ['ONLINE', 'MANUAL', null], default: null }
    }
  },
  // Automatic bank payout (RazorpayX) or manual transfer details
  payout: {
    provider: { type: String, enum: ['RAZORPAYX', 'MANUAL', null], default: null },
    attempt: { type: Number, default: 0 },
    payoutId: { type: String, default: null, index: true },
    idempotencyKey: { type: String, default: null },
    status: { type: String, default: null },
    mode: { type: String, default: null },
    fundAccountId: { type: String, default: null },
    utr: { type: String, default: null },
    failureReason: { type: String, default: null },
    initiatedAt: { type: Date, default: null },
    processedAt: { type: Date, default: null },
    lastCheckedAt: { type: Date, default: null }
  },
  // Which company-wallet debit funded the current attempt (refunded if the payout fails)
  companyFunding: {
    ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    debitKey: { type: String, default: null },
    refunded: { type: Boolean, default: false }
  }
}, {
  timestamps: true
});

withdrawalSchema.index({ companyCode: 1, status: 1 });
withdrawalSchema.index({ status: 1, 'payout.provider': 1, updatedAt: 1 });
withdrawalSchema.index({ companyId: 1, status: 1 });
withdrawalSchema.index({ agentId: 1, createdAt: -1 });
// At most one PENDING withdrawal per agent, enforced by the database (race-proof).
withdrawalSchema.index({ agentId: 1 }, { unique: true, partialFilterExpression: { status: 'PENDING' }, name: 'one_pending_withdrawal_per_agent' });

module.exports = mongoose.model('WithdrawalRequest', withdrawalSchema);
