const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middleware/auth.middleware');
const { authorizeRoles } = require('../../middleware/rbac.middleware');
const Company = require('../companies/company.model');
const Bus = require('../fleet/bus.model');
const Route = require('../routes/route.model');
const Trip = require('../trips/trip.model');
const Booking = require('../bookings/booking.model');
const User = require('../users/user.model');
const KycDocument = require('../kyc/kyc.model');
const { Wallet, WalletLedger } = require('../wallets/wallet.model');
const { CommissionTier, CommissionRecord } = require('../commissions/commission.model');
const AuditLog = require('../audit/audit.model');
const bcrypt = require('bcryptjs');
const { ROLES, KYC_STATUS, COMPANY_CODES, DEFAULT_COMMISSION_TIERS, TRANSACTION_TYPES } = require('../../config/constants');

router.use(authenticateToken);
router.use(authorizeRoles(ROLES.SUPER_ADMIN));

// Master Global Dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalAgents = await User.countDocuments({ role: ROLES.AGENT });
    const totalBuses = await Bus.countDocuments({ status: 'ACTIVE' });
    const totalTrips = await Trip.countDocuments();
    const confirmedBookings = await Booking.find({ status: 'CONFIRMED' });

    const totalGMV = confirmedBookings.reduce((sum, b) => sum + b.fareBreakdown.totalPayable, 0);
    const totalSeatsBooked = confirmedBookings.reduce((sum, b) => sum + b.seatNumbers.length, 0);
    const totalGSTCollected = confirmedBookings.reduce((sum, b) => sum + b.fareBreakdown.gstAmount, 0);

    const pendingKycCount = await KycDocument.countDocuments({ status: KYC_STATUS.PENDING });

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalAgents,
        totalBuses,
        totalTrips,
        totalBookings: confirmedBookings.length,
        totalSeatsBooked,
        totalGMV,
        totalGSTCollected,
        pendingKycCount
      }
    });
  } catch (err) {
    next(err);
  }
});

// Companies List (1-33) & Owner Assignment
router.get('/companies', async (req, res, next) => {
  try {
    const dbCompanies = await Company.find().populate('ownerId', 'name email phone');

    // Merge with master 33 company codes to ensure all 1..33 exist
    const fullList = COMPANY_CODES.map(c => {
      const match = dbCompanies.find(dc => dc.companyCode === c.code);
      return match ? match.toObject() : {
        companyCode: c.code,
        name: c.defaultName,
        slug: c.slug,
        ownerId: null,
        status: 'UNASSIGNED',
        annualTarget: { targetPassengers: 10000, currentPassengers: 0 }
      };
    });

    res.json({ success: true, count: fullList.length, companies: fullList });
  } catch (err) {
    next(err);
  }
});

// Assign Owner to Company Code
router.post('/companies/:code/assign-owner', async (req, res, next) => {
  try {
    const code = parseInt(req.params.code, 10);
    const { ownerEmail, companyName } = req.body;

    const owner = await User.findOne({ email: ownerEmail.toLowerCase() });
    if (!owner) {
      return res.status(404).json({ error: 'User with specified email not found' });
    }

    owner.role = ROLES.COMPANY_OWNER;
    owner.companyCode = code;
    await owner.save();

    let company = await Company.findOne({ companyCode: code });
    if (!company) {
      company = new Company({
        companyCode: code,
        name: companyName || `Rupadiya Transporters Co. #${code.toString().padStart(2, '0')}`,
        slug: `comp-${code}`,
        ownerId: owner._id,
        status: 'ACTIVE'
      });
    } else {
      company.ownerId = owner._id;
      if (companyName) company.name = companyName;
      company.status = 'ACTIVE';
    }
    await company.save();

    res.json({ success: true, message: `Company Code ${code} assigned to ${owner.name}`, company });
  } catch (err) {
    next(err);
  }
});

// Update Annual Target for a Company Code
router.patch('/companies/:code/target', async (req, res, next) => {
  try {
    const code = parseInt(req.params.code, 10);
    const { targetPassengers, financialYear } = req.body;

    let company = await Company.findOne({ companyCode: code });
    if (!company) {
      return res.status(404).json({ error: `Company Code #${code} not found` });
    }

    if (!company.annualTarget) {
      company.annualTarget = { targetPassengers: 10000, currentPassengers: 0, financialYear: '2026-2027' };
    }

    if (targetPassengers) company.annualTarget.targetPassengers = Number(targetPassengers);
    if (financialYear) company.annualTarget.financialYear = financialYear;
    await company.save();

    res.json({
      success: true,
      message: `Annual passenger quota for Company Code #${code} updated to ${company.annualTarget.targetPassengers}.`,
      company
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// GLOBAL AGENTS MANAGEMENT (Across all 33 Companies)
// -------------------------------------------------------------
router.get('/agents', async (req, res, next) => {
  try {
    const { companyCode, q, kycStatus } = req.query;
    const filter = { role: ROLES.AGENT };

    if (companyCode) {
      filter.companyCode = parseInt(companyCode, 10);
    }
    if (kycStatus) {
      filter.kycStatus = kycStatus;
    }
    if (q) {
      const regex = new RegExp(q, 'i');
      filter.$or = [
        { name: regex },
        { email: regex },
        { phone: regex },
        { referralCode: regex },
        { agencyName: regex }
      ];
    }

    const agents = await User.find(filter)
      .select('-passwordHash')
      .sort({ createdAt: -1 });

    const agentIds = agents.map(a => a._id);
    const wallets = await Wallet.find({ userId: { $in: agentIds } });

    // Aggregate booking counts per agent
    const bookingCounts = await Booking.aggregate([
      { $match: { referralAgentId: { $in: agentIds } } },
      { $group: { _id: '$referralAgentId', count: { $sum: 1 } } }
    ]);

    const agentsWithDetails = agents.map(agent => {
      const w = wallets.find(wal => wal.userId.toString() === agent._id.toString());
      const bc = bookingCounts.find(b => b._id.toString() === agent._id.toString());
      return {
        ...agent.toObject(),
        availableBalance: w ? w.availableBalance : 0,
        reservedBalance: w ? w.reservedBalance : 0,
        totalBookings: bc ? bc.count : 0
      };
    });

    res.json({ success: true, count: agentsWithDetails.length, agents: agentsWithDetails });
  } catch (err) {
    next(err);
  }
});

// Super Admin Create Agent
router.post('/agents', async (req, res, next) => {
  try {
    const { companyCode, name, email, phone, password, agencyName, initialWalletAmount } = req.body;

    if (!companyCode || !name || !email || !phone || !password) {
      return res.status(400).json({ error: 'Company code, name, email, phone, and password are required' });
    }

    const code = parseInt(companyCode, 10);
    const existing = await User.findOne({
      $or: [{ email: email.toLowerCase().trim() }, { phone: phone.trim() }]
    });
    if (existing) {
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
      agentLevel: 'SILVER',
      kycStatus: 'VERIFIED',
      isActive: true
    });

    const initAmount = Math.max(0, Number(initialWalletAmount) || 0);
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
        referenceId: `ADMIN_INIT_${Date.now()}`,
        description: `Super Admin opening allocation for Agent under Code #${code}`,
        idempotencyKey: `ADMIN_INIT_${agent._id}_${Date.now()}`
      });
    }

    res.status(201).json({
      success: true,
      message: `Agent ${agent.name} created under Company Code #${code} with ₹${initAmount.toLocaleString('en-IN')}.`,
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

// Super Admin Delete / Deactivate Agent
router.delete('/agents/:id', async (req, res, next) => {
  try {
    const agent = await User.findOne({ _id: req.params.id, role: ROLES.AGENT });
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const bookingsCount = await Booking.countDocuments({ referralAgentId: agent._id });
    if (bookingsCount > 0) {
      agent.isActive = false;
      await agent.save();
      return res.json({
        success: true,
        message: `Agent has ${bookingsCount} bookings on record. Account was safely deactivated to preserve audit trails.`,
        deactivated: true
      });
    }

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

// Super Admin Adjust Agent Wallet Balance
router.post('/agents/:id/wallet', async (req, res, next) => {
  try {
    const { amount, note, type = 'CREDIT' } = req.body;
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ error: 'Valid adjustment amount is required' });
    }

    const agent = await User.findOne({ _id: req.params.id, role: ROLES.AGENT });
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    let wallet = await Wallet.findOne({ userId: agent._id });
    if (!wallet) {
      wallet = await Wallet.create({
        userId: agent._id,
        companyCode: agent.companyCode || 1,
        availableBalance: 0,
        reservedBalance: 0
      });
    }

    if (type === 'DEBIT') {
      wallet.availableBalance = Math.max(0, wallet.availableBalance - numAmount);
    } else {
      wallet.availableBalance += numAmount;
    }
    await wallet.save();

    await WalletLedger.create({
      walletId: wallet._id,
      userId: agent._id,
      companyCode: agent.companyCode || 1,
      entryType: type === 'DEBIT' ? 'DEBIT' : 'CREDIT',
      amount: numAmount,
      balanceAfter: wallet.availableBalance,
      transactionType: TRANSACTION_TYPES.ADMIN_ADJUSTMENT,
      referenceType: 'MANUAL_ADJUSTMENT',
      referenceId: `ADJ_${Date.now()}`,
      description: note || `Admin ${type.toLowerCase()} adjustment`,
      idempotencyKey: `ADJ_${agent._id}_${Date.now()}`
    });

    res.json({
      success: true,
      message: `Wallet ${type === 'DEBIT' ? 'debited' : 'credited'} by ₹${numAmount.toLocaleString('en-IN')}. New balance: ₹${wallet.availableBalance.toLocaleString('en-IN')}.`,
      newBalance: wallet.availableBalance
    });
  } catch (err) {
    next(err);
  }
});

// Master Routes Management
router.get('/routes', async (req, res, next) => {
  try {
    const routes = await Route.find().sort({ 'fromCity.name': 1 });
    res.json({ success: true, count: routes.length, routes });
  } catch (err) {
    next(err);
  }
});

router.post('/routes', async (req, res, next) => {
  try {
    const { fromCity, toCity, distanceKm, estimatedDurationHours, baseFare, boardingPoints, droppingPoints } = req.body;
    const route = new Route({
      fromCity,
      toCity,
      distanceKm,
      estimatedDurationHours,
      baseFare,
      boardingPoints: boardingPoints || [{ id: 'bp-main', name: `${fromCity.name} Central Bus Stand`, landmark: 'Opposite Railway Station' }],
      droppingPoints: droppingPoints || [{ id: 'dp-main', name: `${toCity.name} Intercity Terminal`, landmark: 'Ring Road' }]
    });
    await route.save();
    res.status(201).json({ success: true, route });
  } catch (err) {
    next(err);
  }
});

// Master Buses Management & Fleet Compliance
router.get('/buses', async (req, res, next) => {
  try {
    const buses = await Bus.find().sort({ busNumber: 1 });
    res.json({ success: true, count: buses.length, buses });
  } catch (err) {
    next(err);
  }
});

// Master Fleet with 30-Day Paper Expiry Analysis
router.get('/fleet', async (req, res, next) => {
  try {
    const buses = await Bus.find().sort({ companyCode: 1, busNumber: 1 });
    const now = new Date();
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const busesWithCompliance = buses.map(b => {
      const docs = b.documents || {};
      const warnings = [];

      if (docs.rcExpiry && new Date(docs.rcExpiry) <= thirtyDaysFromNow) {
        warnings.push({ doc: 'RC', expiry: docs.rcExpiry, expired: new Date(docs.rcExpiry) < now });
      }
      if (docs.insuranceExpiry && new Date(docs.insuranceExpiry) <= thirtyDaysFromNow) {
        warnings.push({ doc: 'Insurance', expiry: docs.insuranceExpiry, expired: new Date(docs.insuranceExpiry) < now });
      }
      if (docs.fitnessCert && new Date(docs.fitnessCert) <= thirtyDaysFromNow) {
        warnings.push({ doc: 'Fitness Certificate', expiry: docs.fitnessCert, expired: new Date(docs.fitnessCert) < now });
      }
      if (docs.permitExpiry && new Date(docs.permitExpiry) <= thirtyDaysFromNow) {
        warnings.push({ doc: 'Route Permit', expiry: docs.permitExpiry, expired: new Date(docs.permitExpiry) < now });
      }

      return {
        ...b.toObject(),
        complianceWarnings: warnings,
        isCompliant: warnings.length === 0
      };
    });

    res.json({ success: true, count: busesWithCompliance.length, buses: busesWithCompliance });
  } catch (err) {
    next(err);
  }
});

router.post('/buses', async (req, res, next) => {
  try {
    const { busNumber, name, companyCode, busType, amenities, managerContact } = req.body;
    const bus = new Bus({
      busNumber: busNumber.toUpperCase(),
      name,
      companyCode,
      busType: busType || 'AC Seater 2+2',
      amenities: amenities || ['Charging Point', 'WiFi', 'GPS Tracking'],
      managerContact: managerContact || { name: 'Super Fleet Manager', phone: '+91 9999999999' }
    });
    await bus.save();
    res.status(201).json({ success: true, bus });
  } catch (err) {
    next(err);
  }
});

// Schedule Trip
router.post('/trips', async (req, res, next) => {
  try {
    const { routeId, busId, departureTime, arrivalTime, baseFare } = req.body;
    const bus = await Bus.findById(busId);
    if (!bus) return res.status(404).json({ error: 'Bus not found' });

    const seats = Trip.generateDefault40Seats(baseFare);
    const trip = new Trip({
      routeId,
      busId,
      companyCode: bus.companyCode,
      departureTime: new Date(departureTime),
      arrivalTime: new Date(arrivalTime),
      baseFare,
      seats,
      status: 'SCHEDULED'
    });
    await trip.save();

    res.status(201).json({ success: true, trip });
  } catch (err) {
    next(err);
  }
});

// KYC Verification Queue
router.get('/kyc', async (req, res, next) => {
  try {
    const statusFilter = req.query.status || KYC_STATUS.PENDING;
    const documents = await KycDocument.find({ status: statusFilter })
      .populate('userId', 'name email phone role companyCode')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: documents.length, documents });
  } catch (err) {
    next(err);
  }
});

// Approve or Reject KYC
router.patch('/kyc/:id', async (req, res, next) => {
  try {
    const { status, rejectionReason } = req.body;
    if (!['VERIFIED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'Status must be VERIFIED or REJECTED' });
    }

    const doc = await KycDocument.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'KYC Document not found' });

    doc.status = status;
    doc.rejectionReason = status === 'REJECTED' ? rejectionReason : '';
    doc.reviewedBy = req.user._id;
    doc.reviewedAt = new Date();
    await doc.save();

    // Update user's kycStatus
    const user = await User.findById(doc.userId);
    if (user) {
      user.kycStatus = status;
      await user.save();
    }

    res.json({ success: true, message: `KYC document has been marked as ${status}`, doc });
  } catch (err) {
    next(err);
  }
});

// Commission Configuration
router.get('/config/commission', async (req, res, next) => {
  try {
    let tiers = await CommissionTier.find().sort({ level: 1 });
    if (!tiers || tiers.length === 0) {
      tiers = DEFAULT_COMMISSION_TIERS;
    }
    res.json({ success: true, tiers });
  } catch (err) {
    next(err);
  }
});

router.patch('/config/commission', async (req, res, next) => {
  try {
    const { tiers } = req.body; // Array of { level, ratePerSeat, bonusPerSeat, name }
    if (!Array.isArray(tiers)) {
      return res.status(400).json({ error: 'tiers array is required' });
    }

    for (const t of tiers) {
      await CommissionTier.findOneAndUpdate(
        { level: t.level },
        {
          name: t.name,
          ratePerSeat: t.ratePerSeat,
          bonusPerSeat: t.bonusPerSeat || 20,
          isActive: true
        },
        { upsert: true, new: true }
      );
    }

    const updated = await CommissionTier.find().sort({ level: 1 });
    res.json({ success: true, message: 'Commission tiers updated successfully', tiers: updated });
  } catch (err) {
    next(err);
  }
});

// GST & TCS Tax Reports
router.get('/reports/tax', async (req, res, next) => {
  try {
    const confirmedBookings = await Booking.find({ status: 'CONFIRMED' }).sort({ createdAt: -1 });
    const commissionRecords = await CommissionRecord.find({ status: 'CREDITED' }).sort({ createdAt: -1 });

    const totalFareCollected = confirmedBookings.reduce((sum, b) => sum + b.fareBreakdown.subtotal, 0);
    const totalGst5Percent = confirmedBookings.reduce((sum, b) => sum + b.fareBreakdown.gstAmount, 0);
    const totalGrossCommission = commissionRecords.reduce((sum, r) => sum + r.grossCommission, 0);
    const totalTcs1Percent = commissionRecords.reduce((sum, r) => sum + r.tcsDeducted, 0);

    res.json({
      success: true,
      taxSummary: {
        totalFareCollected,
        totalGst5Percent,
        totalGrossCommission,
        totalTcs1Percent,
        netTaxObligation: totalGst5Percent + totalTcs1Percent
      },
      bookingsSample: confirmedBookings.slice(0, 30),
      commissionsSample: commissionRecords.slice(0, 30)
    });
  } catch (err) {
    next(err);
  }
});

// Audit Logs
router.get('/audit-logs', async (req, res, next) => {
  try {
    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, count: logs.length, logs });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
