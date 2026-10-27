const mongoose = require('mongoose');
const { TRANSACTION_TYPES } = require('../../config/constants');

const walletLedgerSchema = new mongoose.Schema({
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  companyCode: {
    type: Number,
    default: null
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
    enum: ['BOOKING', 'WITHDRAWAL', 'DEPOSIT', 'COMMISSION', 'ADMIN_ADJUSTMENT'],
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

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  companyCode: {
    type: Number,
    default: null
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
  }
}, {
  timestamps: true
});

walletSchema.index({ companyCode: 1 });

const Wallet = mongoose.model('Wallet', walletSchema);
const WalletLedger = mongoose.model('WalletLedger', walletLedgerSchema);

module.exports = { Wallet, WalletLedger };

