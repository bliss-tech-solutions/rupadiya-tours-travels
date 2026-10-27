const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middleware/auth.middleware');
const { authorizeRoles } = require('../../middleware/rbac.middleware');
const { requireCompanyScope } = require('../../middleware/companyScope.middleware');
const Company = require('./company.model');
const Bus = require('../fleet/bus.model');
const User = require('../users/user.model');
const Booking = require('../bookings/booking.model');
const WithdrawalRequest = require('../withdrawals/withdrawal.model');
const { Wallet, WalletLedger } = require('../wallets/wallet.model');
const { ROLES, WITHDRAWAL_STATUS, TRANSACTION_TYPES } = require('../../config/constants');

// Guard all owner routes: User must be COMPANY_OWNER and scoped to their own companyCode
router.use(authenticateToken);
router.use(authorizeRoles(ROLES.COMPANY_OWNER, ROLES.SUPER_ADMIN));
router.use(requireCompanyScope);

// Owner Dashboard Overview
router.get('/dashboard', async (req, res, next) => {
  try {
    const code = req.user.companyCode;

    const company = await Company.findOne({ companyCode: code });
    const busCount = await Bus.countDocuments({ companyCode: code, status: 'ACTIVE' });
    const agentCount = await User.countDocuments({ companyCode: code, role: ROLES.AGENT });
    const pendingWithdrawalsCount = await WithdrawalRequest.countDocuments({
      companyCode: code,
      status: WITHDRAWAL_STATUS.PENDING
    });

    const bookings = await Booking.find({ companyCode: code, status: 'CONFIRMED' });
    const totalPassengers = bookings.reduce((sum, b) => sum + b.seatNumbers.length, 0);
    const totalRevenue = bookings.reduce((sum, b) => sum + b.fareBreakdown.totalPayable, 0);

    // Company wallet
    let companyWallet = await Wallet.findOne({ companyCode: code, userId: req.user._id });
    if (!companyWallet) {
      companyWallet = await Wallet.create({
        userId: req.user._id,
        companyCode: code,
        availableBalance: 0,
        reservedBalance: 0
      });
    }

    res.json({
      success: true,
      company,
      companyCode: code,
      stats: {
        busCount,
        agentCount,
        pendingWithdrawalsCount,
        totalPassengers,
        totalRevenue,
        targetPassengers: company?.annualTarget?.targetPassengers || 10000,
        targetProgressPercent: Math.min(
          100,
          Math.round((totalPassengers / (company?.annualTarget?.targetPassengers || 10000)) * 100)
        )
      },
      wallet: companyWallet
    });
  } catch (err) {
    next(err);
  }
});

// Company Agents List
router.get('/agents', async (req, res, next) => {
  try {
    const code = req.user.companyCode;
    const agents = await User.find({ companyCode: code, role: ROLES.AGENT })
      .select('-passwordHash')
      .sort({ createdAt: -1 });

    // Attach wallet balance to each agent
    const agentIds = agents.map(a => a._id);
    const wallets = await Wallet.find({ userId: { $in: agentIds } });

    const agentsWithWallets = agents.map(agent => {
      const w = wallets.find(wal => wal.userId.toString() === agent._id.toString());
      return {
        ...agent.toObject(),
        availableBalance: w ? w.availableBalance : 0,
        reservedBalance: w ? w.reservedBalance : 0
      };
    });

    res.json({ success: true, count: agentsWithWallets.length, agents: agentsWithWallets });
  } catch (err) {
    next(err);
  }
});

// Company Fleet List
router.get('/fleet', async (req, res, next) => {
  try {
    const code = req.user.companyCode;
    const buses = await Bus.find({ companyCode: code }).sort({ busNumber: 1 });
    res.json({ success: true, count: buses.length, buses });
  } catch (err) {
    next(err);
  }
});

// Add New Bus
router.post('/fleet', async (req, res, next) => {
  try {
    const code = req.user.companyCode;
    const { busNumber, name, busType, amenities, managerContact } = req.body;

    if (!busNumber || !name) {
      return res.status(400).json({ error: 'busNumber and name are required' });
    }

    const bus = new Bus({
      busNumber: busNumber.toUpperCase(),
      name,
      companyCode: code,
      busType: busType || 'AC Seater 2+2',
      amenities: amenities || ['Charging Point', 'Reading Light', 'Blanket'],
      managerContact: managerContact || { name: req.user.name, phone: req.user.phone }
    });
    await bus.save();

    res.status(201).json({ success: true, bus });
  } catch (err) {
    next(err);
  }
});

// Agent Withdrawal Requests under this company
router.get('/withdrawals', async (req, res, next) => {
  try {
    const code = req.user.companyCode;
    const withdrawals = await WithdrawalRequest.find({ companyCode: code })
      .populate('agentId', 'name email phone referralCode bankDetails')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: withdrawals.length, withdrawals });
  } catch (err) {
    next(err);
  }
});

// Approve Withdrawal Request
router.post('/withdrawals/:id/approve', async (req, res, next) => {
  try {
    const code = req.user.companyCode;
    const withdrawal = await WithdrawalRequest.findOne({ _id: req.params.id, companyCode: code });

    if (!withdrawal) {
      return res.status(404).json({ error: 'Withdrawal request not found under your company code' });
    }
    if (withdrawal.status !== WITHDRAWAL_STATUS.PENDING) {
      return res.status(400).json({ error: `Request cannot be approved; current status is ${withdrawal.status}` });
    }

    // Deduct from agent's reservedBalance
    const agentWallet = await Wallet.findOne({ userId: withdrawal.agentId });
    if (agentWallet) {
      agentWallet.reservedBalance = Math.max(0, agentWallet.reservedBalance - withdrawal.amount);
      await agentWallet.save();

      // Record immutable settlement ledger
      const idempotencyKey = `WDR_SETTLE_${withdrawal._id}`;
      await WalletLedger.create({
        walletId: agentWallet._id,
        userId: withdrawal.agentId,
        companyCode: code,
        entryType: 'DEBIT',
        amount: withdrawal.amount,
        balanceAfter: agentWallet.availableBalance,
        transactionType: TRANSACTION_TYPES.WITHDRAWAL_SETTLED,
        referenceType: 'WITHDRAWAL',
        referenceId: withdrawal._id.toString(),
        description: `Withdrawal payout of ₹${withdrawal.amount} approved and settled by Company Owner`,
        idempotencyKey
      });
    }

    withdrawal.status = WITHDRAWAL_STATUS.APPROVED;
    withdrawal.reviewedBy = req.user._id;
    withdrawal.reviewedAt = new Date();
    await withdrawal.save();

    res.json({
      success: true,
      message: `Withdrawal request for ₹${withdrawal.amount} approved successfully.`,
      withdrawal
    });
  } catch (err) {
    next(err);
  }
});

// Reject Withdrawal Request
router.post('/withdrawals/:id/reject', async (req, res, next) => {
  try {
    const code = req.user.companyCode;
    const { reason } = req.body;
    const withdrawal = await WithdrawalRequest.findOne({ _id: req.params.id, companyCode: code });

    if (!withdrawal) {
      return res.status(404).json({ error: 'Withdrawal request not found under your company code' });
    }
    if (withdrawal.status !== WITHDRAWAL_STATUS.PENDING) {
      return res.status(400).json({ error: `Request cannot be rejected; current status is ${withdrawal.status}` });
    }

    // Return funds from reservedBalance back to availableBalance
    const agentWallet = await Wallet.findOne({ userId: withdrawal.agentId });
    if (agentWallet) {
      agentWallet.reservedBalance = Math.max(0, agentWallet.reservedBalance - withdrawal.amount);
      agentWallet.availableBalance += withdrawal.amount;
      await agentWallet.save();

      const idempotencyKey = `WDR_REJ_REFUND_${withdrawal._id}`;
      await WalletLedger.create({
        walletId: agentWallet._id,
        userId: withdrawal.agentId,
        companyCode: code,
        entryType: 'CREDIT',
        amount: withdrawal.amount,
        balanceAfter: agentWallet.availableBalance,
        transactionType: TRANSACTION_TYPES.WITHDRAWAL_REJECTED_REFUND,
        referenceType: 'WITHDRAWAL',
        referenceId: withdrawal._id.toString(),
        description: `Refund of ₹${withdrawal.amount} reserved balance due to rejection: ${reason || 'Details mismatched'}`,
        idempotencyKey
      });
    }

    withdrawal.status = WITHDRAWAL_STATUS.REJECTED;
    withdrawal.rejectionReason = reason || 'Bank or KYC verification details mismatched';
    withdrawal.reviewedBy = req.user._id;
    withdrawal.reviewedAt = new Date();
    await withdrawal.save();

    res.json({
      success: true,
      message: `Withdrawal request rejected. Reserved funds refunded back to agent wallet.`,
      withdrawal
    });
  } catch (err) {
    next(err);
  }
});

// Company Reports & Financials
router.get('/reports', async (req, res, next) => {
  try {
    const code = req.user.companyCode;
    const bookings = await Booking.find({ companyCode: code, status: 'CONFIRMED' }).sort({ createdAt: -1 });

    const totalRevenue = bookings.reduce((sum, b) => sum + b.fareBreakdown.totalPayable, 0);
    const totalGst = bookings.reduce((sum, b) => sum + b.fareBreakdown.gstAmount, 0);
    const totalPassengers = bookings.reduce((sum, b) => sum + b.seatNumbers.length, 0);

    res.json({
      success: true,
      companyCode: code,
      totalBookings: bookings.length,
      totalPassengers,
      totalRevenue,
      totalGst,
      netCompanyGross: totalRevenue - totalGst,
      recentBookings: bookings.slice(0, 20)
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
