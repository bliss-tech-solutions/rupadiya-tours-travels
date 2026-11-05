const express = require('express');
const router = express.Router();
const { Wallet, WalletLedger } = require('./wallet.model');
const { authenticateToken } = require('../../middleware/auth.middleware');
const { paymentLimiter } = require('../../middleware/rateLimit.middleware');
const { TRANSACTION_TYPES } = require('../../config/constants');
const paymentService = require('../payments/payment.service');

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

// Initiate deposit order via verified payment gateway
// Direct balance modification is strictly blocked — wallet is only credited after verified payment capture
router.post('/deposit', paymentLimiter, authenticateToken, async (req, res, next) => {
  try {
    const { amount } = req.body;
    const numAmount = Number(amount);
    if (!numAmount || isNaN(numAmount) || numAmount < 100) {
      return res.status(400).json({ error: 'Minimum deposit amount is ₹100' });
    }

    // Direct manual balance credits without payment are blocked
    const orderResult = await paymentService.createOrder({
      amount: numAmount,
      currency: 'INR',
      purpose: 'WALLET_DEPOSIT',
      userId: req.user._id,
      companyCode: req.user.companyCode || 1,
      metadata: {
        userId: req.user._id.toString(),
        companyCode: req.user.companyCode || 1,
        agentName: req.user.name,
        initiatedFrom: 'wallet_deposit_api'
      }
    });

    res.status(200).json({
      success: true,
      requiresPayment: true,
      message: 'Payment order created. Complete payment via Razorpay to credit wallet balance.',
      ...orderResult
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
