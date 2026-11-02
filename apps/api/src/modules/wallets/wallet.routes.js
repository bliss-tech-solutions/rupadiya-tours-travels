const express = require('express');
const router = express.Router();
const { Wallet, WalletLedger } = require('./wallet.model');
const { authenticateToken } = require('../../middleware/auth.middleware');
const { paymentLimiter } = require('../../middleware/rateLimit.middleware');
const { TRANSACTION_TYPES } = require('../../config/constants');

// Get wallet balance
router.get(['/', '/me'], authenticateToken, async (req, res, next) => {
  try {
    let wallet = await Wallet.findOne({ userId: req.user._id });
    if (!wallet) {
      wallet = await Wallet.create({
        userId: req.user._id,
        companyCode: req.user.companyCode || 1,
        availableBalance: 0,
        reservedBalance: 0
      });
    }

    const walletPayload = {
      availableBalance: wallet.availableBalance,
      reservedBalance: wallet.reservedBalance,
      totalBalance: wallet.availableBalance + wallet.reservedBalance,
      balance: wallet.availableBalance,
      currency: wallet.currency || 'INR'
    };

    res.json({
      success: true,
      data: walletPayload,
      wallet: walletPayload,
      balance: wallet.availableBalance,
      walletBalance: wallet.availableBalance
    });
  } catch (err) {
    next(err);
  }
});

// Get wallet ledger
router.get('/ledger', authenticateToken, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;

    const entries = await WalletLedger.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await WalletLedger.countDocuments({ userId: req.user._id });

    res.json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      ledger: entries
    });
  } catch (err) {
    next(err);
  }
});

// Deposit into wallet
router.post('/deposit', paymentLimiter, authenticateToken, async (req, res, next) => {
  try {
    const { amount, paymentMethod } = req.body;
    const numAmount = Number(amount);
    if (!numAmount || numAmount < 100) {
      return res.status(400).json({ error: 'Minimum deposit amount is ₹100' });
    }

    let wallet = await Wallet.findOne({ userId: req.user._id });
    if (!wallet) {
      wallet = await Wallet.create({
        userId: req.user._id,
        companyCode: req.user.companyCode,
        availableBalance: 0,
        reservedBalance: 0
      });
    }

    wallet.availableBalance += numAmount;
    await wallet.save();

    const idempotencyKey = `DEP_${req.user._id}_${Date.now()}`;
    const ledger = await WalletLedger.create({
      walletId: wallet._id,
      userId: req.user._id,
      companyCode: req.user.companyCode,
      entryType: 'CREDIT',
      amount: numAmount,
      balanceAfter: wallet.availableBalance,
      transactionType: TRANSACTION_TYPES.WALLET_DEPOSIT,
      referenceType: 'DEPOSIT',
      referenceId: `DEP_${Date.now()}`,
      description: `Wallet top-up via ${paymentMethod || 'Online Payment'}`,
      idempotencyKey
    });

    res.status(201).json({
      success: true,
      message: `Successfully deposited ₹${numAmount} to wallet`,
      wallet: {
        availableBalance: wallet.availableBalance,
        reservedBalance: wallet.reservedBalance
      },
      ledger
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
