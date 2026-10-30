const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { authenticateToken } = require('../../middleware/auth.middleware');
const { authorizeRoles } = require('../../middleware/rbac.middleware');
const { requireCompanyScope } = require('../../middleware/companyScope.middleware');
const Company = require('./company.model');
const Bus = require('../fleet/bus.model');
const User = require('../users/user.model');
const KycDocument = require('../kyc/kyc.model');
const Booking = require('../bookings/booking.model');
const WithdrawalRequest = require('../withdrawals/withdrawal.model');
const { Wallet, WalletLedger } = require('../wallets/wallet.model');
const { ROLES, WITHDRAWAL_STATUS, TRANSACTION_TYPES } = require('../../config/constants');
const Trip = require('../trips/trip.model');
const websocketService = require('../../services/websocket.service');

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
      companyWallet = await Wallet.findOne({ companyCode: code });
    }
    if (companyWallet && !companyWallet.userId) {
      companyWallet.userId = req.user._id;
      await companyWallet.save();
    }
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

    // Attach wallet balance & KYC documents to each agent
    const agentIds = agents.map(a => a._id);
    const wallets = await Wallet.find({ userId: { $in: agentIds } });
    const kycDocs = await KycDocument.find({ userId: { $in: agentIds } });

    const agentsWithWallets = agents.map(agent => {
      const w = wallets.find(wal => wal.userId.toString() === agent._id.toString());
      const docs = kycDocs.filter(d => d.userId.toString() === agent._id.toString());
      return {
        ...agent.toObject(),
        availableBalance: w ? w.availableBalance : 0,
        reservedBalance: w ? w.reservedBalance : 0,
        kycDocuments: docs
      };
    });

    res.json({ success: true, count: agentsWithWallets.length, agents: agentsWithWallets });
  } catch (err) {
    next(err);
  }
});

// Company Owner - Get Single Agent Details (Scoped to Owner's companyCode)
router.get('/agents/:id', async (req, res, next) => {
  try {
    const agent = await User.findOne({ 
      _id: req.params.id, 
      role: ROLES.AGENT,
      companyCode: req.user.companyCode 
    }).select('-passwordHash').populate('referredBy', 'name email phone referralCode');

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found in your company registry' });
    }

    const wallet = await Wallet.findOne({ userId: agent._id }) || { balance: 0, availableBalance: 0 };
    const ledger = await WalletLedger.find({ userId: agent._id }).sort({ createdAt: -1 }).limit(25);
    const kycDocuments = await KycDocument.find({ userId: agent._id }).sort({ createdAt: -1 });
    const bookings = await Booking.find({ referralAgentId: agent._id, companyCode: req.user.companyCode }).sort({ createdAt: -1 }).limit(25);

    const totalBookings = await Booking.countDocuments({ referralAgentId: agent._id, companyCode: req.user.companyCode, status: 'CONFIRMED' });

    res.json({
      success: true,
      agent,
      wallet,
      ledger,
      kycDocuments,
      bookings,
      stats: {
        totalBookings,
        commissionTier: agent.commissionTier || 'TIER_1'
      }
    });
  } catch (err) {
    next(err);
  }
});

// Create New Agent under this company with initial wallet amount
router.post('/agents', async (req, res, next) => {
  try {
    const code = req.user.companyCode;
    const { 
      name, 
      email, 
      phone, 
      password, 
      agencyName, 
      address, 
      city, 
      state, 
      initialWalletAmount, 
      nationality = 'INDIA',
      aadharNumber, 
      aadharFileUrl,
      panNumber, 
      panFileUrl,
      nepalIdNumber,
      nepalIdFileUrl,
      nepalIdFileUrlBack,
      bankDetails 
    } = req.body;

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
      nationality: nationality || 'INDIA',
      aadharNumber: aadharNumber ? aadharNumber.trim() : '',
      panNumber: panNumber ? panNumber.toUpperCase().trim() : '',
      nepalIdNumber: nepalIdNumber ? nepalIdNumber.trim() : '',
      bankDetails: bankDetails ? {
        accountName: bankDetails.accountName || name.trim(),
        accountNumberMasked: bankDetails.accountNumber ? `XXXX-XXXX-${bankDetails.accountNumber.slice(-4)}` : (bankDetails.accountNumberMasked || ''),
        ifscCode: bankDetails.ifscCode ? bankDetails.ifscCode.toUpperCase().trim() : '',
        upiId: bankDetails.upiId ? bankDetails.upiId.trim() : '',
        bankName: bankDetails.bankName || 'Partner Bank'
      } : {
        accountName: name.trim(),
        accountNumberMasked: 'XXXX-XXXX-1234',
        ifscCode: 'SBIN0002145',
        upiId: `${phone.trim()}@okaxis`,
        bankName: 'State Bank of India'
      },
      agentLevel: 'SILVER',
      kycStatus: 'VERIFIED',
      isActive: true
    });

    // Create KYC documents according to nationality
    if (nationality === 'NEPAL' || nepalIdNumber) {
      try {
        await KycDocument.create({
          userId: agent._id,
          companyCode: code,
          documentType: 'NEPAL_CITIZENSHIP',
          documentNumberMasked: nepalIdNumber ? `NPL-XXXX-${nepalIdNumber.slice(-4)}` : 'NPL-CITIZEN',
          fileUrl: nepalIdFileUrl || 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=600&q=80',
          fileUrlBack: nepalIdFileUrlBack || '',
          status: 'VERIFIED',
          reviewedBy: req.user?.id || req.user?._id,
          reviewedAt: new Date()
        });
      } catch (kErr) {}
    } else {
      if (aadharNumber) {
        try {
          await KycDocument.create({
            userId: agent._id,
            companyCode: code,
            documentType: 'AADHAAR',
            documentNumberMasked: `XXXX-XXXX-${aadharNumber.slice(-4)}`,
            fileUrl: aadharFileUrl || 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=600&q=80',
            status: 'VERIFIED',
            reviewedBy: req.user?.id || req.user?._id,
            reviewedAt: new Date()
          });
        } catch (kErr) {}
      }
      if (panNumber) {
        try {
          await KycDocument.create({
            userId: agent._id,
            companyCode: code,
            documentType: 'PAN',
            documentNumberMasked: `XXXXX${panNumber.slice(-4)}`,
            fileUrl: panFileUrl || 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=600&q=80',
            status: 'VERIFIED',
            reviewedBy: req.user?.id || req.user?._id,
            reviewedAt: new Date()
          });
        } catch (kErr) {}
      }
    }

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
      companyWallet = await Wallet.findOne({ companyCode: code });
    }
    if (companyWallet && !companyWallet.userId) {
      companyWallet.userId = req.user._id;
      await companyWallet.save();
    }
    if (!companyWallet) {
      companyWallet = await Wallet.create({
        userId: req.user._id,
        companyCode: code,
        availableBalance: 0,
        reservedBalance: 0
      });
    }

    companyWallet.availableBalance += numAmount;
    companyWallet.ownerType = 'COMPANY';
    await companyWallet.save();

    await WalletLedger.create({
      walletId: companyWallet._id,
      userId: req.user._id,
      companyCode: code,
      entryType: 'CREDIT',
      amount: numAmount,
      balanceAfter: companyWallet.availableBalance,
      transactionType: TRANSACTION_TYPES.WALLET_DEPOSIT,
      referenceType: 'DEPOSIT',
      referenceId: 'COMP_DEP_' + Date.now(),
      description: 'Company Wallet deposit (' + (paymentMethod || 'Online Gateway') + ') by Company Owner',
      idempotencyKey: 'COMP_DEP_' + code + '_' + Date.now()
    });

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

// Company Corridor Trips / Schedules
router.get('/trips', async (req, res, next) => {
  try {
    const code = req.user.companyCode;
    const query = { companyCode: code };

    const trips = await Trip.find(query)
      .populate('routeId')
      .populate('busId')
      .sort({ departureTime: 1 })
      .limit(100);

    const formattedTrips = trips.map(t => {
      const seats = t.seats || [];
      const totalSeats = seats.length || (t.busId?.totalSeats || 36);
      const bookedSeats = seats.filter(s => s.status === 'BOOKED').length;
      const availableSeats = totalSeats - bookedSeats;
      const occupancyRate = totalSeats > 0 ? Math.round((bookedSeats / totalSeats) * 100) : 0;

      const fromCity = t.routeId?.fromCity?.name || 'Rupadiya (Hub)';
      const toCity = t.routeId?.toCity?.name || 'Ahmedabad';
      const busNumber = t.busId?.busNumber || 'UP-40-BT-1001';
      const busName = t.busId?.name || 'BharatBenz Luxury AC';
      const busType = t.busId?.busType || 'AC Sleeper (2+1)';

      return {
        _id: t._id,
        id: t._id,
        tripNumber: `TRP-${String(t._id).slice(-4).toUpperCase()}`,
        rawTripId: t._id,
        companyCode: t.companyCode,
        fromCity,
        toCity,
        corridor: `${fromCity} → ${toCity}`,
        busNumber,
        busName,
        busType,
        bus: `${busNumber} (${busName})`,
        driverName: t.busId?.driverDetails?.name || 'Assigned Driver',
        driverPhone: t.busId?.driverDetails?.phone || '+91 9876543210',
        departureTime: t.departureTime,
        arrivalTime: t.arrivalTime,
        baseFare: t.baseFare || 1650,
        status: t.chartPrepared ? 'BOARDING' : (t.status || 'SCHEDULED'),
        chartPrepared: Boolean(t.chartPrepared),
        chartPreparedAt: t.chartPreparedAt,
        totalSeats,
        bookedSeats,
        availableSeats,
        occupancyRate
      };
    });

    res.json({
      success: true,
      count: formattedTrips.length,
      trips: formattedTrips
    });
  } catch (err) {
    next(err);
  }
});

// Prepare Seat Chart for a Trip
router.post('/trips/:id/prepare-chart', async (req, res, next) => {
  try {
    const code = req.user.companyCode;
    const trip = await Trip.findOne({ _id: req.params.id, companyCode: code })
      .populate('routeId')
      .populate('busId');

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found under your company' });
    }

    trip.chartPrepared = true;
    trip.chartPreparedAt = new Date();
    trip.chartPreparedBy = req.user._id;
    if (trip.status === 'SCHEDULED') {
      trip.status = 'BOARDING';
    }
    await trip.save();

    res.json({
      success: true,
      message: `Seat sheet chart successfully prepared for ${trip.busId?.busNumber || 'trip'}. High cancellation penalty (85%) is now active.`,
      trip: {
        _id: trip._id,
        chartPrepared: true,
        chartPreparedAt: trip.chartPreparedAt,
        status: trip.status
      }
    });
  } catch (err) {
    next(err);
  }
});

// Get Seat Chart & Passenger Manifest for Printing
router.get('/trips/:id/seat-chart', async (req, res, next) => {
  try {
    const code = req.user.companyCode;
    const trip = await Trip.findOne({ _id: req.params.id, companyCode: code })
      .populate('routeId')
      .populate('busId');

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found under your company' });
    }

    const bookings = await Booking.find({
      tripId: trip._id,
      status: 'CONFIRMED'
    }).populate('passengerId', 'name phone email');

    // Build passenger lookup by seat number
    const seatPassengerMap = {};
    bookings.forEach(b => {
      if (Array.isArray(b.passengers)) {
        b.passengers.forEach(p => {
          if (p.seatNumber) {
            seatPassengerMap[p.seatNumber] = {
              passengerName: p.name || b.passengerId?.name || 'Passenger',
              age: p.age || 28,
              gender: p.gender || 'male',
              contactPhone: b.passengerPhone || b.passengerId?.phone || '+91 9876543210',
              pnr: b.bookingId || `RUP-${String(b._id).slice(-6).toUpperCase()}`,
              bookingId: b.bookingId || String(b._id),
              boardingPoint: b.boardingPoint?.name || b.boardingPoint || 'Rupadiya Main Stand',
              droppingPoint: b.droppingPoint?.name || b.droppingPoint || 'Central Drop Point',
              fare: p.fare || b.fareBreakdown?.baseFare || trip.baseFare || 1650,
              insuranceEnrolled: Boolean(b.insuranceEnrolled),
              status: 'CONFIRMED'
            };
          }
        });
      }
    });

    // Populate manifest rows for all seats in trip
    const manifest = (trip.seats || []).map(seat => {
      const bookedData = seatPassengerMap[seat.seatNumber] || (seat.status === 'BOOKED' && seat.passenger ? {
        passengerName: seat.passenger.name || 'Confirmed Passenger',
        age: seat.passenger.age || 30,
        gender: seat.passenger.gender || 'male',
        contactPhone: '+91 9876500000',
        pnr: `RUP-${seat.seatNumber}`,
        bookingId: `BK-${seat.seatNumber}`,
        boardingPoint: 'Main Stand',
        droppingPoint: 'Destination Station',
        fare: seat.fare || trip.baseFare || 1650,
        insuranceEnrolled: true,
        status: 'CONFIRMED'
      } : null);

      return {
        seatNumber: seat.seatNumber,
        row: seat.row,
        column: seat.column,
        deck: seat.deck,
        category: seat.category,
        fare: seat.fare || trip.baseFare || 1650,
        status: bookedData ? 'CONFIRMED' : 'VACANT',
        passengerName: bookedData ? bookedData.passengerName : '— VACANT —',
        age: bookedData ? bookedData.age : '—',
        gender: bookedData ? bookedData.gender : '—',
        contactPhone: bookedData ? bookedData.contactPhone : '—',
        pnr: bookedData ? bookedData.pnr : '—',
        bookingId: bookedData ? bookedData.bookingId : '—',
        boardingPoint: bookedData ? bookedData.boardingPoint : '—',
        droppingPoint: bookedData ? bookedData.droppingPoint : '—',
        insuranceEnrolled: bookedData ? bookedData.insuranceEnrolled : false
      };
    });

    const totalSeats = manifest.length;
    const bookedSeats = manifest.filter(m => m.status === 'CONFIRMED').length;
    const vacantSeats = totalSeats - bookedSeats;
    const occupancyRate = totalSeats > 0 ? Math.round((bookedSeats / totalSeats) * 100) : 0;
    const totalCollected = manifest.filter(m => m.status === 'CONFIRMED').reduce((acc, curr) => acc + (curr.fare || 0), 0);

    res.json({
      success: true,
      trip: {
        _id: trip._id,
        tripNumber: `TRP-${String(trip._id).slice(-4).toUpperCase()}`,
        departureTime: trip.departureTime,
        arrivalTime: trip.arrivalTime,
        status: trip.status,
        chartPrepared: Boolean(trip.chartPrepared),
        chartPreparedAt: trip.chartPreparedAt,
        route: {
          fromCity: trip.routeId?.fromCity || { name: 'Rupadiya (Hub)' },
          toCity: trip.routeId?.toCity || { name: 'Ahmedabad' },
          distanceKm: trip.routeId?.distanceKm || 1150
        },
        bus: {
          busNumber: trip.busId?.busNumber || 'UP-40-BT-1001',
          name: trip.busId?.name || 'BharatBenz Sleeper',
          busType: trip.busId?.busType || 'AC Sleeper (2+1)',
          operatorName: trip.busId?.operatorName || 'Rupadiya Intercity Travels',
          driverName: trip.busId?.driverDetails?.name || 'Vikram Singh',
          driverPhone: trip.busId?.driverDetails?.phone || '+91 9876543210',
          driverLicense: trip.busId?.driverDetails?.licenseNumber || 'DL-UP40-201800123'
        },
        companyCode: trip.companyCode
      },
      summary: {
        totalSeats,
        bookedSeats,
        vacantSeats,
        occupancyRate,
        totalCollected
      },
      manifest
    });
  } catch (err) {
    next(err);
  }
});

// Company Levels & Agent Hierarchy
router.get('/levels', async (req, res, next) => {
  try {
    const code = req.user.companyCode;

    // Company metrics for level calculation
    const busCount = await Bus.countDocuments({ companyCode: code, status: 'ACTIVE' });
    const agents = await User.find({ companyCode: code, role: ROLES.AGENT })
      .select('name agencyName email phone referralCode agentLevel customCashbackPercent city state createdAt')
      .sort({ createdAt: -1 });

    const agentIds = agents.map(a => a._id);
    const bookingsByAgent = await Booking.aggregate([
      { $match: { referralAgentId: { $in: agentIds }, status: 'CONFIRMED' } },
      { $group: { _id: '$referralAgentId', count: { $sum: 1 }, totalVolume: { $sum: '$fareBreakdown.totalPayable' } } }
    ]);

    const statsMap = {};
    bookingsByAgent.forEach(b => {
      statsMap[String(b._id)] = {
        bookingsCount: b.count,
        totalVolume: b.totalVolume
      };
    });

    const enrichedAgents = agents.map(ag => {
      const st = statsMap[String(ag._id)] || { bookingsCount: 0, totalVolume: 0 };
      return {
        _id: ag._id,
        name: ag.name,
        agencyName: ag.agencyName || ag.name,
        email: ag.email,
        phone: ag.phone,
        city: ag.city || 'Rupadiya',
        state: ag.state || 'Uttar Pradesh',
        referralCode: ag.referralCode || `AGT-${String(code).padStart(2, '0')}-${String(ag._id).slice(-4).toUpperCase()}`,
        agentLevel: ag.agentLevel || 'SILVER',
        customCashbackPercent: ag.customCashbackPercent || 5.0,
        monthlyBookings: st.bookingsCount,
        totalVolume: st.totalVolume,
        createdAt: ag.createdAt
      };
    });

    // Company tier details
    let companyTier = 'SILVER_PARTNER';
    let companyBadge = 'Silver Fleet Operator';
    if (busCount >= 10) {
      companyTier = 'DIAMOND_PARTNER';
      companyBadge = 'Diamond Enterprise Carrier';
    } else if (busCount >= 5) {
      companyTier = 'PLATINUM_PARTNER';
      companyBadge = 'Platinum Corridor Operator';
    } else if (busCount >= 2) {
      companyTier = 'GOLD_PARTNER';
      companyBadge = 'Gold Fleet Partner';
    }

    const tierDefinitions = [
      {
        id: 'BRONZE',
        name: 'Bronze Starter Counter',
        minBookings: 0,
        commissionPercent: 3.0,
        creditLimit: 15000,
        color: 'amber',
        badge: 'Entry Counter',
        perks: ['Standard Corridor Access', 'Manual Topup Support', 'Standard Reports']
      },
      {
        id: 'SILVER',
        name: 'Silver Active Franchise',
        minBookings: 50,
        commissionPercent: 5.0,
        creditLimit: 50000,
        color: 'slate',
        badge: 'Franchise Partner',
        perks: ['Priority Seat Locking', '1.0% Downline Referral Override', 'Instant Balance Topup']
      },
      {
        id: 'GOLD',
        name: 'Gold Premier Partner',
        minBookings: 200,
        commissionPercent: 7.0,
        creditLimit: 125000,
        color: 'yellow',
        badge: 'Premier Agent',
        perks: ['Preferential Berth Allocation', '2.0% Downline Override', 'Zero Cancellation Processing Fees']
      },
      {
        id: 'PLATINUM',
        name: 'Platinum Elite Master',
        minBookings: 500,
        commissionPercent: 10.0,
        creditLimit: 250000,
        color: 'purple',
        badge: 'Elite Master',
        perks: ['VIP Support Desk', '3.0% Downline Override', 'Flexible Credit Settlement Terms', 'Dedicated Account Executive']
      }
    ];

    res.json({
      success: true,
      companyLevel: {
        tier: companyTier,
        badge: companyBadge,
        companyCode: code,
        activeFleetCount: busCount,
        totalAgentsCount: enrichedAgents.length,
        onTimeDepartureRating: '98.4%',
        safetyScore: '4.9/5',
        carrierDiscountRate: '1.2% Platform Waiver',
        perks: [
          'Direct Corridor Slot Dispatch Privileges',
          'Instant Settlement Payout Approvals',
          'Free Multi-Axle Fleet Tracking Integration',
          'Zero Surcharge on Razorpay Gateway Collections'
        ]
      },
      tierDefinitions,
      agents: enrichedAgents
    });
  } catch (err) {
    next(err);
  }
});

// Update Agent Level / Commission Override
router.put('/agents/:id/level', async (req, res, next) => {
  try {
    const code = req.user.companyCode;
    const { agentLevel, customCashbackPercent } = req.body;

    const agent = await User.findOne({ _id: req.params.id, companyCode: code, role: ROLES.AGENT });
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found under your company' });
    }

    if (agentLevel) {
      const validLevels = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
      if (!validLevels.includes(agentLevel)) {
        return res.status(400).json({ error: 'Invalid agent level specified' });
      }
      agent.agentLevel = agentLevel;
    }

    if (customCashbackPercent != null) {
      const pct = Number(customCashbackPercent);
      if (isNaN(pct) || pct < 0 || pct > 25) {
        return res.status(400).json({ error: 'Commission percent must be between 0% and 25%' });
      }
      agent.customCashbackPercent = pct;
    }

    await agent.save();

    res.json({
      success: true,
      message: `Agent ${agent.name} updated to ${agent.agentLevel} level with ${agent.customCashbackPercent}% commission.`,
      agent: {
        _id: agent._id,
        name: agent.name,
        agentLevel: agent.agentLevel,
        customCashbackPercent: agent.customCashbackPercent
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
