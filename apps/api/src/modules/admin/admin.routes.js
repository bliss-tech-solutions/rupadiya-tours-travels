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

// Companies List (1-34 Fixed Passenger Ranking) & Owner Assignment
router.get('/companies', async (req, res, next) => {
  try {
    const dbCompanies = await Company.find().populate('ownerId', 'name email phone role isActive');

    // Merge with master 34 company codes to ensure all 1..34 exist with fixed ranks and codes
    const fullList = COMPANY_CODES.map(c => {
      const match = dbCompanies.find(dc => dc.companyCode === c.code || (dc.shortCode && dc.shortCode.toLowerCase() === c.shortCode.toLowerCase()));
      if (match) {
        const obj = match.toObject();
        obj.rank = c.rank;
        obj.shortCode = c.shortCode;
        return obj;
      }
      return {
        companyCode: c.code,
        rank: c.rank,
        shortCode: c.shortCode,
        name: c.defaultName,
        slug: c.slug,
        ownerId: null,
        status: 'UNASSIGNED',
        annualTarget: { targetPassengers: 12000, currentPassengers: 0, financialYear: '2026-2027' }
      };
    });

    // Ensure sorted by fixed rank 1 to 34
    fullList.sort((a, b) => (a.rank || a.companyCode) - (b.rank || b.companyCode));

    res.json({ success: true, count: fullList.length, companies: fullList });
  } catch (err) {
    next(err);
  }
});

// Dynamic Create Company & Owner Workflow (Super Admin)
router.post('/companies/create-with-owner', async (req, res, next) => {
  try {
    const { 
      companyCode, 
      name, 
      address, 
      city, 
      contactPhone, 
      contactEmail,
      ownerName, 
      ownerEmail, 
      ownerPhone, 
      ownerPassword, 
      targetPassengers 
    } = req.body;

    if (!companyCode || !name || !ownerName || !ownerEmail || !ownerPhone || !ownerPassword) {
      return res.status(400).json({ 
        error: 'Company code, company name, owner name, owner email, owner phone, and owner password are required.' 
      });
    }

    let code = companyCode ? parseInt(companyCode, 10) : null;
    if (!code || isNaN(code) || code < 1) {
      const highestComp = await Company.findOne().sort({ companyCode: -1 });
      code = (highestComp?.companyCode || 0) + 1;
    }

    // Check if owner email or phone is already taken
    const existingUser = await User.findOne({
      $or: [{ email: ownerEmail.toLowerCase().trim() }, { phone: ownerPhone.trim() }]
    });
    if (existingUser) {
      return res.status(400).json({ error: 'A user with this owner email or phone number already exists.' });
    }

    // Hash owner password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(ownerPassword, salt);

    // Create Company Owner User
    const owner = await User.create({
      name: ownerName.trim(),
      email: ownerEmail.toLowerCase().trim(),
      phone: ownerPhone.trim(),
      passwordHash,
      role: ROLES.COMPANY_OWNER,
      companyCode: code,
      isActive: true
    });

    // Create or update Company document
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') || `comp-${code}`;
    let company = await Company.findOne({ companyCode: code });
    if (!company) {
      company = new Company({
        companyCode: code,
        name: name.trim(),
        slug,
        address: address ? address.trim() : (city ? `${city.trim()}, Uttar Pradesh` : 'Transport Nagar, Rupadiya'),
        contactPhone: contactPhone ? contactPhone.trim() : ownerPhone.trim(),
        contactEmail: contactEmail ? contactEmail.toLowerCase().trim() : ownerEmail.toLowerCase().trim(),
        ownerId: owner._id,
        status: 'ACTIVE',
        annualTarget: {
          targetPassengers: Number(targetPassengers) || 12000,
          currentPassengers: 0,
          financialYear: '2026-2027'
        }
      });
    } else {
      company.name = name.trim();
      company.slug = slug;
      if (address) company.address = address.trim();
      company.contactPhone = contactPhone ? contactPhone.trim() : ownerPhone.trim();
      company.contactEmail = contactEmail ? contactEmail.toLowerCase().trim() : ownerEmail.toLowerCase().trim();
      company.ownerId = owner._id;
      company.status = 'ACTIVE';
      if (targetPassengers) {
        if (!company.annualTarget) company.annualTarget = {};
        company.annualTarget.targetPassengers = Number(targetPassengers);
      }
    }
    await company.save();

    // Link companyId back on owner
    owner.companyId = company._id;
    await owner.save();

    // Initialize Company Wallet with ₹0 balance
    let companyWallet = await Wallet.findOne({ userId: owner._id });
    if (!companyWallet) {
      companyWallet = await Wallet.create({
        userId: owner._id,
        companyId: company._id,
        companyCode: code,
        ownerType: 'COMPANY',
        availableBalance: 0,
        reservedBalance: 0
      });
    }

    res.status(201).json({
      success: true,
      message: `Company "${company.name}" (#${code}) and Owner "${owner.name}" created successfully.`,
      company: {
        ...company.toObject(),
        owner: {
          id: owner._id,
          name: owner.name,
          email: owner.email,
          phone: owner.phone,
          role: owner.role
        }
      }
    });
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

    owner.companyId = company._id;
    await owner.save();

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

// Helper to resolve company code & spec by either numeric code (1..34) or shortCode ('Ntt', 'Stt', etc.)
function resolveCompanySpec(rawParam) {
  if (!rawParam) return { code: 1, spec: COMPANY_CODES[0] };
  const str = String(rawParam).trim();
  const num = parseInt(str, 10);
  if (!isNaN(num) && num >= 1 && num <= 34) {
    const spec = COMPANY_CODES.find(c => c.code === num);
    return { code: num, spec };
  }
  const spec = COMPANY_CODES.find(c => c.shortCode.toLowerCase() === str.toLowerCase() || c.slug.toLowerCase() === str.toLowerCase());
  if (spec) {
    return { code: spec.code, spec };
  }
  return { code: isNaN(num) ? 1 : num, spec: null };
}

// Get Detailed Profile for a Company Code or ShortCode (Overview, Owner, Fleet, Agents, Stats)
router.get('/companies/:code', async (req, res, next) => {
  try {
    const rawCode = req.params.code;
    const { code, spec } = resolveCompanySpec(rawCode);

    let company = await Company.findOne({
      $or: [
        { companyCode: code },
        { shortCode: new RegExp(`^${rawCode}$`, 'i') }
      ]
    }).populate('ownerId', 'name email phone role isActive createdAt');

    if (!company) {
      company = {
        companyCode: code,
        rank: spec ? spec.rank : code,
        shortCode: spec ? spec.shortCode : `C${code}`,
        name: spec ? spec.defaultName : `Company #${String(code).padStart(2, '0')}`,
        slug: spec ? spec.slug : `comp-${code}`,
        ownerId: null,
        status: 'UNASSIGNED',
        annualTarget: { targetPassengers: 12000, currentPassengers: 0, financialYear: '2026-2027' }
      };
    } else {
      // Ensure fixed rank and shortCode are always synchronized
      if (spec) {
        company.rank = spec.rank;
        company.shortCode = spec.shortCode;
      }
    }

    const buses = await Bus.find({ companyCode: code }).sort({ createdAt: -1 });
    const agents = await User.find({ companyCode: code, role: ROLES.AGENT }).select('-passwordHash').sort({ createdAt: -1 });
    const agentIds = agents.map(a => a._id);
    const wallets = await Wallet.find({ userId: { $in: agentIds } });
    const walletMap = new Map(wallets.map(w => [String(w.userId), w]));

    const enrichedAgents = agents.map(a => ({
      ...a.toObject(),
      wallet: walletMap.get(String(a._id)) || { balance: 0, availableBalance: 0 }
    }));

    const confirmedBookings = await Booking.find({ companyCode: code, status: 'CONFIRMED' });
    const totalGMV = confirmedBookings.reduce((sum, b) => sum + (b.fareBreakdown?.totalPayable || 0), 0);
    const totalPassengers = confirmedBookings.reduce((sum, b) => sum + (b.seatNumbers?.length || 0), 0);

    res.json({
      success: true,
      company,
      owner: company.ownerId || null,
      buses,
      agents: enrichedAgents,
      stats: {
        totalBuses: buses.length,
        totalAgents: agents.length,
        totalPassengers,
        totalGMV,
        targetPassengers: company.annualTarget?.targetPassengers || 12000,
        progressPercent: Math.min(100, Math.round((totalPassengers / (company.annualTarget?.targetPassengers || 12000)) * 100))
      }
    });
  } catch (err) {
    next(err);
  }
});

// Update Company Details (Super Admin) - Code, Rank, and ShortCode remain fixed as per Master Ranking!
router.put('/companies/:code', async (req, res, next) => {
  try {
    const rawCode = req.params.code;
    const { code, spec } = resolveCompanySpec(rawCode);

    const {
      name,
      contactPhone,
      contactEmail,
      address,
      city,
      state,
      status,
      targetPassengers,
      financialYear
    } = req.body;

    let company = await Company.findOne({
      $or: [
        { companyCode: code },
        { shortCode: new RegExp(`^${rawCode}$`, 'i') }
      ]
    });

    if (!company) {
      company = new Company({
        companyCode: code,
        rank: spec ? spec.rank : code,
        shortCode: spec ? spec.shortCode : `C${code}`,
        name: name ? name.trim() : (spec ? spec.defaultName : `Company #${code}`),
        slug: spec ? spec.slug : `comp-${code}`,
        status: status || 'ACTIVE',
        annualTarget: {
          targetPassengers: Number(targetPassengers) || 12000,
          currentPassengers: 0,
          financialYear: financialYear || '2026-2027'
        }
      });
    }

    // Fixed & immutable hierarchy from Passenger Ranking
    if (spec) {
      company.rank = spec.rank;
      company.shortCode = spec.shortCode;
      company.companyCode = spec.code;
    }

    // Editable fields
    if (name && name.trim()) company.name = name.trim();
    if (contactPhone !== undefined) company.contactPhone = contactPhone.trim();
    if (contactEmail !== undefined) company.contactEmail = contactEmail.trim().toLowerCase();
    if (address !== undefined) company.address = address.trim();
    if (city !== undefined) company.city = city.trim();
    if (state !== undefined) company.state = state.trim();
    if (status && ['ACTIVE', 'SUSPENDED'].includes(status)) company.status = status;

    if (targetPassengers !== undefined) {
      if (!company.annualTarget) company.annualTarget = {};
      company.annualTarget.targetPassengers = Number(targetPassengers);
    }
    if (financialYear) {
      if (!company.annualTarget) company.annualTarget = {};
      company.annualTarget.financialYear = financialYear;
    }

    await company.save();

    res.json({
      success: true,
      message: `Franchise company "${company.name}" (Rank #${company.rank} · Code: ${company.shortCode}) updated successfully.`,
      company
    });
  } catch (err) {
    next(err);
  }
});

// Alias PATCH to PUT for flexible frontend support
router.patch('/companies/:code', async (req, res, next) => {
  return router.handle({ ...req, method: 'PUT' }, res, next);
});

// -------------------------------------------------------------
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

// Super Admin Create Agent (with companyId resolution & referral hierarchy)
router.post('/agents', async (req, res, next) => {
  try {
    const { 
      companyCode, 
      name, 
      email, 
      phone, 
      password, 
      agencyName, 
      sponsorReferralCode, 
      initialWalletAmount, 
      aadharNumber, 
      panNumber, 
      bankDetails 
    } = req.body;

    if (!companyCode || !name || !email || !phone || !password) {
      return res.status(400).json({ error: 'Company code, name, email, phone, and password are required' });
    }

    const code = parseInt(companyCode, 10);
    const company = await Company.findOne({ companyCode: code });
    if (!company) {
      return res.status(404).json({ error: `Company Code #${code} not found.` });
    }

    const existing = await User.findOne({
      $or: [{ email: email.toLowerCase().trim() }, { phone: phone.trim() }]
    });
    if (existing) {
      return res.status(400).json({ error: 'User with this email or phone already exists' });
    }

    // Resolve sponsor referral hierarchy (5-level tree)
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
      companyId: company._id,
      companyCode: code,
      referredBy: sponsor ? sponsor._id : null,
      referralCode,
      agencyName: agencyName ? agencyName.trim() : `${name.trim()} Agency`,
      aadharNumber: aadharNumber ? aadharNumber.trim() : '',
      panNumber: panNumber ? panNumber.toUpperCase().trim() : '',
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
      kycStatus: (aadharNumber || panNumber) ? 'VERIFIED' : 'PENDING',
      isActive: true
    });

    const initAmount = Math.max(0, Number(initialWalletAmount) || 0);
    const wallet = await Wallet.create({
      userId: agent._id,
      companyId: company._id,
      companyCode: code,
      ownerType: 'AGENT',
      availableBalance: initAmount,
      reservedBalance: 0
    });

    if (initAmount > 0) {
      await WalletLedger.create({
        walletId: wallet._id,
        userId: agent._id,
        companyId: company._id,
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
      message: `Agent ${agent.name} created under Company Code #${code} (${company.name}) with ₹${initAmount.toLocaleString('en-IN')}.`,
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

// Super Admin Get Single Agent Detailed Profile
router.get('/agents/:id', async (req, res, next) => {
  try {
    const agent = await User.findOne({ _id: req.params.id, role: ROLES.AGENT }).select('-passwordHash').populate('referredBy', 'name email phone referralCode');
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const wallet = await Wallet.findOne({ userId: agent._id }) || { balance: 0, availableBalance: 0, reservedBalance: 0, isActive: true };
    const ledger = await WalletLedger.find({ userId: agent._id }).sort({ createdAt: -1 }).limit(30);
    const kycDocuments = await KycDocument.find({ userId: agent._id }).sort({ createdAt: -1 });
    const bookings = await Booking.find({ referralAgentId: agent._id }).sort({ createdAt: -1 }).limit(30);

    const company = await Company.findOne({ companyCode: agent.companyCode }) || { name: `Company #${String(agent.companyCode).padStart(2, '0')}`, companyCode: agent.companyCode };

    const totalTickets = await Booking.countDocuments({ referralAgentId: agent._id, status: 'CONFIRMED' });
    const totalGMV = bookings.reduce((sum, b) => sum + (b.fareBreakdown?.totalPayable || 0), 0);

    res.json({
      success: true,
      agent,
      wallet,
      ledger,
      kycDocuments,
      bookings,
      company,
      stats: {
        totalTickets,
        totalGMV
      }
    });
  } catch (err) {
    next(err);
  }
});

// Super Admin Toggle Agent Status (Active / Suspended)
router.patch('/agents/:id/status', async (req, res, next) => {
  try {
    const { isActive } = req.body;
    const agent = await User.findOne({ _id: req.params.id, role: ROLES.AGENT });
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    agent.isActive = Boolean(isActive);
    await agent.save();

    res.json({ success: true, message: `Agent status updated to ${agent.isActive ? 'ACTIVE' : 'SUSPENDED'}`, isActive: agent.isActive });
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

// Create New Bus (POST /admin/fleet or POST /admin/buses)
const handleCreateBus = async (req, res, next) => {
  try {
    const { 
      busNumber, 
      name, 
      operatorName,
      companyCode, 
      busType, 
      driverDetails,
      amenities, 
      images,
      documents
    } = req.body;

    if (!busNumber || !name || !companyCode) {
      return res.status(400).json({ error: 'Bus plate number, name, and company code are required' });
    }

    const cleanPlate = busNumber.trim().toUpperCase();
    const existing = await Bus.findOne({ busNumber: cleanPlate });
    if (existing) {
      return res.status(400).json({ error: `Bus with registration plate ${cleanPlate} is already inducted in the fleet` });
    }

    const typeStr = busType || 'AC Sleeper (2+1)';
    const isSleeper = typeStr.toLowerCase().includes('sleeper');
    const isAc = !typeStr.toLowerCase().includes('non-ac');

    const bus = new Bus({
      busNumber: cleanPlate,
      name: name.trim(),
      operatorName: operatorName ? operatorName.trim() : 'Rupadiya Intercity Travels',
      companyCode: Number(companyCode),
      busType: typeStr,
      category: isSleeper ? 'SLEEPER' : 'SEATER',
      layoutType: isSleeper ? '2+1' : '2+2',
      totalSeats: isSleeper ? 36 : 40,
      isAc,
      amenities: amenities && amenities.length > 0 ? amenities : [
        'Charging Point', 'Reading Light', 'GPS Tracking', 'First Aid Box'
      ],
      driverDetails: driverDetails ? {
        name: driverDetails.name?.trim() || 'Assigned Pilot',
        phone: driverDetails.phone?.trim() || '+91 9876500000',
        licenseNumber: driverDetails.licenseNumber?.trim() || 'DL-UP40-VALID',
        alternatePhone: driverDetails.alternatePhone?.trim() || ''
      } : {
        name: 'Assigned Pilot',
        phone: '+91 9876500000',
        licenseNumber: 'DL-UP40-VALID'
      },
      managerContact: {
        name: driverDetails?.name?.trim() || 'Fleet Supervisor',
        phone: driverDetails?.phone?.trim() || '+91 9876500000'
      },
      documents: documents || {
        rcNumber: `RC-${cleanPlate}`,
        insurancePolicy: 'INS-NATIONAL-2026',
        rcExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        insuranceExpiry: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        fitnessCert: new Date(Date.now() + 240 * 24 * 60 * 60 * 1000),
        permitExpiry: new Date(Date.now() + 300 * 24 * 60 * 60 * 1000)
      },
      images: images && images.length > 0 ? images : [
        'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=800&auto=format&fit=crop&q=80'
      ],
      status: 'ACTIVE'
    });

    await bus.save();
    res.status(201).json({
      success: true,
      message: `Coach ${cleanPlate} (${isSleeper ? '36 Berths' : '40 Seats'}) inducted into Company #${companyCode} fleet.`,
      bus
    });
  } catch (err) {
    next(err);
  }
};

router.post('/buses', handleCreateBus);
router.post('/fleet', handleCreateBus);

// Update Coach & Driver Details (PUT /admin/fleet/:id)
router.put('/fleet/:id', async (req, res, next) => {
  try {
    const bus = await Bus.findById(req.params.id);
    if (!bus) return res.status(404).json({ error: 'Bus not found in fleet records' });

    const { 
      name, 
      operatorName, 
      busType, 
      companyCode,
      driverDetails, 
      amenities, 
      status, 
      images,
      documents 
    } = req.body;

    if (name) bus.name = name.trim();
    if (operatorName) bus.operatorName = operatorName.trim();
    if (companyCode) bus.companyCode = Number(companyCode);
    if (status) bus.status = status;
    if (amenities) bus.amenities = amenities;
    if (images) bus.images = images;
    if (documents) bus.documents = { ...bus.documents, ...documents };

    if (busType) {
      bus.busType = busType;
      const isSleeper = busType.toLowerCase().includes('sleeper');
      bus.category = isSleeper ? 'SLEEPER' : 'SEATER';
      bus.layoutType = isSleeper ? '2+1' : '2+2';
      bus.totalSeats = isSleeper ? 36 : 40;
      bus.isAc = !busType.toLowerCase().includes('non-ac');
    }

    if (driverDetails) {
      bus.driverDetails = {
        name: driverDetails.name || bus.driverDetails?.name || '',
        phone: driverDetails.phone || bus.driverDetails?.phone || '',
        licenseNumber: driverDetails.licenseNumber || bus.driverDetails?.licenseNumber || '',
        alternatePhone: driverDetails.alternatePhone !== undefined ? driverDetails.alternatePhone : (bus.driverDetails?.alternatePhone || '')
      };
      if (driverDetails.name) bus.managerContact.name = driverDetails.name;
      if (driverDetails.phone) bus.managerContact.phone = driverDetails.phone;
    }

    await bus.save();
    res.json({ success: true, message: `Coach ${bus.busNumber} updated successfully`, bus });
  } catch (err) {
    next(err);
  }
});

// Decommission / Delete Bus (DELETE /admin/fleet/:id)
router.delete('/fleet/:id', async (req, res, next) => {
  try {
    const bus = await Bus.findById(req.params.id);
    if (!bus) return res.status(404).json({ error: 'Bus not found in fleet registry' });

    await Bus.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: `Coach ${bus.busNumber} decommissioned from fleet registry` });
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

// Master Platform Bookings with Insurance Breakdown
router.get('/bookings', async (req, res, next) => {
  try {
    const { companyCode, status, q } = req.query;
    const filter = {};
    if (companyCode) filter.companyCode = Number(companyCode);
    if (status) filter.status = status;

    const bookings = await Booking.find(filter)
      .populate('passengerId', 'name email phone')
      .populate('referralAgentId', 'name email phone referralCode agencyName')
      .populate('busId', 'name busNumber busType operatorName')
      .populate('routeId', 'fromCity toCity')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({
      success: true,
      count: bookings.length,
      bookings: bookings.map(b => ({
        id: b.bookingId || b.pnr,
        pnr: b.pnr,
        bookingId: b.bookingId,
        companyCode: b.companyCode,
        passenger: b.contactDetails?.phone ? `${b.passengers?.[0]?.name || 'Traveler'} (${b.contactDetails.phone})` : (b.passengers?.[0]?.name || 'Traveler'),
        corridor: b.routeId ? `${b.routeId.fromCity?.name} → ${b.routeId.toCity?.name}` : 'Rupadiya Corridor',
        bus: b.busId ? `${b.busId.busNumber} (${b.busId.busType})` : 'Rupadiya Intercity Bus',
        operatorName: b.busId?.operatorName || 'Rupadiya Intercity Travels',
        seats: b.seatNumbers?.join(', ') || '1',
        seatCount: b.seatNumbers?.length || 1,
        amount: b.fareBreakdown?.totalPayable || b.totalAmount || 0,
        fareBreakdown: b.fareBreakdown || {},
        insuranceOpted: b.insuranceOpted || (b.fareBreakdown?.insuranceAmount > 0) || false,
        insurancePremium: b.insurancePremium || b.fareBreakdown?.insuranceAmount || 0,
        paymentMethod: b.paymentProvider === 'razorpay' ? 'Razorpay Gateway' : (b.referralAgentId ? `Agent Wallet (${b.referralAgentId.referralCode || 'AGT'})` : b.paymentProvider),
        paymentReference: b.paymentReference,
        status: b.status,
        date: b.createdAt ? new Date(b.createdAt).toISOString() : new Date().toISOString()
      }))
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
