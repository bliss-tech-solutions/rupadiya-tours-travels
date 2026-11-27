const express = require('express');
const { istDayRange } = require('../../utils/istDate');
const companyReports = require('../../services/companyReports.service');
const settlementService = require('../settlements/settlement.service');
const CompanySettlement = require('../settlements/companySettlement.model');
const cashCollection = require('../../services/cashCollection.service');
const cashPolicy = require('../../services/cashPolicy.service');
const payoutService = require('../withdrawals/payout.service');
const holdStore = require('../../config/holdStore');
const { planFareChanges, MAX_FARE_MULTIPLIER } = require('../../services/seatPricing');
const { recordAudit } = require('../../services/audit.service');
const walletLedger = require('../../services/walletLedger.service');
const { withTransaction } = require('../../utils/transaction');
const crypto = require('crypto');
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
const { ROLES, WITHDRAWAL_STATUS, TRANSACTION_TYPES, normalizeCityId, isValidCorridor, SPOKE_CITIES } = require('../../config/constants');
const Trip = require('../trips/trip.model');
const Route = require('../routes/route.model');
const websocketService = require('../../services/websocket.service');
const { normalisePhone, formatPhone, PHONE_ERROR } = require('../../utils/phone');

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

    const [bookingStats] = await Booking.aggregate([
      { $match: { companyCode: code, status: 'CONFIRMED' } },
      {
        $group: {
          _id: null,
          totalPassengers: { $sum: { $size: { $ifNull: ['$seatNumbers', []] } } },
          totalRevenue: { $sum: { $ifNull: ['$fareBreakdown.totalPayable', 0] } }
        }
      }
    ]);
    const totalPassengers = bookingStats ? bookingStats.totalPassengers : 0;
    const totalRevenue = bookingStats ? bookingStats.totalRevenue : 0;

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
    const company = await Company.findOne({ companyCode: code });
    const companyId = req.user.companyId || company?._id || null;

    const { 
      name, 
      email, 
      phone: rawPhone,
      password, 
      agencyName, 
      address, 
      city, 
      state, 
      sponsorReferralCode,
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
    const phone = rawPhone ? normalisePhone(rawPhone) : '';
    if (rawPhone && !phone) return res.status(400).json({ error: PHONE_ERROR });

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: 'Name, email, phone, and password are required' });
    }

    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase().trim() }, { phone: phone.trim() }]
    });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email or phone already exists' });
    }

    // Resolve sponsor referral (5-tier referral tree)
    let sponsor = null;
    if (sponsorReferralCode) {
      sponsor = await User.findOne({ referralCode: sponsorReferralCode.toUpperCase().trim() });
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
      companyId,
      companyCode: code,
      referredBy: sponsor ? sponsor._id : null,
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
        bankName: bankDetails.bankName || ''
      } : {
        accountName: name.trim(),
        accountNumberMasked: '',
        ifscCode: '',
        upiId: '',
        bankName: ''
      },
      agentLevel: 'SILVER',
      kycStatus: (aadharFileUrl || panFileUrl || nepalIdFileUrl) ? 'VERIFIED' : 'PENDING',
      isActive: true
    });

    // Create KYC documents according to nationality (only if real file uploaded)
    if (nationality === 'NEPAL' || nepalIdNumber) {
      if (nepalIdFileUrl) {
        try {
          await KycDocument.create({
            userId: agent._id,
            companyId,
            companyCode: code,
            documentType: 'NEPAL_CITIZENSHIP',
            documentNumberMasked: nepalIdNumber ? `NPL-XXXX-${nepalIdNumber.slice(-4)}` : 'NPL-CITIZEN',
            fileUrl: nepalIdFileUrl,
            fileUrlBack: nepalIdFileUrlBack || '',
            status: 'VERIFIED',
            reviewedBy: req.user?.id || req.user?._id,
            reviewedAt: new Date()
          });
        } catch (kErr) {}
      }
    } else {
      if (aadharFileUrl) {
        try {
          await KycDocument.create({
            userId: agent._id,
            companyId,
            companyCode: code,
            documentType: 'AADHAAR',
            documentNumberMasked: aadharNumber ? `XXXX-XXXX-${aadharNumber.slice(-4)}` : 'AADHAAR-DOC',
            fileUrl: aadharFileUrl,
            status: 'VERIFIED',
            reviewedBy: req.user?.id || req.user?._id,
            reviewedAt: new Date()
          });
        } catch (kErr) {}
      }
      if (panFileUrl) {
        try {
          await KycDocument.create({
            userId: agent._id,
            companyId,
            companyCode: code,
            documentType: 'PAN',
            documentNumberMasked: panNumber ? `XXXXX${panNumber.slice(-4)}` : 'PAN-DOC',
            fileUrl: panFileUrl,
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
      companyId,
      companyCode: code,
      ownerType: 'AGENT',
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

// Transfer funds from the Company Wallet to an Agent Wallet (double-entry, atomic)
router.post('/agents/:id/wallet', async (req, res, next) => {
  try {
    const code = req.user.companyCode;
    const { amount, note } = req.body || {};
    const numAmount = Math.round(Number(amount) * 100) / 100;
    if (!numAmount || numAmount <= 0 || numAmount > 500000) {
      return res.status(400).json({ error: 'Please enter a valid amount (up to ₹5,00,000).' });
    }

    const agent = await User.findOne({ _id: req.params.id, companyCode: code, role: ROLES.AGENT });
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found under your company code' });
    }

    const transferId = `TRF_${Date.now()}_${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const cleanNote = String(note || '').trim().slice(0, 200);

    let result;
    try {
      result = await withTransaction(async (session) => {
        const debitRes = await walletLedger.debit({
          userId: req.user._id,
          amount: numAmount,
          companyCode: code,
          transactionType: TRANSACTION_TYPES.COMPANY_TO_AGENT_TRANSFER,
          referenceType: 'TRANSFER',
          referenceId: transferId,
          description: `Transfer to agent ${agent.name} (${agent.referralCode || agent._id})${cleanNote ? ` · ${cleanNote}` : ''}`,
          idempotencyKey: `${transferId}_DEBIT`,
          session
        });
        const creditRes = await walletLedger.credit({
          userId: agent._id,
          amount: numAmount,
          companyCode: code,
          transactionType: TRANSACTION_TYPES.COMPANY_TO_AGENT_TRANSFER,
          referenceType: 'TRANSFER',
          referenceId: transferId,
          description: `Funds received from company #${code}${cleanNote ? ` · ${cleanNote}` : ''}`,
          idempotencyKey: `${transferId}_CREDIT`,
          session
        });
        return { debitRes, creditRes };
      });
    } catch (err) {
      // Standalone MongoDB (no transactions): if the credit failed after the debit, return the money.
      const debited = await WalletLedger.findOne({ idempotencyKey: `${transferId}_DEBIT` });
      const credited = await WalletLedger.findOne({ idempotencyKey: `${transferId}_CREDIT` });
      if (debited && !credited) {
        await walletLedger.credit({
          userId: req.user._id,
          amount: numAmount,
          companyCode: code,
          transactionType: TRANSACTION_TYPES.COMPANY_TO_AGENT_TRANSFER,
          referenceType: 'TRANSFER',
          referenceId: transferId,
          description: `Reversal of failed transfer ${transferId}`,
          idempotencyKey: `${transferId}_REVERSAL`
        });
      }
      throw err;
    }

    res.json({
      success: true,
      message: `₹${numAmount.toLocaleString('en-IN')} transferred from the company wallet to ${agent.name}.`,
      transferId,
      newBalance: result.creditRes.wallet?.availableBalance,
      companyWalletBalance: result.debitRes.wallet?.availableBalance
    });
  } catch (err) {
    if (err.code === 'INSUFFICIENT_BALANCE') {
      return res.status(402).json({ error: `Company wallet balance is too low for this transfer. ${err.message}. Add funds to the company wallet first.` });
    }
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
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

// Company Wallet Top-Up: money only enters a wallet through a verified gateway payment.
router.post('/wallet/deposit', async (req, res) => {
  res.status(410).json({
    error: 'Direct wallet credits are disabled. Use "Add Funds" (Razorpay) to top up the company wallet.',
    code: 'USE_GATEWAY_DEPOSIT'
  });
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
    const filter = req.companyFilter || { companyCode: code };
    const buses = await Bus.find(filter).sort({ busNumber: 1 });
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
      companyId: req.companyId || req.user.companyId || null,
      companyCode: code,
      busType: busType || 'AC Sleeper (2+1)',
      amenities: amenities || ['Charging Point', 'Reading Light', 'Blanket', 'WiFi', 'GPS Tracking'],
      driverDetails: driverDetails || {
        name: 'Dinesh Kumar',
        phone: '+91 0000000000',
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
      .populate('agentId', 'name email phone referralCode bankDetails agencyName kycStatus')
      .sort({ createdAt: -1 });

    const pendingCount = withdrawals.filter(w => w.status === WITHDRAWAL_STATUS.PENDING).length;
    const approvedCount = withdrawals.filter(w => w.status === WITHDRAWAL_STATUS.APPROVED).length;
    const approvedSum = withdrawals
      .filter(w => w.status === WITHDRAWAL_STATUS.APPROVED)
      .reduce((sum, w) => sum + w.amount, 0);

    res.json({
      success: true,
      count: withdrawals.length,
      withdrawals,
      stats: {
        pendingCount,
        approvedCount,
        approvedSum
      }
    });
  } catch (err) {
    next(err);
  }
});

// Approve Withdrawal Request & Disburse to Agent's Bank Account
// Payout mode (automatic RazorpayX vs manual UTR) + company wallet balance for the approve dialog
router.get('/withdrawals/payout-config', async (req, res, next) => {
  try {
    res.json({ success: true, ...(await payoutService.getConfig(req.user.companyCode)) });
  } catch (err) {
    next(err);
  }
});

function sendPayoutError(res, err, next) {
  if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
  return next(err);
}

// Approve (company): KYC-gated. Debits the company wallet and marks the request "under processing".
// RBS admin then pays it (online via RazorpayX, or manually with a UTR).
router.post('/withdrawals/:id/approve', async (req, res, next) => {
  try {
    const w = await payoutService.approve({
      withdrawalId: req.params.id,
      companyCode: req.user.companyCode,
      actorId: req.user._id,
      notes: req.body?.notes
    });
    const amt = `₹${Number(w.amount).toLocaleString('en-IN')}`;
    res.json({ success: true, message: `${amt} approved. Payment is now under processing by RBS — the agent will be paid shortly.`, withdrawal: w });
  } catch (err) {
    sendPayoutError(res, err, next);
  }
});

// Reject a pending request: escrowed funds return to the agent's wallet
router.post('/withdrawals/:id/reject', async (req, res, next) => {
  try {
    const w = await payoutService.reject({
      withdrawalId: req.params.id,
      companyCode: req.user.companyCode,
      actorId: req.user._id,
      reason: req.body?.reason
    });
    res.json({ success: true, message: 'Withdrawal request rejected. Reserved funds returned to the agent wallet.', withdrawal: w });
  } catch (err) {
    sendPayoutError(res, err, next);
  }
});

// -------------------------------------------------------------
// AGENT CASH (COD) COLLECTIONS
// -------------------------------------------------------------
router.get('/cash', async (req, res, next) => {
  try {
    const code = req.user.companyCode;
    const status = String(req.query.status || 'PENDING').toUpperCase();
    const match = { companyCode: code, paymentProvider: 'agent_cash' };
    if (status === 'PENDING') Object.assign(match, { status: 'CONFIRMED', 'cashCollection.status': 'PENDING' });
    else if (status === 'RECEIVED') match['cashCollection.status'] = 'RECEIVED';

    const bookings = await Booking.find(match)
      .select('pnr bookingId status seatNumbers passengers.name cashCollection fareBreakdown.totalPayable fareBreakdown.subtotal bookedByAgentId tripId createdAt')
      .populate('bookedByAgentId', 'name phone referralCode')
      .populate({ path: 'tripId', select: 'departureTime routeId busId', populate: [{ path: 'routeId', select: 'fromCity toCity' }, { path: 'busId', select: 'busNumber' }] })
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    const policy = await cashPolicy.getPolicy(code);
    const pending = bookings.filter((b) => b.cashCollection?.status === 'PENDING' && b.status === 'CONFIRMED');
    res.json({
      success: true,
      policy,
      totals: {
        pendingAmount: pending.reduce((s, b) => s + (b.cashCollection?.amountDue || 0), 0),
        pendingTickets: pending.length
      },
      tickets: bookings.map((b) => ({
        _id: b._id,
        pnr: b.pnr,
        bookingId: b.bookingId,
        status: b.status,
        seats: b.seatNumbers,
        leadPassenger: b.passengers?.[0]?.name,
        amountDue: b.cashCollection?.amountDue || 0,
        cashStatus: b.cashCollection?.status,
        receiptNo: b.cashCollection?.receiptNo,
        receivedAt: b.cashCollection?.receivedAt,
        revertCount: b.cashCollection?.revertCount || 0,
        lastRevert: [...(b.cashCollection?.history || [])].reverse().find((h) => h.action === 'REVERTED') || null,
        agent: b.bookedByAgentId,
        departureTime: b.tripId?.departureTime,
        route: b.tripId?.routeId ? `${b.tripId.routeId.fromCity?.name} → ${b.tripId.routeId.toCity?.name}` : '',
        busNumber: b.tripId?.busId?.busNumber,
        createdAt: b.createdAt
      }))
    });
  } catch (err) {
    next(err);
  }
});

// Mark one or more cash tickets as received at the company office (once each, audited)
router.post('/cash/receive', async (req, res, next) => {
  try {
    const result = await cashCollection.markReceived({
      bookingIds: req.body?.bookingIds || (req.body?.bookingId ? [req.body.bookingId] : []),
      companyCode: req.user.companyCode,
      actorId: req.user._id
    });
    await recordAudit(req, {
      action: 'AGENT_CASH_RECEIVED',
      resource: 'BOOKING',
      details: { receiptNo: result.receiptNo, received: result.received, totalAmount: result.totalAmount, pnrs: result.results.filter((r) => r.ok).map((r) => r.pnr) }
    });
    res.json({
      success: result.received > 0,
      message: result.received
        ? `₹${result.totalAmount.toLocaleString('en-IN')} received for ${result.received} ticket(s). Receipt ${result.receiptNo}.`
        : 'No tickets were updated.',
      error: result.received ? undefined : (result.results[0]?.reason || 'No tickets were updated.'),
      ...result
    });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

// Undo a "cash received" marked by mistake (RECEIVED → PENDING). Reason required, audited.
router.post('/cash/revert', async (req, res, next) => {
  try {
    const result = await cashCollection.revertReceived({
      bookingId: req.body?.bookingId,
      companyCode: req.user.companyCode,
      actorId: req.user._id,
      reason: req.body?.reason
    });
    await recordAudit(req, {
      action: 'AGENT_CASH_RECEIPT_REVERTED',
      resource: 'BOOKING',
      details: { pnr: result.pnr, receiptNo: result.receiptNo, amount: result.amount, commissionTaken: result.commissionTaken, reason: String(req.body?.reason || '').slice(0, 300) }
    });
    res.json({
      success: true,
      message: `Receipt ${result.receiptNo} reverted. PNR ${result.pnr} is back to cash pending (₹${Number(result.amount).toLocaleString('en-IN')}) and cannot board until it is received again.`,
      ...result
    });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

// Company cash rules: allow cash, cut-off hours before departure, per-agent unpaid limit
router.put('/cash/policy', async (req, res, next) => {
  try {
    const enabled = req.body?.enabled !== false;
    const cutoffHours = Math.min(72, Math.max(0, Number(req.body?.cutoffHours ?? 2)));
    const agentCreditLimit = Math.min(1000000, Math.max(0, Math.round(Number(req.body?.agentCreditLimit ?? 25000))));
    await Company.updateOne(
      { $or: [{ companyCode: req.user.companyCode }, { code: req.user.companyCode }] },
      { $set: { cashPolicy: { enabled, cutoffHours, agentCreditLimit } } }
    );
    await recordAudit(req, { action: 'CASH_POLICY_UPDATED', resource: 'COMPANY', details: { enabled, cutoffHours, agentCreditLimit } });
    res.json({ success: true, message: 'Cash booking rules saved.', policy: { enabled, cutoffHours, agentCreditLimit } });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// SETTLEMENTS WITH RBS (read-only for the company)
// -------------------------------------------------------------
router.get('/settlements', async (req, res, next) => {
  try {
    const code = req.user.companyCode;
    const [statements, running] = await Promise.all([
      CompanySettlement.find({ companyCode: code, status: { $ne: 'VOID' } }).select('-lines').sort({ createdAt: -1 }).limit(100).lean(),
      settlementService.compute(code, new Date(Date.now() - 390 * 86400000), new Date(Date.now() + 60000))
    ]);
    const issuedUnpaidNet = statements.filter((s) => s.status === 'ISSUED').reduce((sum, s) => sum + s.net, 0);
    res.json({
      success: true,
      running: {
        ticketFareOwed: running.ticketFareOwed,
        cashHeldByCompany: running.cashHeldByCompany,
        clawbacks: running.clawbacks,
        net: running.net,
        ticketCount: running.ticketCount
      },
      issuedUnpaidNet,
      statements
    });
  } catch (err) {
    next(err);
  }
});

router.get('/settlements/:id/export.csv', async (req, res, next) => {
  try {
    const s = await CompanySettlement.findOne({ _id: req.params.id, companyCode: req.user.companyCode }).lean();
    if (!s) return res.status(404).json({ error: 'Statement not found.' });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${s.statementNo}.csv"`);
    res.send('﻿' + settlementService.toCsv(s));
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// BUS MANAGERS (travel with the bus, board / drop passengers via the mobile app)
// -------------------------------------------------------------
router.get('/managers', async (req, res, next) => {
  try {
    const code = req.user.companyCode;
    const managers = await User.find({ role: ROLES.BUS_MANAGER, companyCode: code })
      .select('name email phone isActive createdAt').sort({ createdAt: -1 }).lean();
    const upcoming = await Trip.aggregate([
      { $match: { companyCode: code, managerId: { $in: managers.map((m) => m._id) }, departureTime: { $gte: new Date() } } },
      { $group: { _id: '$managerId', trips: { $sum: 1 } } }
    ]);
    const tripMap = new Map(upcoming.map((u) => [String(u._id), u.trips]));
    res.json({ success: true, managers: managers.map((m) => ({ ...m, upcomingTrips: tripMap.get(String(m._id)) || 0 })) });
  } catch (err) {
    next(err);
  }
});

router.post('/managers', async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const phone = normalisePhone(req.body?.phone, req.body?.countryCode);
    const password = String(req.body?.password || '');
    if (name.length < 2) return res.status(400).json({ error: 'Name is required.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'A valid email (used as login) is required.' });
    if (!phone) return res.status(400).json({ error: PHONE_ERROR });
    if (password.length < 8 || !/\d/.test(password) || !/[a-zA-Z]/.test(password)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters with letters and numbers.' });
    }
    if (await User.exists({ email })) return res.status(409).json({ error: 'An account with this email already exists.' });

    const doc = req.body?.documents || {};
    const managerProfile = {
      idType: String(doc.idType || '').trim(),
      idNumber: String(doc.idNumber || '').trim(),
      idProofUrl: String(doc.idProofUrl || '').trim(),
      photoUrl: String(doc.photoUrl || '').trim(),
      address: String(doc.address || req.body?.address || '').trim(),
      notes: String(doc.notes || '').trim()
    };

    const manager = await User.create({
      name, email, phone,
      passwordHash: await bcrypt.hash(password, 12),
      role: ROLES.BUS_MANAGER,
      companyCode: req.user.companyCode,
      companyId: req.user.companyId || null,
      managerProfile,
      isActive: true
    });

    // Optional step 3: set this manager as the default manager of one or more buses.
    const busIds = Array.isArray(req.body?.busIds) ? req.body.busIds : (req.body?.busId ? [req.body.busId] : []);
    let assignedBuses = 0;
    let assignedTrips = 0;
    if (busIds.length) {
      const buses = await Bus.find({ _id: { $in: busIds }, companyCode: req.user.companyCode }).select('_id');
      const ids = buses.map((b) => b._id);
      if (ids.length) {
        await Bus.updateMany({ _id: { $in: ids } }, { $set: { defaultManagerId: manager._id } });
        assignedBuses = ids.length;
        if (req.body?.assignUpcoming) {
          const r = await Trip.updateMany({ busId: { $in: ids }, companyCode: req.user.companyCode, status: 'SCHEDULED', departureTime: { $gte: new Date() } }, { $set: { managerId: manager._id } });
          assignedTrips = r.modifiedCount || 0;
        }
      }
    }

    await recordAudit(req, { action: 'BUS_MANAGER_CREATED', resource: 'USER', resourceId: manager._id, details: { email, assignedBuses } });
    res.status(201).json({
      success: true,
      message: `Bus manager ${name} created. They can log in to the manager app with ${email}.${assignedBuses ? ` Set as default manager on ${assignedBuses} bus(es)${assignedTrips ? `, applied to ${assignedTrips} upcoming trip(s)` : ''}.` : ''}`,
      manager: { _id: manager._id, name, email, phone, isActive: true, managerProfile }
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/managers/:id', async (req, res, next) => {
  try {
    const manager = await User.findOne({ _id: req.params.id, role: ROLES.BUS_MANAGER, companyCode: req.user.companyCode });
    if (!manager) return res.status(404).json({ error: 'Bus manager not found under your company.' });
    const set = {};
    if (typeof req.body?.isActive === 'boolean') set.isActive = req.body.isActive;
    if (req.body?.name && String(req.body.name).trim().length >= 2) set.name = String(req.body.name).trim();
    if (req.body?.phone) {
      const phone = normalisePhone(req.body.phone, req.body?.countryCode);
      if (!phone) return res.status(400).json({ error: PHONE_ERROR });
      set.phone = phone;
    }
    const doc = req.body?.documents;
    if (doc && typeof doc === 'object') {
      ['idType', 'idNumber', 'idProofUrl', 'photoUrl', 'address', 'notes'].forEach((k) => {
        if (doc[k] !== undefined) set[`managerProfile.${k}`] = String(doc[k] || '').trim();
      });
    }
    if (req.body?.password) {
      const pw = String(req.body.password);
      if (pw.length < 8 || !/\d/.test(pw) || !/[a-zA-Z]/.test(pw)) return res.status(400).json({ error: 'Password must be at least 8 characters with letters and numbers.' });
      set.passwordHash = await bcrypt.hash(pw, 12);
    }
    if (!Object.keys(set).length) return res.status(400).json({ error: 'Nothing to update.' });
    await User.updateOne({ _id: manager._id }, { $set: set });
    if (set.isActive === false || set.passwordHash) {
      await require('../auth/refreshToken.model').updateMany({ userId: manager._id }, { $set: { isRevoked: true, revokedAt: new Date() } }).catch(() => {});
    }
    res.json({ success: true, message: 'Bus manager updated.' });
  } catch (err) {
    next(err);
  }
});

// One manager's full profile (docs + assigned buses + upcoming trips) for the detail / edit view
router.get('/managers/:id', async (req, res, next) => {
  try {
    const manager = await User.findOne({ _id: req.params.id, role: ROLES.BUS_MANAGER, companyCode: req.user.companyCode })
      .select('name email phone isActive managerProfile createdAt').lean();
    if (!manager) return res.status(404).json({ error: 'Bus manager not found under your company.' });
    const [buses, trips] = await Promise.all([
      Bus.find({ companyCode: req.user.companyCode, defaultManagerId: manager._id }).select('busNumber name').lean(),
      Trip.find({ companyCode: req.user.companyCode, managerId: manager._id, departureTime: { $gte: new Date() } })
        .select('departureTime routeId busId status').populate('routeId', 'fromCity toCity').populate('busId', 'busNumber').sort({ departureTime: 1 }).limit(20).lean()
    ]);
    res.json({ success: true, manager, defaultBuses: buses, upcomingTrips: trips });
  } catch (err) {
    next(err);
  }
});

// Assign, change (incl. mid-route handover) or clear the bus manager of one trip.
// Body: { managerId, handoverPoint?, note? }. A change while DEPARTED records a handover point.
router.put('/trips/:id/manager', async (req, res, next) => {
  try {
    const scope = req.companyFilter || { companyCode: req.user.companyCode };
    const managerId = req.body?.managerId || null;
    let manager = null;
    if (managerId) {
      manager = await User.findOne({ _id: managerId, role: ROLES.BUS_MANAGER, companyCode: req.user.companyCode, isActive: true }).select('name').lean();
      if (!manager) return res.status(400).json({ error: 'Choose an active bus manager of your company.' });
    }
    // Changing the manager is allowed before and during the journey, but not once it's over.
    const trip = await Trip.findOne({ _id: req.params.id, ...scope, status: { $in: ['SCHEDULED', 'BOARDING', 'DEPARTED'] } })
      .populate('routeId', 'boardingPoints droppingPoints');
    if (!trip) return res.status(404).json({ error: 'Active trip not found under your company (a completed or cancelled trip cannot be changed).' });

    if (String(trip.managerId || '') === String(managerId || '')) {
      return res.json({ success: true, message: 'No change — that manager is already assigned.', managerId });
    }

    const midRoute = trip.status === 'DEPARTED';
    let handoverPoint = String(req.body?.handoverPoint || '').trim();
    if (managerId && (midRoute || (trip.managerTimeline || []).length)) {
      // A handover needs a point; validate it against the route when one is set up.
      const points = [...(trip.routeId?.boardingPoints || []), ...(trip.routeId?.droppingPoints || [])].map((p) => p.name);
      if (!handoverPoint) return res.status(400).json({ error: 'Select the stop where the new manager takes over the bus.' });
      if (points.length && !points.some((n) => n.toLowerCase() === handoverPoint.toLowerCase())) {
        return res.status(400).json({ error: 'That handover stop is not on this route.' });
      }
    }

    trip.managerId = managerId;
    if (managerId) {
      trip.managerTimeline = trip.managerTimeline || [];
      trip.managerTimeline.push({
        managerId,
        managerName: manager?.name || '',
        handoverPoint: (trip.managerTimeline.length || midRoute) ? handoverPoint : '',
        note: String(req.body?.note || '').trim(),
        assignedBy: req.user._id,
        at: new Date()
      });
    }
    await trip.save();
    res.json({
      success: true,
      message: !managerId ? 'Bus manager removed from this trip.'
        : midRoute ? `${manager.name} now manages the bus from ${handoverPoint}.`
          : handoverPoint ? `${manager.name} assigned (takes over at ${handoverPoint}).`
            : `${manager.name} assigned to this trip.`,
      managerId
    });
  } catch (err) {
    next(err);
  }
});

// Manager handover timeline for one trip: who managed the bus, from which stop, on the trip's day.
router.get('/trips/:id/manager-timeline', async (req, res, next) => {
  try {
    const scope = req.companyFilter || { companyCode: req.user.companyCode };
    const trip = await Trip.findOne({ _id: req.params.id, ...scope })
      .select('departureTime status managerId managerTimeline routeId busId')
      .populate('routeId', 'fromCity toCity boardingPoints droppingPoints')
      .populate('busId', 'busNumber')
      .populate('managerTimeline.managerId', 'name phone')
      .populate('managerTimeline.assignedBy', 'name')
      .lean();
    if (!trip) return res.status(404).json({ error: 'Trip not found under your company.' });

    const entries = (trip.managerTimeline || []).map((e, i, arr) => ({
      managerId: e.managerId?._id || e.managerId,
      managerName: e.managerId?.name || e.managerName || 'Manager',
      managerPhone: e.managerId?.phone || '',
      from: e.handoverPoint || trip.routeId?.fromCity?.name || 'Origin',
      until: i < arr.length - 1 ? (arr[i + 1].handoverPoint || 'next handover') : (trip.routeId?.toCity?.name || 'Destination'),
      note: e.note || '',
      assignedBy: e.assignedBy?.name || '',
      at: e.at
    }));

    res.json({
      success: true,
      trip: { _id: trip._id, date: trip.departureTime, status: trip.status, route: `${trip.routeId?.fromCity?.name || ''} → ${trip.routeId?.toCity?.name || ''}`, busNumber: trip.busId?.busNumber || '' },
      stops: [...(trip.routeId?.boardingPoints || []), ...(trip.routeId?.droppingPoints || [])].map((p) => ({ id: p.id, name: p.name })),
      currentManagerId: trip.managerId,
      timeline: entries
    });
  } catch (err) {
    next(err);
  }
});

// Default manager for a bus (applied to its future trips; optionally to already-scheduled ones)
router.put('/fleet/:id/default-manager', async (req, res, next) => {
  try {
    const managerId = req.body?.managerId || null;
    if (managerId && !(await User.exists({ _id: managerId, role: ROLES.BUS_MANAGER, companyCode: req.user.companyCode, isActive: true }))) {
      return res.status(400).json({ error: 'Choose an active bus manager of your company.' });
    }
    const bus = await Bus.findOneAndUpdate({ _id: req.params.id, companyCode: req.user.companyCode }, { $set: { defaultManagerId: managerId } }, { new: true });
    if (!bus) return res.status(404).json({ error: 'Bus not found under your company.' });
    let updatedTrips = 0;
    if (req.body?.applyToUpcoming) {
      const r = await Trip.updateMany({ busId: bus._id, companyCode: req.user.companyCode, status: 'SCHEDULED', departureTime: { $gte: new Date() } }, { $set: { managerId } });
      updatedTrips = r.modifiedCount;
    }
    res.json({ success: true, message: `Default bus manager saved${updatedTrips ? ` and applied to ${updatedTrips} upcoming trip(s)` : ''}.` });
  } catch (err) {
    next(err);
  }
});

// Live boarding progress of a trip (counts only)
router.get('/trips/:id/journey', async (req, res, next) => {
  try {
    const scope = req.companyFilter || { companyCode: req.user.companyCode };
    const trip = await Trip.findOne({ _id: req.params.id, ...scope }).select('status journey managerId').populate('managerId', 'name phone').lean();
    if (!trip) return res.status(404).json({ error: 'Trip not found under your company.' });
    const counts = await require('../manager/manager.service').tripCounts(trip._id);
    res.json({ success: true, status: trip.status, journey: trip.journey, manager: trip.managerId, counts });
  } catch (err) {
    next(err);
  }
});

// WhatsApp number that receives journey started / completed summaries
router.get('/notify-phone', async (req, res, next) => {
  try {
    const c = await Company.findOne({ companyCode: req.user.companyCode }).select('notifyPhone contactPhone').lean();
    res.json({ success: true, notifyPhone: c?.notifyPhone || '', fallback: c?.contactPhone || req.user.phone || '' });
  } catch (err) {
    next(err);
  }
});

router.put('/notify-phone', async (req, res, next) => {
  try {
    const rawPhone = String(req.body?.phone || '').trim();
    const phone = rawPhone ? normalisePhone(rawPhone, req.body?.countryCode) : '';
    if (rawPhone && !phone) return res.status(400).json({ error: PHONE_ERROR });
    await Company.updateOne({ companyCode: req.user.companyCode }, { $set: { notifyPhone: phone } });
    res.json({ success: true, message: phone ? `Trip summaries will be sent to ${formatPhone(phone)}.` : 'Trip summaries will go to the company contact number.', notifyPhone: phone });
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

// Company performance report: range = 1m | 3m | 6m | 12m  (CSV with ?format=csv)
router.get('/reports/summary', async (req, res, next) => {
  try {
    const code = req.user.companyCode;
    const report = await companyReports.companyReport(code, String(req.query.range || '1m'));
    if (req.query.format === 'csv') {
      const company = await Company.findOne({ companyCode: code }).select('name').lean();
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="company-${code}-report-${report.range}.csv"`);
      return res.send('﻿' + companyReports.reportToCsv(report, company?.name || `Company #${code}`));
    }
    res.json({ success: true, report });
  } catch (err) {
    next(err);
  }
});

// This company's booking history: overall or by agent, filtered by date range or month.
router.get('/history', async (req, res, next) => {
  try {
    const history = await companyReports.ownHistory(req.user.companyCode, {
      month: req.query.month, from: req.query.from, to: req.query.to, agentId: req.query.agentId
    });
    res.json({ success: true, companyCode: req.user.companyCode, history });
  } catch (err) {
    next(err);
  }
});

// Excel export of this company's booking history.
router.get('/history/export.xlsx', async (req, res, next) => {
  try {
    const history = await companyReports.ownHistory(req.user.companyCode, {
      month: req.query.month, from: req.query.from, to: req.query.to, agentId: req.query.agentId
    });
    const company = await Company.findOne({ companyCode: req.user.companyCode }).select('name').lean();
    const { buffer, filename } = companyReports.ownHistoryXlsx(history, company?.name || `Company ${req.user.companyCode}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

// All companies' booking history (counts only, no personal data), filtered by date range or month.
router.get('/network-history', async (req, res, next) => {
  try {
    const history = await companyReports.networkHistory({ month: req.query.month, from: req.query.from, to: req.query.to });
    res.json({ success: true, myCompanyCode: req.user.companyCode, history });
  } catch (err) {
    next(err);
  }
});

// Excel export of all companies' booking history.
router.get('/network-history/export.xlsx', async (req, res, next) => {
  try {
    const history = await companyReports.networkHistory({ month: req.query.month, from: req.query.from, to: req.query.to });
    const { buffer, filename } = companyReports.networkHistoryXlsx(history);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

// Booking counts of all companies (no passenger or customer details)
router.get('/network-stats', async (req, res, next) => {
  try {
    const stats = await companyReports.networkStats(String(req.query.range || '1m'));
    res.json({ success: true, myCompanyCode: req.user.companyCode, ...stats });
  } catch (err) {
    next(err);
  }
});

// Company Corridor Trips / Schedules
router.get('/trips', async (req, res, next) => {
  try {
    const code = req.user.companyCode;
    const query = { ...(req.companyFilter || { companyCode: code }) };

    // Support optional date query
    // Optional date (India-time calendar day).
    const dayRange = req.query.date ? istDayRange(req.query.date) : null;
    if (dayRange) query.departureTime = { $gte: dayRange[0], $lt: dayRange[1] };

    const sortOption = req.query.sort === 'departure_asc' 
      ? { departureTime: 1 }
      : req.query.sort === 'departure_desc'
      ? { departureTime: -1 }
      : { createdAt: -1 }; // Default: Latest created first!

    const trips = await Trip.find(query)
      .populate('routeId')
      .populate('busId')
      .populate('managerId', 'name phone')
      .sort(sortOption)
      .limit(200);

    const now = new Date();

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

      const isExpired = new Date(t.departureTime) < now;
      let liveStatus = t.status || 'SCHEDULED';
      if (isExpired && !t.chartPrepared) {
        liveStatus = 'DEPARTED';
      } else if (t.chartPrepared) {
        liveStatus = 'BOARDING';
      }

      return {
        _id: t._id,
        id: t._id,
        tripNumber: `TRP-${String(t._id).slice(-4).toUpperCase()}`,
        rawTripId: t._id,
        companyCode: t.companyCode,
        companyId: t.companyId,
        fromCity,
        toCity,
        corridor: `${fromCity} → ${toCity}`,
        busNumber,
        busName,
        busType,
        bus: `${busNumber} (${busName})`,
        driverName: t.busId?.driverDetails?.name || 'Assigned Driver',
        driverPhone: t.busId?.driverDetails?.phone || '+91 0000000000',
        departureTime: t.departureTime,
        arrivalTime: t.arrivalTime,
        createdAt: t.createdAt,
        baseFare: t.baseFare || 1650,
        minFare: seats.length ? Math.min(...seats.map(s => s.fare || t.baseFare)) : t.baseFare,
        maxFare: seats.length ? Math.max(...seats.map(s => s.fare || t.baseFare)) : t.baseFare,
        status: liveStatus,
        isExpired,
        chartPrepared: Boolean(t.chartPrepared),
        tripStatus: t.status,
        manager: t.managerId ? { _id: t.managerId._id, name: t.managerId.name, phone: t.managerId.phone } : null,
        journey: t.journey || null,
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

// -------------------------------------------------------------
// SEAT-LEVEL PRICING (company owner / super admin only — agents are blocked by router RBAC)
// -------------------------------------------------------------
const EDITABLE_TRIP_STATUSES = ['SCHEDULED', 'BOARDING'];

function tripEditBlockReason(trip) {
  if (!trip) return 'Trip not found under your company';
  if (!EDITABLE_TRIP_STATUSES.includes(trip.status || 'SCHEDULED')) return `Trip is ${String(trip.status).toLowerCase()}; prices can no longer be changed.`;
  if (trip.chartPrepared) return 'Seat chart is already prepared for this trip; prices are locked.';
  if (new Date(trip.departureTime).getTime() <= Date.now()) return 'This trip has already departed.';
  return null;
}

// Seat map with current prices + other upcoming trips (same bus & route) the change can be copied to
router.get('/trips/:id/seat-fares', async (req, res, next) => {
  try {
    const scope = req.companyFilter || { companyCode: req.user.companyCode };
    const trip = await Trip.findOne({ _id: req.params.id, ...scope })
      .select('routeId busId companyCode departureTime arrivalTime baseFare status chartPrepared seats')
      .populate('routeId', 'fromCity toCity')
      .populate('busId', 'busNumber name busType layoutType');
    if (!trip) return res.status(404).json({ error: 'Trip not found under your company' });

    const held = new Set(holdStore.getHeldSeatsForTrip(String(trip._id)).map((s) => String(s).toLowerCase()));
    const siblings = await Trip.find({
      ...scope,
      _id: { $ne: trip._id },
      busId: trip.busId?._id || trip.busId,
      routeId: trip.routeId?._id || trip.routeId,
      status: { $in: EDITABLE_TRIP_STATUSES },
      chartPrepared: { $ne: true },
      departureTime: { $gt: new Date() }
    }).select('departureTime baseFare seats.fare seats.status').sort({ departureTime: 1 }).limit(60).lean();

    res.json({
      success: true,
      editable: !tripEditBlockReason(trip),
      lockedReason: tripEditBlockReason(trip),
      maxFare: Math.round(trip.baseFare * MAX_FARE_MULTIPLIER),
      trip: {
        _id: trip._id,
        departureTime: trip.departureTime,
        baseFare: trip.baseFare,
        status: trip.status,
        fromCity: trip.routeId?.fromCity?.name,
        toCity: trip.routeId?.toCity?.name,
        bus: trip.busId
      },
      seats: trip.seats.map((s) => ({
        seatNumber: s.seatNumber,
        row: s.row,
        column: s.column,
        deck: s.deck || 'LOWER',
        fare: s.fare || trip.baseFare,
        status: s.status === 'AVAILABLE' && held.has(String(s.seatNumber).toLowerCase()) ? 'HELD' : s.status
      })),
      otherTrips: siblings.map((t) => {
        const fares = (t.seats || []).map((s) => s.fare).filter(Boolean);
        return {
          _id: t._id,
          departureTime: t.departureTime,
          minFare: fares.length ? Math.min(...fares) : t.baseFare,
          maxFare: fares.length ? Math.max(...fares) : t.baseFare,
          bookedSeats: (t.seats || []).filter((s) => s.status === 'BOOKED').length
        };
      })
    });
  } catch (err) {
    next(err);
  }
});

// Change the price of selected seats (SET / +₹ / −₹ / +% / −%), optionally on other trips too
router.patch('/trips/:id/seat-fares', async (req, res, next) => {
  try {
    const scope = req.companyFilter || { companyCode: req.user.companyCode };
    const { seatNumbers, selector, mode, value, valueType = 'AMOUNT', applyToTripIds = [] } = req.body || {};
    const change = { mode, value, valueType };
    const selection = { seatNumbers, selector };

    const primary = await Trip.findOne({ _id: req.params.id, ...scope });
    const blocked = tripEditBlockReason(primary);
    if (blocked) return res.status(primary ? 409 : 404).json({ error: blocked });

    // Additional trips must be the same company, bus (same layout) and route, and still editable.
    const extraIds = [...new Set((Array.isArray(applyToTripIds) ? applyToTripIds : []).map(String))]
      .filter((id) => id !== String(primary._id) && /^[a-f0-9]{24}$/i.test(id));
    if (extraIds.length > 60) return res.status(400).json({ error: 'You can apply a change to at most 60 other trips at once.' });
    const extraTrips = extraIds.length
      ? await Trip.find({ _id: { $in: extraIds }, ...scope, busId: primary.busId, routeId: primary.routeId })
      : [];
    if (extraTrips.length !== extraIds.length) {
      return res.status(400).json({ error: 'Some selected trips do not belong to the same bus and route under your company.' });
    }
    const editableExtras = extraTrips.filter((t) => !tripEditBlockReason(t));

    // For a fixed price, copy the primary trip's seat selection exactly; relative changes apply per trip.
    const plans = [];
    for (const trip of [primary, ...editableExtras]) {
      try {
        plans.push({ trip, ...planFareChanges(trip, change, selection) });
      } catch (planErr) {
        if (trip === primary) throw planErr;
        plans.push({ trip, changes: [], skippedBooked: [], error: planErr.message });
      }
    }

    const results = [];
    for (const plan of plans) {
      if (!plan.changes.length) {
        results.push({ tripId: plan.trip._id, departureTime: plan.trip.departureTime, updated: 0, skippedBooked: plan.skippedBooked, error: plan.error || null });
        continue;
      }
      const setOps = {};
      const arrayFilters = [];
      plan.changes.forEach((c, i) => {
        setOps[`seats.$[f${i}].fare`] = c.after;
        arrayFilters.push({ [`f${i}.seatNumber`]: c.seatNumber, [`f${i}.status`]: { $ne: 'BOOKED' } });
      });
      const upd = await Trip.updateOne(
        { _id: plan.trip._id, status: { $in: EDITABLE_TRIP_STATUSES }, chartPrepared: { $ne: true } },
        { $set: setOps },
        { arrayFilters }
      );

      const fresh = await Trip.findById(plan.trip._id).select('seats.seatNumber seats.fare seats.status').lean();
      const freshMap = new Map((fresh?.seats || []).map((s) => [s.seatNumber, s]));
      // A seat that got booked between planning and the update keeps its old price.
      const applied = plan.changes.filter((c) => freshMap.get(c.seatNumber)?.fare === c.after);
      const raced = plan.changes.filter((c) => freshMap.get(c.seatNumber)?.fare !== c.after).map((c) => c.seatNumber);

      results.push({
        tripId: plan.trip._id,
        departureTime: plan.trip.departureTime,
        updated: upd.modifiedCount ? applied.length : 0,
        skippedBooked: [...plan.skippedBooked, ...raced],
        changes: applied
      });

      if (applied.length) {
        await recordAudit(req, {
          action: 'SEAT_FARE_CHANGE',
          resource: 'TRIP',
          resourceId: plan.trip._id,
          companyCode: plan.trip.companyCode,
          details: { change, selection, changes: applied }
        });
        try {
          websocketService.broadcast(`trip:${plan.trip._id}`, 'SEAT_FARES_UPDATED', {
            tripId: String(plan.trip._id),
            seatFares: (fresh?.seats || []).map((s) => ({ seatNumber: s.seatNumber, fare: s.fare }))
          });
        } catch (e) { /* realtime best-effort */ }
      }
    }

    const primaryResult = results[0];
    const otherUpdated = results.slice(1).filter((r) => r.updated > 0).length;
    const skipped = primaryResult.skippedBooked.length;
    res.json({
      success: true,
      message: `Updated ${primaryResult.updated} seat price${primaryResult.updated === 1 ? '' : 's'}`
        + (skipped ? ` (${skipped} booked seat${skipped === 1 ? '' : 's'} kept at the old price)` : '')
        + (extraIds.length ? ` · also applied to ${otherUpdated} of ${extraIds.length} other trip${extraIds.length === 1 ? '' : 's'}` : '')
        + '.',
      results,
      lockedTrips: extraTrips.filter((t) => tripEditBlockReason(t)).map((t) => ({ tripId: t._id, reason: tripEditBlockReason(t) }))
    });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
});

// Schedule & Dispatch New Trip for Date (Up to next 7 days)
router.post('/trips', async (req, res, next) => {
  try {
    const code = req.user.companyCode;
    const { 
      routeId, 
      busId, 
      origin, 
      destination, 
      departureDate, 
      departureTime, 
      arrivalTime, 
      baseFare 
    } = req.body;

    // 1. Bus lookup and ownership verification
    if (!busId) {
      return res.status(400).json({ success: false, error: 'Please select an assigned fleet coach.' });
    }
    const bus = await Bus.findOne({
      _id: busId,
      ...(req.companyFilter || { companyCode: code })
    });
    if (!bus) {
      return res.status(404).json({ success: false, error: 'Assigned bus was not found in your company fleet.' });
    }

    // 2. Bus Compliance Verification (30-day legal paper expiry guard)
    if (typeof bus.checkCompliance === 'function') {
      const compliance = bus.checkCompliance();
      if (!compliance.isCompliant) {
        return res.status(400).json({
          success: false,
          error: `Bus ${bus.busNumber} cannot be dispatched due to expired legal documents: ${compliance.expiredDocs.join(', ')}`
        });
      }
    }

    // 3. Resolve Route (by routeId or by origin/destination)
    let route = null;
    if (routeId) {
      route = await Route.findById(routeId);
    }
    if (!route && origin && destination) {
      const normFrom = normalizeCityId(origin);
      const normTo = normalizeCityId(destination);
      route = await Route.findOne({
        $or: [
          { 'fromCity.id': normFrom, 'toCity.id': normTo },
          { 'fromCity.name': new RegExp(`^${origin.replace(/[()]/g, '')}`, 'i'), 'toCity.name': new RegExp(`^${destination.replace(/[()]/g, '')}`, 'i') }
        ]
      });

      // If route doesn't exist yet, auto-create it with standard hub points
      if (!route) {
        const fromName = (origin.includes('Rupai') || origin.includes('Rupa')) ? 'Rupaidiha' : origin;
        const toName = (destination.includes('Rupai') || destination.includes('Rupa')) ? 'Rupaidiha' : destination;
        const matchedSpoke = SPOKE_CITIES.find(s => s.id === normFrom || s.id === normTo || s.name.toLowerCase() === fromName.toLowerCase() || s.name.toLowerCase() === toName.toLowerCase());
        const distanceKm = matchedSpoke?.distanceKm || 1200;
        const durationHours = matchedSpoke ? (parseFloat(matchedSpoke.duration) || 20) : 20;
        const spokeState = matchedSpoke?.state || 'India';
        const routeFare = Number(baseFare) || matchedSpoke?.baseFare || 1650;

        route = await Route.create({
          companyId: req.user.companyId || bus.companyId || null,
          companyCode: code,
          fromCity: { id: normFrom, name: fromName, state: (fromName === 'Rupaidiha' || fromName === 'Rupadiya') ? 'Uttar Pradesh' : spokeState },
          toCity: { id: normTo, name: toName, state: (toName === 'Rupaidiha' || toName === 'Rupadiya') ? 'Uttar Pradesh' : spokeState },
          distanceKm,
          estimatedDurationHours: durationHours,
          baseFare: routeFare,
          boardingPoints: [{ id: `bp-${normFrom}-1`, name: `${fromName} Central Hub Terminal`, timeOffsetMinutes: 0 }],
          droppingPoints: [{ id: `dp-${normTo}-1`, name: `${toName} Intercity Drop Point`, timeOffsetMinutes: Math.round(durationHours * 60) }]
        });
      }
    }

    if (!route) {
      return res.status(400).json({ success: false, error: 'Valid route corridor could not be resolved.' });
    }

    // 4. Resolve Departure Date & Time (Supporting today through next 7 days)
    let depDateTime;
    if (departureDate && departureTime) {
      // Times are entered in India time; the server runs in UTC, so the offset must be explicit.
      depDateTime = new Date(`${departureDate}T${String(departureTime).slice(0, 5)}:00+05:30`);
    } else if (departureTime && departureTime.includes('T')) {
      depDateTime = new Date(departureTime);
    } else if (departureDate) {
      depDateTime = new Date(`${departureDate}T18:00:00+05:30`);
    } else {
      depDateTime = new Date();
    }

    if (isNaN(depDateTime.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid departure date or time provided.' });
    }

    // Calculate arrival time based on route duration
    const durationHours = route.estimatedDurationHours || 20;
    const arrDateTime = arrivalTime 
      ? new Date(arrivalTime) 
      : new Date(depDateTime.getTime() + durationHours * 3600 * 1000);

    const fare = Number(baseFare) || route.baseFare || 1650;
    const isSleeper = bus.layoutType === '2+1' || bus.busType?.toLowerCase().includes('sleeper');
    const seats = isSleeper ? Trip.generateSleeper36Seats(fare) : Trip.generateSeater40Seats(fare);

    const trip = new Trip({
      routeId: route._id,
      busId: bus._id,
      companyId: bus.companyId || req.user.companyId || null,
      companyCode: bus.companyCode || code,
      departureTime: depDateTime,
      arrivalTime: arrDateTime,
      baseFare: fare,
      seats,
      status: 'SCHEDULED'
    });

    await trip.save();
    await trip.populate('routeId');
    await trip.populate('busId');

    const formattedDepartureStr = depDateTime.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

    res.status(201).json({
      success: true,
      message: `Trip successfully dispatched for ${route.fromCity?.name} → ${route.toCity?.name} on ${formattedDepartureStr} at ${departureTime || depDateTime.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}.`,
      trip
    });
  } catch (err) {
    next(err);
  }
});

// Prepare Seat Chart for a Trip
router.post('/trips/:id/prepare-chart', async (req, res, next) => {
  try {
    const code = req.user.companyCode;
    const filter = {
      _id: req.params.id,
      ...(req.companyFilter || { companyCode: code })
    };
    const trip = await Trip.findOne(filter)
      .populate('routeId')
      .populate('busId');

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found under your company' });
    }

    // Guard: Expired/past departures cannot prepare chart
    if (new Date(trip.departureTime) < new Date()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot prepare chart for an expired trip. The scheduled departure time has already passed.' 
      });
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
        rawTripId: trip._id,
        tripNumber: `TRP-${String(trip._id).slice(-4).toUpperCase()}`,
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
    const filter = {
      _id: req.params.id,
      ...(req.companyFilter || { companyCode: code })
    };
    const trip = await Trip.findOne(filter)
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
              age: p.age || '—',
              gender: p.gender || '—',
              contactPhone: b.passengerPhone || b.contactDetails?.phone || b.passengerId?.phone || '—',
              pnr: b.pnr || b.bookingId || `RUP-${String(b._id).slice(-6).toUpperCase()}`,
              bookingId: b.bookingId || String(b._id),
              boardingPoint: b.boardingPoint?.name || b.boardingPoint || 'Rupaidiha Main Stand',
              droppingPoint: b.droppingPoint?.name || b.droppingPoint || 'Central Drop Point',
              fare: p.fare || b.fareBreakdown?.baseFare || trip.baseFare || 1650,
              insuranceEnrolled: Boolean(b.insuranceEnrolled),
              status: 'CONFIRMED'
            };
          }
        });
      }
    });

    const isSleeper = trip.busId?.layoutType === '2+1' || trip.busId?.busType?.toLowerCase().includes('sleeper');
    const allSeats = (trip.seats && trip.seats.length > 0)
      ? trip.seats
      : (isSleeper ? Trip.generateSleeper36Seats(trip.baseFare || 1650) : Trip.generateSeater40Seats(trip.baseFare || 1650));

    // Populate manifest rows for all seats in trip
    const manifest = allSeats.map(seat => {
      const bookedData = seatPassengerMap[seat.seatNumber] || (seat.status === 'BOOKED' && seat.passenger?.name ? {
        passengerName: seat.passenger.name,
        age: seat.passenger.age || '—',
        gender: seat.passenger.gender || '—',
        contactPhone: seat.passenger.phone || '—',
        pnr: seat.passenger.pnr || `RUP-${seat.seatNumber}`,
        bookingId: seat.passenger.bookingId || `BK-${seat.seatNumber}`,
        boardingPoint: seat.passenger.boardingPoint || 'Main Stand',
        droppingPoint: seat.passenger.droppingPoint || 'Destination Station',
        fare: seat.fare || trip.baseFare || 1650,
        insuranceEnrolled: Boolean(seat.passenger.insuranceEnrolled),
        status: 'CONFIRMED'
      } : null);

      return {
        seatNumber: seat.seatNumber,
        row: seat.row,
        column: seat.column,
        deck: seat.deck || 'LOWER',
        category: seat.category || 'STANDARD',
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
          fromCity: trip.routeId?.fromCity || { name: 'Rupaidiha (Hub)' },
          toCity: trip.routeId?.toCity || { name: 'Ahmedabad' },
          distanceKm: trip.routeId?.distanceKm || 1150
        },
        bus: {
          busNumber: trip.busId?.busNumber || 'UP-40-BT-1001',
          name: trip.busId?.name || 'BharatBenz Sleeper',
          busType: trip.busId?.busType || 'AC Sleeper (2+1)',
          operatorName: trip.busId?.operatorName || 'Rupadiya Intercity Travels',
          driverName: trip.busId?.driverDetails?.name || 'Vikram Singh',
          driverPhone: trip.busId?.driverDetails?.phone || '+91 0000000000',
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
