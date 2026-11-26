const express = require('express');
const notificationService = require('../notifications/notification.service');
const { render: renderTemplate } = require('../notifications/notification.service');
const { NotificationJob, MessageTemplate, PlatformSetting } = require('../notifications/models');
const settlementService = require('../settlements/settlement.service');
const { presetPeriod } = require('../settlements/settlement.service');
const CompanySettlement = require('../settlements/companySettlement.model');
const reconciliationService = require('../finance/reconciliation.service');
const payoutService = require('../withdrawals/payout.service');
const { recordAudit } = require('../../services/audit.service');
const walletLedger = require('../../services/walletLedger.service');
const refundService = require('../payments/refund.service');
const router = express.Router();
const { authenticateToken } = require('../../middleware/auth.middleware');
const { authorizeRoles, requirePrimaryAdmin, isPrimaryAdmin } = require('../../middleware/rbac.middleware');
const RefreshToken = require('../auth/refreshToken.model');
const Company = require('../companies/company.model');
const Bus = require('../fleet/bus.model');
const Route = require('../routes/route.model');
const Trip = require('../trips/trip.model');
const Booking = require('../bookings/booking.model');
const Refund = require('../payments/refund.model');
const Payment = require('../payments/payment.model');
const paymentService = require('../payments/payment.service');
const User = require('../users/user.model');
const KycDocument = require('../kyc/kyc.model');
const { Wallet, WalletLedger } = require('../wallets/wallet.model');
const { CommissionTier, CommissionRecord } = require('../commissions/commission.model');
const AuditLog = require('../audit/audit.model');
const bcrypt = require('bcryptjs');
const { ROLES, KYC_STATUS, COMPANY_CODES, DEFAULT_COMMISSION_TIERS, TRANSACTION_TYPES, PAYMENT_STATUS, REFUND_STATUS, WITHDRAWAL_STATUS } = require('../../config/constants');
const { normalisePhone, formatPhone, PHONE_ERROR } = require('../../utils/phone');

router.use(authenticateToken);
router.use(authorizeRoles(ROLES.SUPER_ADMIN));

// Master Global Dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalAgents = await User.countDocuments({ role: ROLES.AGENT });
    const totalBuses = await Bus.countDocuments({ status: 'ACTIVE' });
    const totalTrips = await Trip.countDocuments();
    const [bookingAgg] = await Booking.aggregate([
      { $match: { status: 'CONFIRMED' } },
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          totalSeatsBooked: { $sum: { $size: { $ifNull: ['$seatNumbers', []] } } },
          totalGMV: { $sum: { $ifNull: ['$fareBreakdown.totalPayable', 0] } },
          totalGSTCollected: { $sum: { $ifNull: ['$fareBreakdown.gstAmount', 0] } }
        }
      }
    ]);

    const totalBookings = bookingAgg ? bookingAgg.totalBookings : 0;
    const totalSeatsBooked = bookingAgg ? bookingAgg.totalSeatsBooked : 0;
    const totalGMV = bookingAgg ? bookingAgg.totalGMV : 0;
    const totalGSTCollected = bookingAgg ? bookingAgg.totalGSTCollected : 0;

    const pendingKycCount = await KycDocument.countDocuments({ status: KYC_STATUS.PENDING });
    const [refundAgg] = await Refund.aggregate([
      { $match: { status: REFUND_STATUS.PENDING } },
      {
        $group: {
          _id: null,
          pendingRefundsCount: { $sum: 1 },
          pendingRefundsAmount: { $sum: { $ifNull: ['$refundAmount', 0] } }
        }
      }
    ]);

    const pendingRefundsCount = refundAgg ? refundAgg.pendingRefundsCount : 0;
    const pendingRefundsAmount = refundAgg ? refundAgg.pendingRefundsAmount : 0;

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalAgents,
        totalBuses,
        totalTrips,
        totalBookings,
        totalSeatsBooked,
        totalGMV,
        totalGSTCollected,
        pendingKycCount,
        pendingRefundsCount,
        pendingRefundsAmount
      }
    });
  } catch (err) {
    next(err);
  }
});

// Companies List & Owner Assignment (Dynamic & Flexible)
router.get('/companies', async (req, res, next) => {
  try {
    const dbCompanies = await Company.find().populate('ownerId', 'name email phone role isActive');

    // Merge with master company codes
    const fullList = COMPANY_CODES.map(c => {
      const match = dbCompanies.find(dc => dc.companyCode === c.code || (dc.shortCode && dc.shortCode.toLowerCase() === c.shortCode.toLowerCase()));
      if (match) {
        const obj = match.toObject();
        obj.rank = c.rank;
        obj.shortCode = obj.shortCode || c.shortCode;
        if (obj.shareCapital == null || obj.shareCapital === 0) obj.shareCapital = c.shareCapital || 0;
        return obj;
      }
      return {
        companyCode: c.code,
        rank: c.rank,
        shortCode: c.shortCode,
        name: c.defaultName,
        shareCapital: c.shareCapital || 0,
        slug: c.slug,
        ownerId: null,
        status: 'UNASSIGNED',
        annualTarget: { targetPassengers: 12000, currentPassengers: 0, financialYear: '2026-2027' }
      };
    });

    // Also include any dynamic companies in DB that are outside predefined codes
    const existingCodes = new Set(fullList.map(c => c.companyCode));
    for (const dc of dbCompanies) {
      if (!existingCodes.has(dc.companyCode)) {
        fullList.push(dc.toObject());
      }
    }

    fullList.sort((a, b) => (a.companyCode || a.rank) - (b.companyCode || b.rank));

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
      ownerPhone: rawOwnerPhone,
      ownerPassword, 
      targetPassengers 
    } = req.body;
    const ownerPhone = rawOwnerPhone ? normalisePhone(rawOwnerPhone) : '';
    if (rawOwnerPhone && !ownerPhone) return res.status(400).json({ error: `Owner phone: ${PHONE_ERROR}` });

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
  if (!isNaN(num) && num >= 1) {
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
      shortCode: newShortCode,
      shareCapital,
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
    if (newShortCode && newShortCode.trim()) company.shortCode = newShortCode.trim().toUpperCase();
    if (shareCapital !== undefined) company.shareCapital = Number(shareCapital) || 0;
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
      phone: rawPhone,
      password, 
      agencyName, 
      sponsorReferralCode, 
      initialWalletAmount, 
      aadharNumber, 
      panNumber, 
      bankDetails 
    } = req.body;
    const phone = rawPhone ? normalisePhone(rawPhone) : '';
    if (rawPhone && !phone) return res.status(400).json({ error: PHONE_ERROR });

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

// Super Admin Adjust Agent Wallet Balance (audited, ledger-backed, overdraft-proof)
router.post('/agents/:id/wallet', async (req, res, next) => {
  try {
    const { amount, note, type = 'CREDIT' } = req.body || {};
    const numAmount = Math.round(Number(amount) * 100) / 100;
    const reason = String(note || '').trim();
    if (!numAmount || numAmount <= 0 || numAmount > 1000000) {
      return res.status(400).json({ error: 'Valid adjustment amount is required' });
    }
    if (reason.length < 5) {
      return res.status(400).json({ error: 'A reason (min 5 characters) is required for every manual adjustment.' });
    }
    if (!['CREDIT', 'DEBIT'].includes(type)) {
      return res.status(400).json({ error: 'type must be CREDIT or DEBIT' });
    }

    const agent = await User.findOne({ _id: req.params.id, role: ROLES.AGENT });
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const adjId = `ADJ_${Date.now()}_${require('crypto').randomBytes(3).toString('hex').toUpperCase()}`;
    const params = {
      userId: agent._id,
      amount: numAmount,
      companyCode: agent.companyCode || null,
      transactionType: TRANSACTION_TYPES.ADMIN_ADJUSTMENT,
      referenceType: 'ADMIN_ADJUSTMENT',
      referenceId: adjId,
      description: `Admin ${type.toLowerCase()}: ${reason.slice(0, 200)}`,
      idempotencyKey: adjId
    };
    const result = type === 'DEBIT' ? await walletLedger.debit(params) : await walletLedger.credit(params);

    await recordAudit(req, {
      action: `SUPER_ADMIN_WALLET_${type}`,
      resource: 'WALLET',
      resourceId: agent._id,
      companyCode: agent.companyCode || null,
      details: { amount: numAmount, reason, adjustmentId: adjId, balanceAfter: result.wallet?.availableBalance }
    });

    res.json({
      success: true,
      message: `Wallet ${type === 'DEBIT' ? 'debited' : 'credited'} by ₹${numAmount.toLocaleString('en-IN')}. New balance: ₹${result.wallet.availableBalance.toLocaleString('en-IN')}.`,
      newBalance: result.wallet.availableBalance
    });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
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

// ==========================================
// Refunds & Returns Desk (Super Admin Exclusive)
// ==========================================

router.get('/refunds', async (req, res, next) => {
  try {
    const { status, companyCode, search, page = 1, limit = 50 } = req.query;

    const filter = {};
    if (status && status !== 'ALL') {
      filter.status = status.toUpperCase();
    }
    if (companyCode) {
      filter.companyCode = Number(companyCode);
    }
    if (search && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { pnr: { $regex: q, $options: 'i' } },
        { refundId: { $regex: q, $options: 'i' } },
        { customerName: { $regex: q, $options: 'i' } },
        { customerPhone: { $regex: q, $options: 'i' } }
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [refunds, totalCount] = await Promise.all([
      Refund.find(filter)
        .populate('processedBy', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Refund.countDocuments(filter)
    ]);

    // Summary metrics across collection
    const allPending = await Refund.find({ status: REFUND_STATUS.PENDING });
    const allProcessed = await Refund.find({ status: REFUND_STATUS.PROCESSED });
    const allRefunds = await Refund.find();

    const pendingCount = allPending.length;
    const pendingAmount = allPending.reduce((sum, r) => sum + (r.refundAmount || 0), 0);
    const processedCount = allProcessed.length;
    const processedAmount = allProcessed.reduce((sum, r) => sum + (r.refundAmount || 0), 0);
    const retainedOperatorFees = allRefunds.reduce((sum, r) => sum + (r.cancellationFee || 0), 0);

    res.json({
      success: true,
      refunds,
      pagination: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum) || 1
      },
      stats: {
        pendingCount,
        pendingAmount,
        processedCount,
        processedAmount,
        retainedOperatorFees
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/refunds/:id/process', async (req, res, next) => {
  try {
    const { mode = 'GATEWAY', utrNumber, notes } = req.body || {};
    const refund = await refundService.processRefundRecord(req.params.id, {
      mode: mode === 'GATEWAY' ? 'GATEWAY' : 'MANUAL_BANK_TRANSFER',
      actorId: req.user._id,
      utrNumber,
      notes
    });

    await recordAudit(req, {
      action: 'SUPER_ADMIN_REFUND_PROCESSED',
      resource: 'REFUND',
      resourceId: refund._id,
      companyCode: refund.companyCode,
      details: {
        refundId: refund.refundId,
        pnr: refund.pnr,
        amount: refund.refundAmount,
        mode,
        gatewayRefundId: refund.gatewayRefundId,
        utrNumber: refund.utrNumber
      }
    });

    res.json({
      success: true,
      message: `Refund of ₹${refund.refundAmount} for PNR ${refund.pnr} processed.`,
      refund
    });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

router.post('/refunds/:id/reject', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'A valid reason is required to reject a refund request.' });
    }

    const refund = await Refund.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { refundId: id }]
    });

    if (!refund) {
      return res.status(404).json({ error: 'Refund record not found.' });
    }

    if ([REFUND_STATUS.PROCESSED, REFUND_STATUS.PROCESSING].includes(refund.status)) {
      return res.status(400).json({ error: `Cannot reject a refund that is ${refund.status.toLowerCase()}.` });
    }

    refund.status = REFUND_STATUS.REJECTED;
    refund.rejectionReason = reason.trim();
    refund.processedAt = new Date();
    refund.processedBy = req.user._id;
    await refund.save();

    res.json({
      success: true,
      message: `Refund request for PNR #${refund.pnr} has been marked as rejected.`,
      refund
    });
  } catch (err) {
    next(err);
  }
});


// -------------------------------------------------------------
// FINANCE: Razorpay ↔ ledger reconciliation and payout sync (super admin)
// -------------------------------------------------------------
router.get('/finance/reconciliation', async (req, res, next) => {
  try {
    res.json({ success: true, ...(await reconciliationService.overview()) });
  } catch (err) {
    next(err);
  }
});

router.post('/finance/reconciliation/run', async (req, res, next) => {
  try {
    const run = await reconciliationService.run({
      days: Number(req.body?.days) || 2,
      autoHeal: req.body?.autoHeal !== false,
      trigger: 'MANUAL',
      actorId: req.user._id
    });
    await recordAudit(req, {
      action: 'FINANCE_RECONCILIATION_RUN',
      resource: 'RECONCILIATION',
      resourceId: run._id,
      details: { status: run.status, issues: run.counts?.issues, healed: run.counts?.healed }
    });
    res.json({ success: run.status === 'COMPLETED', run, error: run.error || undefined });
  } catch (err) {
    next(err);
  }
});

// Re-check every in-flight RazorpayX payout right now (normally done every 10 minutes)
router.post('/finance/payouts/sync', async (req, res, next) => {
  try {
    const result = await payoutService.sweep({ olderThanMs: 0, limit: 200 });
    res.json({ success: true, message: `Checked ${result.checked} in-flight payout(s).`, ...result });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// AGENT WITHDRAWALS — RBS admin pays requests the companies have approved.
// ---------------------------------------------------------------------------
const WithdrawalRequest = require('../withdrawals/withdrawal.model');

// RazorpayX balance / mode for the admin pay dialog
router.get('/withdrawals/payout-config', async (req, res, next) => {
  try {
    res.json({ success: true, ...(await payoutService.getAdminConfig()) });
  } catch (err) {
    next(err);
  }
});

// List withdrawals across all companies. ?status=AWAITING|PROCESSING|PAYOUT_FAILED|APPROVED|REJECTED|all  ?companyCode=
router.get('/withdrawals', async (req, res, next) => {
  try {
    const status = String(req.query.status || 'AWAITING');
    const q = {};
    if (req.query.companyCode) q.companyCode = Number(req.query.companyCode);
    if (status === 'AWAITING') { q.status = WITHDRAWAL_STATUS.PROCESSING; q.processingStage = 'AWAITING_ADMIN_PAYMENT'; }
    else if (status === 'DISBURSING') { q.status = WITHDRAWAL_STATUS.PROCESSING; q.processingStage = 'DISBURSING'; }
    else if (status !== 'all') q.status = status;

    const withdrawals = await WithdrawalRequest.find(q)
      .populate('agentId', 'name email phone referralCode kycStatus bankDetails agencyName')
      .sort({ 'approvals.company.at': -1, createdAt: -1 })
      .limit(500)
      .lean();

    const codes = [...new Set(withdrawals.map((w) => w.companyCode))];
    const companies = await Company.find({ companyCode: { $in: codes } }).select('companyCode name').lean();
    const nameByCode = new Map(companies.map((c) => [c.companyCode, c.name]));
    withdrawals.forEach((w) => { w.companyName = nameByCode.get(w.companyCode) || `Company #${w.companyCode}`; });

    const [awaitingAll] = await Promise.all([
      WithdrawalRequest.aggregate([
        { $match: { status: WITHDRAWAL_STATUS.PROCESSING, processingStage: 'AWAITING_ADMIN_PAYMENT' } },
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amount' } } }
      ])
    ]);
    res.json({
      success: true,
      withdrawals,
      stats: { awaitingCount: awaitingAll[0]?.count || 0, awaitingAmount: awaitingAll[0]?.amount || 0 }
    });
  } catch (err) {
    next(err);
  }
});

// Pay a company-approved withdrawal: { mode: 'online' | 'manual', utrNumber? }
router.post('/withdrawals/:id/pay', async (req, res, next) => {
  try {
    const mode = req.body?.mode === 'manual' ? 'manual' : 'online';
    const w = await payoutService.adminPay({
      withdrawalId: req.params.id,
      actorId: req.user._id,
      mode,
      utrNumber: req.body?.utrNumber,
      notes: req.body?.notes
    });
    await recordAudit(req, { action: 'WITHDRAWAL_PAID', resource: 'WITHDRAWAL', resourceId: w._id, details: { mode, amount: w.amount, status: w.status, utr: w.utrNumber } });
    const amt = `₹${Number(w.amount).toLocaleString('en-IN')}`;
    const failed = w.status === WITHDRAWAL_STATUS.PAYOUT_FAILED;
    const msg = failed
      ? `Payout of ${amt} failed: ${w.payout?.failureReason || 'unknown reason'}. The company wallet was refunded — retry or reject.`
      : w.status === WITHDRAWAL_STATUS.APPROVED
        ? `${amt} paid to the agent${w.utrNumber ? ` (Ref ${w.utrNumber})` : ''}.`
        : `${amt} payout initiated via RazorpayX. The agent will be credited shortly.`;
    res.json({ success: !failed, message: failed ? undefined : msg, error: failed ? msg : undefined, withdrawal: w });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
});

// Reject a company-approved (not yet paid) or failed withdrawal: refunds agent + company wallet.
router.post('/withdrawals/:id/reject', async (req, res, next) => {
  try {
    const w = await payoutService.reject({ withdrawalId: req.params.id, actorId: req.user._id, reason: req.body?.reason, byAdmin: true });
    await recordAudit(req, { action: 'WITHDRAWAL_REJECTED', resource: 'WITHDRAWAL', resourceId: w._id, details: { amount: w.amount, reason: w.rejectionReason } });
    res.json({ success: true, message: 'Withdrawal rejected. The agent and company wallets were refunded.', withdrawal: w });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
});


// -------------------------------------------------------------
// ADMIN ACCOUNTS (primary super admin only)
// -------------------------------------------------------------
const ADMIN_PUBLIC_FIELDS = 'name email phone role adminLevel isActive createdAt lastLoginAt';

router.get('/admins', requirePrimaryAdmin, async (req, res, next) => {
  try {
    const admins = await User.find({ role: ROLES.SUPER_ADMIN }).select(ADMIN_PUBLIC_FIELDS).sort({ createdAt: 1 }).lean();
    res.json({ success: true, admins });
  } catch (err) {
    next(err);
  }
});

router.post('/admins', requirePrimaryAdmin, async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const phone = normalisePhone(req.body?.phone, req.body?.countryCode);
    const password = String(req.body?.password || '');

    if (name.length < 2) return res.status(400).json({ error: 'Name is required.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'A valid email is required.' });
    if (!phone) return res.status(400).json({ error: PHONE_ERROR });
    if (password.length < 10 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      return res.status(400).json({ error: 'Password must be at least 10 characters with upper case, lower case and a number.' });
    }
    if (await User.exists({ email })) return res.status(409).json({ error: 'An account with this email already exists.' });

    const admin = await User.create({
      name,
      email,
      phone,
      passwordHash: await bcrypt.hash(password, 12),
      role: ROLES.SUPER_ADMIN,
      adminLevel: 'STANDARD',
      isActive: true
    });
    await recordAudit(req, { action: 'ADMIN_ACCOUNT_CREATED', resource: 'USER', resourceId: admin._id, details: { email } });
    res.status(201).json({ success: true, message: `Super admin ${email} created.`, admin: { _id: admin._id, name, email, phone, adminLevel: 'STANDARD', isActive: true } });
  } catch (err) {
    next(err);
  }
});

// Enable / disable a standard admin, or reset its password. The primary account cannot be changed here.
router.patch('/admins/:id', requirePrimaryAdmin, async (req, res, next) => {
  try {
    const target = await User.findOne({ _id: req.params.id, role: ROLES.SUPER_ADMIN });
    if (!target) return res.status(404).json({ error: 'Admin not found.' });
    if (target.adminLevel === 'PRIMARY') {
      return res.status(400).json({ error: 'The primary super admin account cannot be disabled or changed from here.' });
    }

    const changes = {};
    if (typeof req.body?.isActive === 'boolean') changes.isActive = req.body.isActive;
    if (req.body?.password) {
      const pw = String(req.body.password);
      if (pw.length < 10 || !/[A-Z]/.test(pw) || !/[a-z]/.test(pw) || !/\d/.test(pw)) {
        return res.status(400).json({ error: 'Password must be at least 10 characters with upper case, lower case and a number.' });
      }
      changes.passwordHash = await bcrypt.hash(pw, 12);
    }
    if (!Object.keys(changes).length) return res.status(400).json({ error: 'Nothing to update.' });

    await User.updateOne({ _id: target._id }, { $set: changes });
    if (changes.isActive === false || changes.passwordHash) {
      // Force re-login on all devices.
      await RefreshToken.updateMany({ userId: target._id }, { $set: { isRevoked: true, revokedAt: new Date() } }).catch(() => {});
    }
    await recordAudit(req, {
      action: 'ADMIN_ACCOUNT_UPDATED',
      resource: 'USER',
      resourceId: target._id,
      details: { email: target.email, isActive: changes.isActive, passwordReset: Boolean(changes.passwordHash) }
    });
    res.json({ success: true, message: 'Admin account updated.' });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// USER DIRECTORY: every super admin can view; only the primary can export
// -------------------------------------------------------------
function buildUserQuery(q) {
  const filter = {};
  const role = String(q.role || '').toUpperCase();
  if (role && Object.values(ROLES).includes(role)) filter.role = role;
  if (q.companyCode && !Number.isNaN(Number(q.companyCode))) filter.companyCode = Number(q.companyCode);
  if (q.search) {
    const rx = new RegExp(String(q.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }, { referralCode: rx }];
    // "+91 98765 43210" should still find the stored mobile number.
    const digits = String(q.search).replace(/\D/g, '');
    if (digits.length >= 4) filter.$or.push({ phone: new RegExp(digits.length > 10 ? digits.slice(-10) : digits) });
  }
  return filter;
}

const { USER_PLACEHOLDER } = require('../../utils/cleanPlaceholderEmails');
const USER_LIST_FIELDS = 'name email phone role adminLevel companyCode referralCode kycStatus isActive createdAt';

router.get('/users', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const filter = buildUserQuery(req.query);
    const [users, total] = await Promise.all([
      User.find(filter).select(USER_LIST_FIELDS).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      User.countDocuments(filter)
    ]);
    res.json({
      success: true,
      users,
      total,
      page,
      pages: Math.ceil(total / limit),
      canExport: isPrimaryAdmin(req.user)
    });
  } catch (err) {
    next(err);
  }
});

const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v instanceof Date ? v.toISOString() : v);
  // Neutralise spreadsheet formula injection and escape quotes.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

router.get('/users/export', requirePrimaryAdmin, async (req, res, next) => {
  try {
    const filter = buildUserQuery(req.query);
    const users = await User.find(filter).select(USER_LIST_FIELDS).sort({ createdAt: -1 }).limit(50000).lean();
    const header = ['Name', 'Email', 'Phone', 'Role', 'Company Code', 'Referral Code', 'KYC', 'Active', 'Created At'];
    const rows = users.map((u) => [u.name, USER_PLACEHOLDER.test(u.email || '') ? '' : u.email, u.phone, u.role, u.companyCode, u.referralCode, u.kycStatus, u.isActive !== false ? 'Yes' : 'No', u.createdAt]);
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');

    await recordAudit(req, {
      action: 'USER_DATA_EXPORTED',
      resource: 'USER',
      details: { filter: req.query, rows: users.length }
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="rupadiya-users-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send('﻿' + csv);
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// RBS ↔ COMPANY SETTLEMENT STATEMENTS
// -------------------------------------------------------------
function resolvePeriod(q) {
  if (q.preset) return presetPeriod(String(q.preset).toUpperCase());
  return { from: q.from, to: q.to };
}

// Preview for one company or all companies (nothing saved)
router.get('/settlements/preview', async (req, res, next) => {
  try {
    const { from, to } = resolvePeriod(req.query);
    if (req.query.companyCode) {
      const preview = await settlementService.compute(req.query.companyCode, from, to);
      return res.json({ success: true, preview });
    }
    const companies = await Company.find({}).select('companyCode name').sort({ companyCode: 1 }).lean();
    const rows = [];
    for (const c of companies) {
      const p = await settlementService.compute(c.companyCode, from, to);
      rows.push({
        companyCode: c.companyCode,
        companyName: p.companyName,
        ticketCount: p.ticketCount,
        ticketFareOwed: p.ticketFareOwed,
        clawbacks: p.clawbacks,
        cashHeldByCompany: p.cashHeldByCompany,
        net: p.net,
        direction: p.direction
      });
    }
    res.json({
      success: true,
      period: { from, to },
      companies: rows,
      totals: {
        rbsPays: rows.filter((r) => r.net > 0).reduce((s, r) => s + r.net, 0),
        rbsReceives: rows.filter((r) => r.net < 0).reduce((s, r) => s - r.net, 0)
      }
    });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

router.get('/settlements/preview.csv', async (req, res, next) => {
  try {
    const { from, to } = resolvePeriod(req.query);
    const preview = await settlementService.compute(req.query.companyCode, from, to);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="settlement-preview-${preview.companyCode}.csv"`);
    res.send('﻿' + settlementService.toCsv(preview));
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

router.post('/settlements', async (req, res, next) => {
  try {
    const { from, to } = resolvePeriod(req.body || {});
    const s = await settlementService.issue({ companyCode: req.body?.companyCode, from, to, actorId: req.user._id, notes: req.body?.notes });
    await recordAudit(req, { action: 'SETTLEMENT_ISSUED', resource: 'SETTLEMENT', resourceId: s._id, companyCode: s.companyCode, details: { statementNo: s.statementNo, net: s.net } });
    res.status(201).json({ success: true, message: `Statement ${s.statementNo} issued.`, settlement: s });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

router.get('/settlements', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.companyCode) filter.companyCode = Number(req.query.companyCode);
    if (req.query.status) filter.status = String(req.query.status).toUpperCase();
    const list = await CompanySettlement.find(filter).select('-lines').sort({ createdAt: -1 }).limit(200).lean();
    res.json({ success: true, settlements: list });
  } catch (err) {
    next(err);
  }
});

router.get('/settlements/:id', async (req, res, next) => {
  try {
    const s = await CompanySettlement.findById(req.params.id).lean();
    if (!s) return res.status(404).json({ error: 'Statement not found.' });
    res.json({ success: true, settlement: s });
  } catch (err) {
    next(err);
  }
});

router.get('/settlements/:id/export.csv', async (req, res, next) => {
  try {
    const s = await CompanySettlement.findById(req.params.id).lean();
    if (!s) return res.status(404).json({ error: 'Statement not found.' });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${s.statementNo}.csv"`);
    res.send('﻿' + settlementService.toCsv(s));
  } catch (err) {
    next(err);
  }
});

router.post('/settlements/:id/settle', async (req, res, next) => {
  try {
    const s = await settlementService.markSettled({ settlementId: req.params.id, actorId: req.user._id, utrNumber: req.body?.utrNumber, notes: req.body?.notes });
    await recordAudit(req, { action: 'SETTLEMENT_SETTLED', resource: 'SETTLEMENT', resourceId: s._id, companyCode: s.companyCode, details: { statementNo: s.statementNo, net: s.net, utr: s.utrNumber } });
    res.json({ success: true, message: `Statement ${s.statementNo} marked settled.`, settlement: s });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

router.post('/settlements/:id/void', async (req, res, next) => {
  try {
    const s = await settlementService.voidStatement({ settlementId: req.params.id });
    await recordAudit(req, { action: 'SETTLEMENT_VOIDED', resource: 'SETTLEMENT', resourceId: s._id, companyCode: s.companyCode, details: { statementNo: s.statementNo } });
    res.json({ success: true, message: `Statement ${s.statementNo} voided. Its tickets are unsettled again.`, settlement: s });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

// -------------------------------------------------------------
// WHATSAPP (RBS business number) & MESSAGE TEMPLATES — super admin only
// -------------------------------------------------------------
const whatsappProvider = () => require('../../providers/whatsapp/BaileysProvider');

router.get('/whatsapp/status', async (req, res, next) => {
  try {
    const wa = whatsappProvider();
    const [stats, lease, hasSavedSession] = await Promise.all([
      notificationService.whatsappStats(1),
      notificationService.leaseInfo(),
      wa.hasSavedSession()
    ]);
    res.json({
      success: true,
      whatsapp: wa.publicStatus(),
      hasSavedSession,
      senderInstance: lease.isLeader,
      lease,
      emailConfigured: require('../../providers/email/EmailProvider').isConfigured(),
      adminNotifyPhones: await notificationService.adminPhones(),
      queue: { pending: stats.queue.waiting, oldestWaitingAt: stats.queue.oldestWaitingAt, sentToday: stats.today.sent, failedToday: stats.today.failed },
      today: stats.today
    });
  } catch (err) {
    next(err);
  }
});

// Message counts only (no message content): today, today by message type, and day-by-day history.
router.get('/whatsapp/stats', async (req, res, next) => {
  try {
    res.json({ success: true, ...(await notificationService.whatsappStats(req.query.days)) });
  } catch (err) {
    next(err);
  }
});

// Start the session: returns a QR (also pushed live over the admin WebSocket) until the phone scans it.
// The admin chose this server, so it becomes the sender (an old / dead holder of the lease is replaced).
router.post('/whatsapp/connect', async (req, res, next) => {
  try {
    await notificationService.claimLeadership();
    const status = await whatsappProvider().connect();
    await recordAudit(req, { action: 'WHATSAPP_CONNECT', resource: 'WHATSAPP' });
    res.json({ success: true, whatsapp: status, message: status.status === 'CONNECTED' ? 'WhatsApp is connected.' : 'Starting WhatsApp… scan the QR code with the RBS phone.' });
  } catch (err) {
    next(err);
  }
});

// Unlink the RBS number from this platform (a new QR scan is needed to reconnect).
router.post('/whatsapp/logout', async (req, res, next) => {
  try {
    await whatsappProvider().logout();
    await recordAudit(req, { action: 'WHATSAPP_LOGOUT', resource: 'WHATSAPP' });
    res.json({ success: true, message: 'WhatsApp disconnected and unlinked.' });
  } catch (err) {
    next(err);
  }
});

// Send a test message now. It is recorded like any other message, so it appears in the counts
// and its delivered / read receipts are tracked.
router.post('/whatsapp/test', async (req, res, next) => {
  try {
    const phone = normalisePhone(req.body?.phone, req.body?.countryCode);
    if (!phone) return res.status(400).json({ error: PHONE_ERROR });
    const text = String(req.body?.message || 'Test message from Rupadiya Bus Samiti ✅').slice(0, 1000);
    const wa = whatsappProvider();
    if (!wa.isReady()) return res.status(409).json({ error: 'WhatsApp is not connected. Connect it first.' });
    const sent = await wa.sendText(phone, text);
    await NotificationJob.create({
      event: 'TEST_MESSAGE', audience: 'ADMIN', channel: 'WHATSAPP', to: phone, body: text,
      status: 'SENT', sentAt: new Date(), attempts: 1, waMessageId: sent?.id || null, refType: 'TEST'
    }).catch(() => {});
    res.json({ success: true, message: `Test message sent to ${formatPhone(phone)}. Delivery shows in the counts once the phone receives it.` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Put every failed / expired WhatsApp message from the last N hours back in the queue.
router.post('/whatsapp/retry-failed', async (req, res, next) => {
  try {
    const hours = Math.min(Math.max(Number(req.body?.hours) || 24, 1), 168);
    const r = await NotificationJob.updateMany(
      { channel: 'WHATSAPP', status: { $in: ['FAILED', 'EXPIRED'] }, createdAt: { $gte: new Date(Date.now() - hours * 3600000) } },
      { $set: { status: 'PENDING', attempts: 0, nextAttemptAt: new Date(), expiresAt: new Date(Date.now() + 24 * 3600000), lastError: null } }
    );
    await recordAudit(req, { action: 'WHATSAPP_RETRY_FAILED', resource: 'WHATSAPP', details: { hours, count: r.modifiedCount } });
    res.json({ success: true, requeued: r.modifiedCount, message: `${r.modifiedCount} message(s) queued again.` });
  } catch (err) {
    next(err);
  }
});

// Numbers that receive admin trip summaries (journey started / completed)
router.put('/whatsapp/admin-phones', async (req, res, next) => {
  try {
    const phones = [...new Set((Array.isArray(req.body?.phones) ? req.body.phones : String(req.body?.phones || '').split(','))
      .map((p) => normalisePhone(p))
      .filter(Boolean))].slice(0, 10);
    await PlatformSetting.updateOne({ key: 'adminNotifyPhones' }, { $set: { value: phones, updatedBy: req.user._id } }, { upsert: true });
    await recordAudit(req, { action: 'ADMIN_NOTIFY_PHONES_UPDATED', resource: 'WHATSAPP', details: { phones } });
    res.json({ success: true, phones });
  } catch (err) {
    next(err);
  }
});

router.get('/notifications', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = String(req.query.status).toUpperCase();
    if (req.query.channel) filter.channel = String(req.query.channel).toUpperCase();
    const jobs = await NotificationJob.find(filter).select('-html').sort({ createdAt: -1 }).limit(200).lean();
    res.json({ success: true, jobs });
  } catch (err) {
    next(err);
  }
});

router.post('/notifications/:id/retry', async (req, res, next) => {
  try {
    const job = await NotificationJob.findOneAndUpdate(
      { _id: req.params.id, status: { $in: ['FAILED', 'EXPIRED', 'SKIPPED'] } },
      { $set: { status: 'PENDING', attempts: 0, nextAttemptAt: new Date(), expiresAt: new Date(Date.now() + 24 * 3600000), lastError: null } },
      { new: true }
    );
    if (!job) return res.status(409).json({ error: 'Only failed, expired or skipped messages can be retried.' });
    res.json({ success: true, job });
  } catch (err) {
    next(err);
  }
});

router.get('/templates', async (req, res, next) => {
  try {
    await notificationService.ensureTemplates();
    const templates = await MessageTemplate.find({}).sort({ event: 1, audience: 1, channel: 1 }).lean();
    res.json({ success: true, templates });
  } catch (err) {
    next(err);
  }
});

router.put('/templates/:key', async (req, res, next) => {
  try {
    const body = String(req.body?.body || '').trim();
    if (body.length < 5 || body.length > 2000) return res.status(400).json({ error: 'Message must be 5-2000 characters.' });
    const update = { body, enabled: req.body?.enabled !== false, updatedBy: req.user._id };
    if (req.body?.subject !== undefined) update.subject = String(req.body.subject).slice(0, 200);
    const t = await MessageTemplate.findOneAndUpdate({ key: req.params.key }, { $set: update }, { new: true });
    if (!t) return res.status(404).json({ error: 'Template not found.' });
    await recordAudit(req, { action: 'MESSAGE_TEMPLATE_UPDATED', resource: 'TEMPLATE', resourceId: t.key, details: { enabled: t.enabled } });
    res.json({ success: true, template: t });
  } catch (err) {
    next(err);
  }
});

router.post('/templates/preview', async (req, res) => {
  const sample = {
    name: 'Sunita Devi', pnr: 'RUP12345678', from: 'Rupaidiha', to: 'Ahmedabad', date: '12 Dec 2026', time: '05:30 pm',
    arrival: '13 Dec 2026, 07:45 pm', passengerCount: '2', passengerList: 'Sunita Devi (L7), Ramesh Kumar (L8)',
    changeText: 'Boarding point changed: Rupaidiha Bus Stand → Nanpara Chauraha.', reason: 'Passenger was late', managerPhone: '(+91 98765 43210)',
    seats: 'L3, L4', boarding: 'Rupaidiha Bus Stand', boardingTime: '05:30 pm', dropping: 'Ahmedabad Geeta Mandir',
    busNumber: 'UP40AT1234', companyName: 'Rupadiya Travels', amount: '2,150', refundAmount: '1,890',
    ticketUrl: 'https://rupadiya.example/ticket/BK_123', bookUrl: 'https://rupadiya.example', agentName: 'Ravi Agency',
    receiptNo: 'CR-20261212-ABC123', utr: 'HDFC412345678', boarded: 34, noShow: 2, total: 36, dropped: 34,
    managerName: 'Vikram Singh', infants: '1 on lap'
  };
  res.json({ success: true, preview: renderTemplate(String(req.body?.body || ''), sample), subject: renderTemplate(String(req.body?.subject || ''), sample) });
});

// Live journeys: today's trips across all companies with boarding progress (counts only)
router.get('/journeys', async (req, res, next) => {
  try {
    const base = req.query.date ? new Date(`${req.query.date}T00:00:00+05:30`) : new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) + 'T00:00:00+05:30');
    const trips = await Trip.find({ departureTime: { $gte: base, $lt: new Date(base.getTime() + 86400000) } })
      .select('companyCode departureTime status journey managerId routeId busId seats.status')
      .populate('routeId', 'fromCity toCity').populate('busId', 'busNumber').populate('managerId', 'name phone')
      .sort({ departureTime: 1 }).limit(300).lean();
    const { tripCounts } = require('../manager/manager.service');
    const companies = await Company.find({}).select('companyCode name').lean();
    const names = new Map(companies.map((c) => [c.companyCode, c.name]));
    const rows = await Promise.all(trips.map(async (t) => ({
      _id: t._id,
      companyCode: t.companyCode,
      companyName: names.get(t.companyCode) || `#${t.companyCode}`,
      route: `${t.routeId?.fromCity?.name || '?'} → ${t.routeId?.toCity?.name || '?'}`,
      busNumber: t.busId?.busNumber,
      departureTime: t.departureTime,
      status: t.status,
      journey: t.journey,
      manager: t.managerId ? { name: t.managerId.name, phone: t.managerId.phone } : null,
      counts: await tripCounts(t._id)
    })));
    res.json({ success: true, date: base, trips: rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
