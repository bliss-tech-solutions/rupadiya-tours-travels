const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
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

// Create New Agent under this company with initial wallet amount
router.post('/agents', async (req, res, next) => {
  try {
    const code = req.user.companyCode;
    const { name, email, phone, password, agencyName, address, city, state, initialWalletAmount } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: 'Name, email, phone, and password are required' });
    }

    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase().trim() }, { phone: phone.trim() }]
    });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email or phone already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const referralCode = `AGT-${String(code).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const agent = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      passwordHash,
      role: ROLES.AGENT,
      companyCode: code,
      referralCode,
      agencyName: agencyName ? agencyName.trim() : `${name.trim()} Agency`,
      address: address ? address.trim() : '',
      city: city ? city.trim() : '',
      state: state ? state.trim() : '',
      agentLevel: 'SILVER',
      kycStatus: 'VERIFIED',
      isActive: true
    });

    const initAmount = Math.max(0, Number(initialWalletAmount) || 0);

    // Create Agent Wallet with initial allocation
    const wallet = await Wallet.create({
      userId: agent._id,
      companyCode: code,
      availableBalance: initAmount,
      reservedBalance: 0
    });

    if (initAmount > 0) {
      await WalletLedger.create({
        walletId: wallet._id,
        userId: agent._id,
        companyCode: code,
        entryType: 'CREDIT',
        amount: initAmount,
        balanceAfter: initAmount,
        transactionType: TRANSACTION_TYPES.WALLET_DEPOSIT,
        referenceType: 'DEPOSIT',
        referenceId: `INIT_${Date.now()}`,
        description: `Initial wallet grant by Company Owner Code #${code}`,
        idempotencyKey: `INIT_${agent._id}_${Date.now()}`
      });
    }

    res.status(201).json({
      success: true,
      message: `Agent ${agent.name} created successfully with ₹${initAmount.toLocaleString('en-IN')} wallet balance.`,
      agent: {
        ...agent.toObject(),
        availableBalance: wallet.availableBalance,
        reservedBalance: wallet.reservedBalance
      }
    });
  } catch (err) {
    next(err);
  }
});

// Delete or Deactivate Agent under this company
router.delete('/agents/:id', async (req, res, next) => {
  try {
    const code = req.user.companyCode;
    const agent = await User.findOne({ _id: req.params.id, companyCode: code, role: ROLES.AGENT });
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found under your company code' });
    }

    const bookingsCount = await Booking.countDocuments({ referralAgentId: agent._id });

    if (bookingsCount > 0) {
      // Soft-deactivate to preserve historical booking audit trails
      agent.isActive = false;
      await agent.save();
      return res.json({
        success: true,
        message: `Agent has ${bookingsCount} bookings on record. Account was safely deactivated to preserve financial auditability.`,
        deactivated: true
      });
    }

    // If no bookings, safely remove wallet and user
    await Wallet.deleteOne({ userId: agent._id });
    await User.deleteOne({ _id: agent._id });

    res.json({
      success: true,
      message: `Agent ${agent.name} deleted successfully.`,
      deleted: true
    });
  } catch (err) {
    next(err);
  }
});

// Add Funds to Agent Wallet (Top-Up)
router.post('/agents/:id/wallet', async (req, res, next) => {
  try {
    const code = req.user.companyCode;
    const { amount, note } = req.body;
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ error: 'Please enter a valid amount' });
    }

    const agent = await User.findOne({ _id: req.params.id, companyCode: code, role: ROLES.AGENT });
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found under your company code' });
    }

    let wallet = await Wallet.findOne({ userId: agent._id });
    if (!wallet) {
      wallet = await Wallet.create({
        userId: agent._id,
        companyCode: code,
        availableBalance: 0,
        reservedBalance: 0
      });
    }

    wallet.availableBalance += numAmount;
    await wallet.save();

    await WalletLedger.create({
      walletId: wallet._id,
      userId: agent._id,
      companyCode: code,
      entryType: 'CREDIT',
      amount: numAmount,
      balanceAfter: wallet.availableBalance,
      transactionType: TRANSACTION_TYPES.WALLET_DEPOSIT,
      referenceType: 'DEPOSIT',
      referenceId: `COMP_GRANT_${Date.now()}`,
      description: note || `Wallet top-up by Company Owner Code #${code}`,
      idempotencyKey: `COMP_TOPUP_${agent._id}_${Date.now()}`
    });

    res.json({
      success: true,
      message: `Successfully added ₹${numAmount.toLocaleString('en-IN')} to ${agent.name}'s wallet.`,
      newBalance: wallet.availableBalance
    });
  } catch (err) {
    next(err);
  }
});

// Toggle Agent Status (Active / Suspended)
router.patch('/agents/:id/status', async (req, res, next) => {
  try {
    const code = req.user.companyCode;
    const { isActive } = req.body;
    const agent = await User.findOne({ _id: req.params.id, companyCode: code, role: ROLES.AGENT });
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found under your company code' });
    }

    agent.isActive = Boolean(isActive);
    await agent.save();

    res.json({
      success: true,
      message: `Agent ${agent.name} is now ${agent.isActive ? 'Active' : 'Suspended'}.`,
      agent
    });
  } catch (err) {
    next(err);
  }
});

// Company Wallet Top-Up
router.post('/wallet/deposit', async (req, res, next) => {
  try {
    const code = req.user.companyCode;
    const { amount, paymentMethod } = req.body;
    const numAmount = Number(amount);
    if (!numAmount || numAmount < 100) {
      return res.status(400).json({ error: 'Minimum deposit is ₹100' });
    }

    let companyWallet = await Wallet.findOne({ companyCode: code, userId: req.user._id });
    if (!companyWallet) {
      companyWallet = await Wallet.create({
        userId: req.user._id,
        companyCode: code,
        availableBalance: 0,
        reservedBalance: 0
      });
    }

    companyWallet.availableBalance += numAmount;
    await companyWallet.save();

    res.json({
      success: true,
      message: `₹${numAmount.toLocaleString('en-IN')} credited to Company Wallet.`,
      wallet: companyWallet
    });
  } catch (err) {
    next(err);
  }
});

// Update Company Payment Methods
router.patch('/payment-methods', async (req, res, next) => {
  try {
    const code = req.user.companyCode;
    const { paymentMethods } = req.body;

    const company = await Company.findOne({ companyCode: code });
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    if (Array.isArray(paymentMethods)) {
      company.paymentMethods = paymentMethods;
      await company.save();
    }

    res.json({ success: true, message: 'Payment methods updated', paymentMethods: company.paymentMethods });
  } catch (err) {
    next(err);
  }
});

// Company Network & Level Hierarchy
router.get('/network', async (req, res, next) => {
  try {
    const code = req.user.companyCode;
    const agents = await User.find({ companyCode: code, role: ROLES.AGENT })
      .select('-passwordHash')
      .populate('referredBy', 'name email referralCode');

    const totalAgents = agents.length;
    const verifiedKyc = agents.filter(a => a.kycStatus === 'VERIFIED').length;

    res.json({
      success: true,
      companyCode: code,
      totalAgents,
      verifiedKyc,
      agents
    });
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
    const { 
      busNumber, 
      name, 
      operatorName, 
      busType, 
      amenities, 
      driverDetails, 
      managerContact,
      images,
      status
    } = req.body;

    if (!busNumber || !name) {
      return res.status(400).json({ error: 'busNumber and name are required' });
    }

    const cleanNumber = busNumber.trim().toUpperCase();
    const existing = await Bus.findOne({ busNumber: cleanNumber });
    if (existing) {
      return res.status(400).json({ error: `A bus with registration number ${cleanNumber} already exists in the system.` });
    }

    const bus = new Bus({
      busNumber: cleanNumber,
      name: name.trim(),
      operatorName: operatorName?.trim() || req.user.agencyName || `Rupadiya Carrier #${String(code).padStart(2, '0')}`,
      companyCode: code,
      busType: busType || 'AC Sleeper (2+1)',
      amenities: amenities || ['Charging Point', 'Reading Light', 'Blanket', 'WiFi', 'GPS Tracking'],
      driverDetails: driverDetails || {
        name: 'Dinesh Kumar',
        phone: '+91 9876543210',
        licenseNumber: 'DL-UP40-201800123'
      },
      managerContact: managerContact || { name: req.user.name, phone: req.user.phone },
      images: images && images.length ? images : undefined,
      status: status || 'ACTIVE'
    });
    await bus.save();

    res.status(201).json({ success: true, bus });
  } catch (err) {
    next(err);
  }
});

// Update Bus
router.put('/fleet/:id', async (req, res, next) => {
  try {
    const code = req.user.companyCode;
    const bus = await Bus.findOne({ _id: req.params.id, companyCode: code });
    if (!bus) return res.status(404).json({ error: 'Bus not found under your company' });

    const { name, operatorName, busType, amenities, driverDetails, managerContact, status } = req.body;
    if (name) bus.name = name.trim();
    if (operatorName) bus.operatorName = operatorName.trim();
    if (busType) bus.busType = busType;
    if (amenities) bus.amenities = amenities;
    if (driverDetails) bus.driverDetails = { ...bus.driverDetails, ...driverDetails };
    if (managerContact) bus.managerContact = { ...bus.managerContact, ...managerContact };
    if (status) bus.status = status;

    await bus.save();
    res.json({ success: true, bus });
  } catch (err) {
    next(err);
  }
});

// Delete Bus
router.delete('/fleet/:id', async (req, res, next) => {
  try {
    const code = req.user.companyCode;
    const bus = await Bus.findOneAndDelete({ _id: req.params.id, companyCode: code });
    if (!bus) return res.status(404).json({ error: 'Bus not found under your company' });
    res.json({ success: true, message: `Bus ${bus.busNumber} deleted successfully.` });
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
