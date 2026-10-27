const express = require('express');
const router = express.Router();
const WithdrawalRequest = require('./withdrawal.model');
const { Wallet, WalletLedger } = require('../wallets/wallet.model');
const { authenticateToken } = require('../../middleware/auth.middleware');
const { authorizeRoles } = require('../../middleware/rbac.middleware');
const { ROLES, KYC_STATUS, TRANSACTION_TYPES, WITHDRAWAL_STATUS } = require('../../config/constants');

// Agent requests withdrawal
router.post('/', authenticateToken, authorizeRoles(ROLES.AGENT), async (req, res, next) => {
  try {
    const { amount, payoutDetails } = req.body;
    const numAmount = Number(amount);

    // 1. KYC verification requirement
    if (req.user.kycStatus !== KYC_STATUS.VERIFIED) {
      return res.status(403).json({
        error: 'Withdrawals remain disabled until your KYC is verified by the administrator.'
      });
    }

    // 2. Minimum amount policy
    if (!numAmount || numAmount < 500) {
      return res.status(400).json({
        error: 'Minimum withdrawal amount is ₹500.'
      });
    }

    // 3. Wallet available balance check
    const wallet = await Wallet.findOne({ userId: req.user._id });
    if (!wallet || wallet.availableBalance < numAmount) {
      return res.status(400).json({
        error: `Insufficient available balance. You have ₹${wallet ? wallet.availableBalance : 0} available.`
      });
    }

    // 4. Check if there is already a pending withdrawal
    const existingPending = await WithdrawalRequest.findOne({
      agentId: req.user._id,
      status: WITHDRAWAL_STATUS.PENDING
    });
    if (existingPending) {
      return res.status(400).json({
        error: 'You already have an active pending withdrawal request under review.'
      });
    }

    // 5. Reserve funds: deduct from availableBalance and add to reservedBalance
    wallet.availableBalance -= numAmount;
    wallet.reservedBalance += numAmount;
    await wallet.save();

    // 6. Create withdrawal request
    const withdrawal = new WithdrawalRequest({
      agentId: req.user._id,
      companyCode: req.user.companyCode,
      amount: numAmount,
      payoutDetails: payoutDetails || {
        method: 'bank',
        accountName: req.user.bankDetails?.accountName || req.user.name,
        accountNumberMasked: req.user.bankDetails?.accountNumberMasked || 'XXXX-XXXX-1234',
        ifscCode: req.user.bankDetails?.ifscCode || 'SBIN0001234',
        upiId: req.user.bankDetails?.upiId || ''
      },
      status: WITHDRAWAL_STATUS.PENDING
    });
    await withdrawal.save();

    // 7. Record immutable ledger reservation entry
    const idempotencyKey = `WDR_LOCK_${withdrawal._id}`;
    await WalletLedger.create({
      walletId: wallet._id,
      userId: req.user._id,
      companyCode: req.user.companyCode,
      entryType: 'DEBIT',
      amount: numAmount,
      balanceAfter: wallet.availableBalance,
      transactionType: TRANSACTION_TYPES.WITHDRAWAL_LOCK,
      referenceType: 'WITHDRAWAL',
      referenceId: withdrawal._id.toString(),
      description: `Funds reserved for withdrawal request #${withdrawal._id}`,
      idempotencyKey
    });

    res.status(201).json({
      success: true,
      message: `Withdrawal request of ₹${numAmount} submitted successfully and awaiting review.`,
      withdrawal,
      wallet: {
        availableBalance: wallet.availableBalance,
        reservedBalance: wallet.reservedBalance
      }
    });
  } catch (err) {
    next(err);
  }
});

// Agent views their withdrawal requests
router.get('/mine', authenticateToken, authorizeRoles(ROLES.AGENT), async (req, res, next) => {
  try {
    const withdrawals = await WithdrawalRequest.find({ agentId: req.user._id })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: withdrawals.length,
      withdrawals
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
