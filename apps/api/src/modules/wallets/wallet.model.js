const mongoose = require('mongoose');
const { TRANSACTION_TYPES } = require('../../config/constants');

const walletLedgerSchema = new mongoose.Schema({
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: true,
    index: true
  },
  userId: {
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
    default: null,
    index: true
  },
  entryType: {
    type: String,
    enum: ['CREDIT', 'DEBIT'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01
  },
  balanceAfter: {
    type: Number,
    required: true
  },
  transactionType: {
    type: String,
    enum: Object.values(TRANSACTION_TYPES),
    required: true
  },
  referenceType: {
    type: String,
    enum: ['BOOKING', 'WITHDRAWAL', 'DEPOSIT', 'COMMISSION', 'ADMIN_ADJUSTMENT', 'TRANSFER'],
    required: true
  },
  referenceId: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  idempotencyKey: {
    type: String,
    required: true,
    unique: true
  }
}, {
  timestamps: true
});

walletLedgerSchema.index({ userId: 1, createdAt: -1 });
walletLedgerSchema.index({ referenceId: 1, transactionType: 1 });
walletLedgerSchema.index({ companyId: 1, createdAt: -1 });

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null,
    index: true
  },
  companyCode: {
    type: Number,
    default: null,
    index: true
  },
  ownerType: {
    type: String,
    enum: ['AGENT', 'COMPANY'],
    default: 'AGENT'
  },
  availableBalance: {
    type: Number,
    default: 0
  },
  reservedBalance: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'INR'
  },
  isLocked: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const Wallet = mongoose.model('Wallet', walletSchema);
const WalletLedger = mongoose.model('WalletLedger', walletLedgerSchema);

module.exports = { Wallet, WalletLedger };
