const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { authenticateToken } = require('../../middleware/auth.middleware');
const { authorizeRoles } = require('../../middleware/rbac.middleware');
const { Wallet, WalletLedger } = require('../wallets/wallet.model');
const DepositRequest = require('../wallets/deposit.model');
const { CommissionRecord } = require('../commissions/commission.model');
const commissionService = require('../commissions/commission.service');
const taxService = require('../tax/tax.service');
const websocketService = require('../../services/websocket.service');
const WithdrawalRequest = require('../withdrawals/withdrawal.model');
const Booking = require('../bookings/booking.model');
const bookingService = require('../bookings/booking.service');
const holdStore = require('../../config/holdStore');
const Trip = require('../trips/trip.model');
const User = require('../users/user.model');
const { ROLES, TRANSACTION_TYPES, SEAT_STATUS } = require('../../config/constants');
const { generateUniqueReferralCode } = require('../../utils/referralCode');

// Middleware to ensure user is an Agent
const agentOnly = [authenticateToken, authorizeRoles(ROLES.AGENT)];

/**
 * Helper to ensure an agent has an initialized wallet
 */
async function getOrCreateAgentWallet(agentId, companyCode) {
  let wallet = await Wallet.findOne({ userId: agentId });
  if (!wallet) {
    wallet = await Wallet.create({
      userId: agentId,
      companyCode: companyCode || 1,
      availableBalance: 0,
      reservedBalance: 0
    });
  }
  return wallet;
}

/**
 * Project a lean, optimized Ticket DTO for agent ticket search and booking history
 * Excludes trip.seats array (40+ objects) and full bus documents/RC/insurance images
 */
function buildLeanTicketDTO(bookingDoc) {
  const b = bookingDoc.toObject ? bookingDoc.toObject() : bookingDoc;
  const trip = b.tripId || {};
  const route = b.routeId || trip.routeId || {};
  const bus = b.busId || trip.busId || {};

  const depDate = trip.departureTime ? new Date(trip.departureTime).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }) : 'Scheduled';

  const depTime = trip.departureTime ? new Date(trip.departureTime).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }) : '05:30 PM';

  const arrTime = trip.arrivalTime ? new Date(trip.arrivalTime).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }) : 'Scheduled';

  const fromCity = (route.fromCity?.name === 'Rupadiya' ? 'Rupaidiha' : (route.fromCity?.name || 'Rupaidiha'));
  const toCity = route.toCity?.name || 'Destination';

  return {
    _id: b._id,
    bookingId: b.bookingId,
    pnr: b.pnr,
    status: b.status,
    paymentStatus: b.paymentStatus || 'COMPLETED',
    paymentProvider: b.paymentProvider || 'agent_wallet',
    travelDate: trip.departureTime || b.createdAt,
    departureDate: depDate,
    departureTime: depTime,
    arrivalTime: arrTime,
    fromCity,
    toCity,
    boardingPoint: {
      name: b.boardingPoint?.name || fromCity,
      time: b.boardingPoint?.time || depTime,
      landmark: b.boardingPoint?.landmark || ''
    },
    droppingPoint: {
      name: b.droppingPoint?.name || toCity,
      time: b.droppingPoint?.time || arrTime,
      landmark: b.droppingPoint?.landmark || ''
    },
    boardingLocation: b.boardingPoint?.name || fromCity,
    droppingLocation: b.droppingPoint?.name || toCity,
    bus: {
      name: bus.name || bus.operatorName || 'Rupadiya Intercity Coach',
      operatorName: bus.operatorName || 'Rupadiya Intercity Travels',
      busNumber: bus.busNumber || 'UP-40-TC-1001',
      busType: bus.busType || 'AC Sleeper (2+1)',
      layoutType: bus.layoutType || '2+1',
      totalSeats: bus.totalSeats || 36,
      driverName: bus.driverDetails?.name || bus.driverName || 'Verified Pilot',
      driverPhone: bus.driverDetails?.phone || bus.driverPhone || '+91 98765 43210',
      amenities: bus.amenities && bus.amenities.length > 0 
        ? bus.amenities 
        : ['Charging Point', 'Night Reading Lamp', 'Water Bottle', 'AC', 'Blanket']
    },
    trip: {
      _id: trip._id,
      sourceCity: fromCity,
      destinationCity: toCity,
      departureDate: depDate,
      departureTime: depTime,
      arrivalTime: arrTime,
      status: trip.status || 'SCHEDULED'
    },
    route: {
      _id: route._id,
      fromCity,
      toCity
    },
    seatNumbers: b.seatNumbers || [],
    seats: (b.seatNumbers || []).map(num => ({ seatNumber: num })),
    seatCount: (b.seatNumbers || []).length,
    passengers: (b.passengers || []).map(p => ({
      name: p.name,
      age: p.age,
      gender: p.gender,
      seatNumber: p.seatNumber
    })),
    fareBreakdown: {
      baseFare: b.fareBreakdown?.baseFare || 0,
      tax: b.fareBreakdown?.gst || b.fareBreakdown?.tax || 0,
      totalPayable: b.fareBreakdown?.totalPayable ?? b.totalAmount ?? 0,
      insurance: b.fareBreakdown?.insurance || 0
    },
    totalAmount: b.fareBreakdown?.totalPayable ?? b.totalAmount ?? 0,
    contactDetails: {
      name: b.contactDetails?.name || '',
      email: b.contactDetails?.email || '',
      phone: b.contactDetails?.phone || ''
    },
    createdAt: b.createdAt
  };
}

// -------------------------------------------------------------
// 1. DASHBOARD OVERVIEW & KPIS
// -------------------------------------------------------------
router.get('/dashboard', agentOnly, async (req, res, next) => {
  try {
    const agentId = req.user._id;
    const wallet = await getOrCreateAgentWallet(agentId, req.user.companyCode);

    // 1. Booking counts
    const totalBookings = await Booking.countDocuments({ referralAgentId: agentId });
    const confirmedBookings = await Booking.countDocuments({ referralAgentId: agentId, status: 'CONFIRMED' });

    // 2. Deposits metrics
    const deposits = await DepositRequest.find({ userId: agentId });
    const successfulDepositsCount = deposits.filter(d => d.status === 'COMPLETED').length;
    const successfulDepositsSum = deposits.filter(d => d.status === 'COMPLETED').reduce((sum, d) => sum + d.amount, 0);

    // 3. Wallet Ledger credits vs debits
    const ledger = await WalletLedger.find({ userId: agentId });
    const totalCredits = ledger.filter(l => l.entryType === 'CREDIT').reduce((sum, l) => sum + l.amount, 0);
    const totalDebits = ledger.filter(l => l.entryType === 'DEBIT').reduce((sum, l) => sum + l.amount, 0);

    // 4. Rewards metrics
    const rewardsRecords = await CommissionRecord.find({ agentId });
    const totalCashbackEarned = rewardsRecords.reduce((sum, r) => sum + (r.netCommission || 0), 0);

    // 5. Recent 5 Ledger transactions
    const recentLedger = await WalletLedger.find({ userId: agentId })
      .sort({ createdAt: -1 })
      .limit(5);

    // 6. Recent 5 Customer Bookings
    const recentBookings = await Booking.find({ referralAgentId: agentId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('routeId')
      .populate('busId');

    const dashboardData = {
      agent: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone,
        referralCode: req.user.referralCode || 'RUP-AGENT',
        agentCode: req.user.referralCode || 'RUP-AGENT',
        companyCode: req.user.companyCode || 1,
        kycStatus: req.user.kycStatus || 'VERIFIED',
        agentLevel: req.user.agentLevel || 'SILVER',
        agencyName: req.user.agencyName || 'Rupadiya Travels Agency',
        customCashbackPercent: req.user.customCashbackPercent
      },
      walletBalance: wallet.availableBalance,
      wallet: {
        availableBalance: wallet.availableBalance,
        reservedBalance: wallet.reservedBalance,
        totalBalance: wallet.availableBalance + wallet.reservedBalance,
        currency: wallet.currency || 'INR'
      },
      kpi: {
        totalBookings,
        confirmedBookings,
        successfulDepositsCount,
        successfulDepositsSum,
        totalCredits,
        totalDebits,
        totalCashbackEarned
      },
      totalBookings,
      confirmedBookings,
      successfulDepositsCount,
      successfulDepositsTotal: successfulDepositsSum,
      totalCredits,
      totalDebits,
      rewardsEarned: totalCashbackEarned,
      recentTransactions: recentLedger,
      recentLedger,
      recentBookings
    };

    res.json({
      success: true,
      data: dashboardData,
      ...dashboardData
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 2. MAKE DEPOSIT & DEPOSIT SUBMISSION
// -------------------------------------------------------------
router.post('/deposits', agentOnly, async (req, res, next) => {
  try {
    const agentId = req.user._id;
    const { amount, paymentMethod = 'UPI_QR', referenceId, bankDetails, simulateInstant = true } = req.body;

    const numAmount = Number(amount);
    if (!numAmount || numAmount < 100) {
      return res.status(400).json({ error: 'Minimum deposit amount is ₹100' });
    }

    const depositId = `DEP_${Math.floor(100000 + Math.random() * 900000)}`;
    const finalReference = referenceId || `UTR_${Date.now()}`;

    const wallet = await getOrCreateAgentWallet(agentId, req.user.companyCode);

    // If instant verification or UPI simulation
    const isCompleted = false; // Manual UPI/Bank deposits remain PENDING until approved by Owner/Admin

    const depositRecord = await DepositRequest.create({
      depositId,
      userId: agentId,
      companyCode: req.user.companyCode || 1,
      amount: numAmount,
      paymentMethod,
      referenceId: finalReference,
      bankDetails: bankDetails || {},
      status: isCompleted ? 'COMPLETED' : 'PENDING',
      verifiedBy: isCompleted ? 'AUTOMATED_GATEWAY_WEBHOOK' : 'SYSTEM_PENDING_APPROVAL',
      verifiedAt: isCompleted ? new Date() : null
    });

    if (isCompleted) {
      wallet.availableBalance += numAmount;
      await wallet.save();

      await WalletLedger.create({
        walletId: wallet._id,
        userId: agentId,
        companyCode: req.user.companyCode || 1,
        entryType: 'CREDIT',
        amount: numAmount,
        balanceAfter: wallet.availableBalance,
        transactionType: TRANSACTION_TYPES.WALLET_DEPOSIT,
        referenceType: 'DEPOSIT',
        referenceId: depositId,
        description: `Wallet Deposit via ${paymentMethod === 'UPI_QR' ? 'UPI QR' : 'Bank Transfer'} (Ref: ${finalReference})`,
        idempotencyKey: `IDEM_${depositId}_${Date.now()}`
      });
    }

    res.status(201).json({
      success: true,
      message: isCompleted 
        ? `₹${numAmount.toLocaleString()} credited successfully to your wallet.` 
        : `Deposit request submitted for verification (ID: ${depositId}).`,
      deposit: depositRecord,
      newBalance: wallet.availableBalance
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 3. DEPOSIT HISTORY (WITH PERIOD FILTERS & PAGINATION)
// -------------------------------------------------------------
router.get('/deposits', agentOnly, async (req, res, next) => {
  try {
    const agentId = req.user._id;
    const { period = 'all', startDate, endDate, status, paymentMethod, search, page = 1, limit = 50 } = req.query;

    // Strict user scoping: only fetch records belonging to the authenticated agent
    const query = { userId: agentId };

    const cleanStatus = (status && !['ALL', 'undefined', 'null', ''].includes(String(status).trim())) ? String(status).trim() : null;
    const cleanMethod = (paymentMethod && !['ALL', 'undefined', 'null', ''].includes(String(paymentMethod).trim())) ? String(paymentMethod).trim() : null;
    const cleanSearch = (search && !['undefined', 'null', ''].includes(String(search).trim())) ? String(search).trim() : null;
    const cleanPeriod = (period && !['undefined', 'null', ''].includes(String(period).trim())) ? String(period).trim() : 'all';

    // 1. Period date range logic
    const now = new Date();
    if (cleanPeriod === 'today') {
      const todayStart = new Date(now.setHours(0, 0, 0, 0));
      query.createdAt = { $gte: todayStart };
    } else if (cleanPeriod === 'yesterday') {
      const yStart = new Date(now.setDate(now.getDate() - 1));
      yStart.setHours(0, 0, 0, 0);
      const yEnd = new Date(yStart);
      yEnd.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: yStart, $lte: yEnd };
    } else if (cleanPeriod === '7d') {
      const d7 = new Date(Date.now() - 7 * 24 * 3600 * 1000);
      query.createdAt = { $gte: d7 };
    } else if (cleanPeriod === '30d') {
      const d30 = new Date(Date.now() - 30 * 24 * 3600 * 1000);
      query.createdAt = { $gte: d30 };
    } else if (cleanPeriod === 'this_month') {
      const mStart = new Date(now.getFullYear(), now.getMonth(), 1);
      query.createdAt = { $gte: mStart };
    } else if (cleanPeriod === 'prev_month') {
      const pmStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const pmEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      query.createdAt = { $gte: pmStart, $lte: pmEnd };
    } else if (cleanPeriod === 'custom' && startDate && endDate && startDate !== 'undefined' && endDate !== 'undefined') {
      const s = new Date(startDate);
      const e = new Date(endDate);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
        query.createdAt = { $gte: s, $lte: new Date(e.setHours(23, 59, 59, 999)) };
      }
    }

    // 2. Status filter
    if (cleanStatus) {
      query.status = cleanStatus;
    }

    // 3. Payment method filter
    if (cleanMethod) {
      query.paymentMethod = cleanMethod;
    }

    // 4. Text search
    if (cleanSearch) {
      query.$or = [
        { depositId: { $regex: cleanSearch, $options: 'i' } },
        { referenceId: { $regex: cleanSearch, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const totalCount = await DepositRequest.countDocuments(query);
    const deposits = await DepositRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    // Summary totals for selected query
    const allMatches = await DepositRequest.find(query);
    const totalDepositedSum = allMatches.filter(d => d.status === 'COMPLETED' || d.status === 'SUCCESS').reduce((acc, d) => acc + d.amount, 0);
    const pendingSum = allMatches.filter(d => d.status === 'PENDING').reduce((acc, d) => acc + d.amount, 0);

    res.json({
      success: true,
      totalCount,
      page: parseInt(page, 10),
      pages: Math.ceil(totalCount / parseInt(limit, 10)),
      deposits,
      data: {
        deposits,
        summary: {
          totalDepositedSum,
          pendingSum,
          count: allMatches.length
        }
      },
      summary: {
        totalDepositedSum,
        pendingSum,
        count: allMatches.length
      }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 4. STATEMENT — COMPLETE WALLET LEDGER
// -------------------------------------------------------------
router.get('/statement', agentOnly, async (req, res, next) => {
  try {
    const agentId = req.user._id;
    const { startDate, endDate, search, type, page = 1, limit = 50 } = req.query;

    // Strict user scoping: only fetch records belonging to the authenticated agent
    const query = { userId: agentId };

    const cleanType = (type && !['ALL', 'undefined', 'null', ''].includes(String(type).trim())) ? String(type).trim().toUpperCase() : null;
    const cleanSearch = (search && !['undefined', 'null', ''].includes(String(search).trim())) ? String(search).trim() : null;

    if (startDate && endDate && startDate !== 'undefined' && endDate !== 'undefined') {
      const s = new Date(startDate);
      const e = new Date(endDate);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
        query.createdAt = {
          $gte: s,
          $lte: new Date(e.setHours(23, 59, 59, 999))
        };
      }
    }

    if (cleanType) {
      query.entryType = cleanType;
    }

    if (cleanSearch) {
      query.$or = [
        { referenceId: { $regex: cleanSearch, $options: 'i' } },
        { description: { $regex: cleanSearch, $options: 'i' } },
        { idempotencyKey: { $regex: cleanSearch, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await WalletLedger.countDocuments(query);

    const ledgerEntries = await WalletLedger.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    // Full range calculations
    const allMatching = await WalletLedger.find(query);
    const totalCredits = allMatching.filter(e => e.entryType === 'CREDIT').reduce((acc, e) => acc + e.amount, 0);
    const totalDebits = allMatching.filter(e => e.entryType === 'DEBIT').reduce((acc, e) => acc + e.amount, 0);

    const wallet = await getOrCreateAgentWallet(agentId, req.user.companyCode);

    // Opening balance calculation: balance before selected period
    let openingBalance = 0;
    if (query.createdAt && query.createdAt.$gte) {
      const priorEntries = await WalletLedger.find({
        userId: agentId,
        createdAt: { $lt: query.createdAt.$gte }
      }).sort({ createdAt: 1 });
      const priorCredits = priorEntries.filter(e => e.entryType === 'CREDIT').reduce((acc, e) => acc + e.amount, 0);
      const priorDebits = priorEntries.filter(e => e.entryType === 'DEBIT').reduce((acc, e) => acc + e.amount, 0);
      openingBalance = Math.max(0, priorCredits - priorDebits);
    }

    res.json({
      success: true,
      summary: {
        openingBalance,
        totalCredits,
        totalDebits,
        closingBalance: wallet.availableBalance,
        transactionCount: total
      },
      page: parseInt(page, 10),
      pages: Math.ceil(total / parseInt(limit, 10)),
      total,
      statement: ledgerEntries,
      transactions: ledgerEntries,
      data: {
        statement: ledgerEntries,
        transactions: ledgerEntries,
        summary: {
          openingBalance,
          totalCredits,
          totalDebits,
          closingBalance: wallet.availableBalance,
          transactionCount: total
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 5. PRINT TICKET (FIND TICKET BY PNR OR TICKET NUMBER)
// -------------------------------------------------------------
router.get('/tickets/search', agentOnly, async (req, res, next) => {
  try {
    const { q, pnr, mobile, startDate, endDate, fromDate, toDate } = req.query;
    const ticketQuery = q || pnr;
    if (!ticketQuery && !startDate && !fromDate) {
      return res.status(400).json({ error: 'Please enter a ticket number, PNR, or date range' });
    }

    const cleanQ = ticketQuery ? ticketQuery.trim() : null;
    const cleanMobile = mobile ? mobile.trim().replace(/\D/g, '') : null;

    let query = {};
    if (cleanQ) {
      query.$or = [
        { bookingId: cleanQ },
        { pnr: cleanQ.toUpperCase() },
        { bookingId: { $regex: cleanQ, $options: 'i' } },
        { pnr: { $regex: cleanQ, $options: 'i' } }
      ];
    }

    const start = startDate || fromDate;
    const end = endDate || toDate;
    if (start || end) {
      query.createdAt = {};
      if (start) query.createdAt.$gte = new Date(start);
      if (end) {
        const d = new Date(end);
        d.setHours(23, 59, 59, 999);
        query.createdAt.$lte = d;
      }
    }

    // Scope ticket search strictly to this agent's own bookings and company
    const agentOwnership = {
      $or: [
        { referralAgentId: req.user._id },
        { passengerId: req.user._id }
      ]
    };
    query.$and = [agentOwnership];

    if (req.user.companyCode) {
      query.companyCode = req.user.companyCode;
    }

    const bookingDoc = await Booking.findOne(query)
      .populate({
        path: 'tripId',
        populate: [{ path: 'routeId' }, { path: 'busId' }]
      })
      .populate('routeId')
      .populate('busId');

    if (!bookingDoc) {
      return res.status(404).json({ error: 'Ticket not found. Please verify the ticket number or travel dates.' });
    }

    // Verify mobile number if requested (Two-factor lookup)
    if (cleanMobile) {
      const contactPhone = bookingDoc.contactDetails?.phone?.replace(/\D/g, '');
      const passengerPhoneMatch = bookingDoc.passengers?.some(p => p.phone?.replace(/\D/g, '') === cleanMobile);
      if (contactPhone && contactPhone !== cleanMobile && !passengerPhoneMatch) {
        return res.status(403).json({ error: 'Mobile number does not match registered passenger details.' });
      }
    }

    const ticketDTO = buildLeanTicketDTO(bookingDoc);

    res.json({
      success: true,
      booking: ticketDTO,
      data: ticketDTO
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 5B. AGENT BOOKING HISTORY & DETAILS
// -------------------------------------------------------------
router.get('/bookings', agentOnly, async (req, res, next) => {
  try {
    const agentId = req.user._id;
    const { status, search, startDate, endDate, page = 1, limit = 20 } = req.query;

    const baseAgentFilter = {
      $or: [
        { referralAgentId: agentId },
        { passengerId: agentId }
      ]
    };

    const andConditions = [baseAgentFilter];

    if (status && status !== 'ALL') {
      andConditions.push({ status: String(status).toUpperCase().trim() });
    }

    if (search && String(search).trim()) {
      const s = String(search).trim();
      const sDigits = s.replace(/\D/g, '');
      const searchConditions = [
        { bookingId: { $regex: s, $options: 'i' } },
        { pnr: { $regex: s, $options: 'i' } },
        { 'passengers.name': { $regex: s, $options: 'i' } }
      ];
      if (sDigits.length >= 4) {
        searchConditions.push({ 'contactDetails.phone': { $regex: sDigits, $options: 'i' } });
      }
      andConditions.push({ $or: searchConditions });
    }

    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) {
        const d = new Date(endDate);
        d.setHours(23, 59, 59, 999);
        dateFilter.$lte = d;
      }
      andConditions.push({ createdAt: dateFilter });
    }

    const query = { $and: andConditions };

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.max(1, parseInt(limit, 10));
    const pageLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const [totalBookings, confirmedCount, cancelledCount, volumeAgg, docs] = await Promise.all([
      Booking.countDocuments(query),
      Booking.countDocuments({ $and: [baseAgentFilter, { status: 'CONFIRMED' }] }),
      Booking.countDocuments({ $and: [baseAgentFilter, { status: 'CANCELLED' }] }),
      Booking.aggregate([
        { $match: { $and: [baseAgentFilter, { status: 'CONFIRMED' }] } },
        { $group: { _id: null, total: { $sum: '$fareBreakdown.totalPayable' } } }
      ]),
      Booking.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageLimit)
        .populate({
          path: 'tripId',
          select: 'departureTime arrivalTime status routeId busId',
          populate: [
            { path: 'routeId', select: 'fromCity toCity' },
            { path: 'busId', select: 'name operatorName busNumber busType' }
          ]
        })
        .populate('routeId', 'fromCity toCity')
        .populate('busId', 'name operatorName busNumber busType')
    ]);

    const bookings = docs.map(doc => buildLeanTicketDTO(doc));
    const totalGrossSales = volumeAgg[0]?.total || 0;

    res.json({
      success: true,
      bookings,
      pagination: {
        page: Math.max(1, parseInt(page, 10)),
        limit: pageLimit,
        total: totalBookings,
        totalPages: Math.ceil(totalBookings / pageLimit)
      },
      stats: {
        totalBookings,
        confirmedCount,
        cancelledCount,
        totalGrossSales
      }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 6. CANCEL TICKET (POLICY VERIFICATION & WALLET REFUND)
// -------------------------------------------------------------
router.post('/tickets/cancel', agentOnly, async (req, res, next) => {
  try {
    const agentId = req.user._id;
    const { bookingId, pnr, mobile, seatNumbers, reason = 'Customer requested cancellation' } = req.body;
    const targetId = bookingId || pnr;

    if (!targetId) {
      return res.status(400).json({ error: 'Ticket number or PNR is required.' });
    }

    const cleanId = String(targetId).trim();
    const cleanMobile = mobile ? String(mobile).trim().replace(/\D/g, '') : null;
    const booking = await Booking.findOne({
      $or: [{ bookingId: cleanId }, { pnr: cleanId.toUpperCase() }]
    }).populate('tripId');

    if (!booking) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    // Strict Agent Scoping: Agents can ONLY cancel bookings booked or referred by their own agency account
    const isAgentBooking = 
      (booking.referralAgentId && booking.referralAgentId.toString() === agentId.toString()) ||
      (booking.passengerId && booking.passengerId.toString() === agentId.toString());

    if (!isAgentBooking) {
      return res.status(403).json({
        success: false,
        error: 'Access Denied: You are only authorized to cancel tickets issued by your own agency account.',
        code: 'UNAUTHORIZED_AGENT_CANCELLATION'
      });
    }

    if (cleanMobile) {
      const contactPhone = booking.contactDetails?.phone?.replace(/\D/g, '');
      const passengerPhoneMatch = booking.passengers?.some(p => p.phone?.replace(/\D/g, '') === cleanMobile);
      if (contactPhone && contactPhone !== cleanMobile && !passengerPhoneMatch) {
        return res.status(403).json({ error: 'Mobile number does not match ticket records.' });
      }
    }

    if (booking.status === 'CANCELLED') {
      return res.status(400).json({ error: 'This ticket has already been cancelled.' });
    }

    // Process dual financial settlement via central BookingService engine
    const result = await bookingService.cancelBooking({
      bookingId: booking.pnr || booking.bookingId,
      reason: reason || 'Agent requested cancellation',
      cancelledByUserId: agentId
    });

    const agentWallet = await Wallet.findOne({ userId: agentId });
    const balanceAfter = agentWallet ? agentWallet.availableBalance : 0;

    res.json({
      success: true,
      message: `Ticket #${booking.pnr || booking.bookingId} cancelled successfully.`,
      cancellationReference: `CNX_${booking.pnr || booking.bookingId}`,
      cancellationFee: result.cancellationFee,
      feePercentage: Math.round(100 - result.refundPercent),
      refundAmount: result.refundAmount,
      refundRouting: result.refundRouting,
      balanceAfter
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 7. MY REWARDS — AGENT CASHBACK & TIERS
// -------------------------------------------------------------
router.get('/rewards', agentOnly, async (req, res, next) => {
  try {
    const agentId = req.user._id;

    // Monthly volume calculation for Tier Progress
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const monthlyBookings = await Booking.find({
      referralAgentId: agentId,
      status: 'CONFIRMED',
      createdAt: { $gte: monthStart }
    });

    const monthlyVolume = monthlyBookings.reduce((sum, b) => {
      return sum + (b.fareBreakdown?.totalPayable || b.totalAmount || 0);
    }, 0);

    // Tier criteria
    // Bronze: < 25k (1%), Silver: 25k-75k (2%), Gold: 75k-150k (3%), Platinum: > 150k (4%)
    let currentTier = 'BRONZE';
    let cashbackRate = 1.0;
    let nextTier = 'SILVER';
    let nextTierTarget = 25000;

    if (monthlyVolume >= 150000) {
      currentTier = 'PLATINUM';
      cashbackRate = 4.0;
      nextTier = 'MAX_TIER';
      nextTierTarget = 150000;
    } else if (monthlyVolume >= 75000) {
      currentTier = 'GOLD';
      cashbackRate = 3.0;
      nextTier = 'PLATINUM';
      nextTierTarget = 150000;
    } else if (monthlyVolume >= 25000) {
      currentTier = 'SILVER';
      cashbackRate = 2.0;
      nextTier = 'GOLD';
      nextTierTarget = 75000;
    }

    // Ledger of rewards
    const commissions = await CommissionRecord.find({ agentId })
      .sort({ createdAt: -1 })
      .populate('bookingId')
      .limit(30);

    const totalCashback = commissions.reduce((sum, c) => sum + (c.netCommission || 0), 0);
    const pendingCashback = commissions.filter(c => c.status === 'PENDING').reduce((sum, c) => sum + (c.netCommission || 0), 0);
    const wallet = await getOrCreateAgentWallet(agentId, req.user.companyCode);

    res.json({
      success: true,
      agentLevel: currentTier,
      currentTier,
      cashbackPercent: cashbackRate,
      cashbackRate,
      monthlyVolume,
      nextTier,
      nextTierTarget,
      progressPercent: Math.min(100, Math.round((monthlyVolume / nextTierTarget) * 100)),
      totalCashback,
      totalRewardsEarned: totalCashback,
      totalCashbackEarned: totalCashback,
      pendingCashback,
      walletBalance: wallet.availableBalance,
      wallet: {
        availableBalance: wallet.availableBalance,
        reservedBalance: wallet.reservedBalance,
        totalBalance: wallet.availableBalance + wallet.reservedBalance,
        currency: wallet.currency || 'INR'
      },
      rewardsHistory: commissions
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 8. AGENT BOOKING — WALLET DEBIT ENGINE (ATOMIC & CONCURRENCY SAFE)
// -------------------------------------------------------------
router.post('/bookings/wallet-pay', agentOnly, async (req, res, next) => {
  try {
    const agentId = req.user._id;
    const {
      tripId,
      selectedSeats,
      seatNumbers,
      passengers,
      boardingPoint,
      droppingPoint,
      contactPhone,
      contactEmail,
      contactDetails,
      insuranceOpted,
      holdToken
    } = req.body;

    const seatsToBook = (selectedSeats && selectedSeats.length > 0) ? selectedSeats : (seatNumbers || []);
    const normalizedSeats = seatsToBook.map(s => String(s).trim());

    if (!tripId || normalizedSeats.length === 0) {
      return res.status(400).json({ success: false, error: 'Trip and seats are required' });
    }

    const trip = await Trip.findById(tripId).populate('routeId').populate('busId');
    if (!trip) return res.status(404).json({ success: false, error: 'Trip not found' });

    const isInsurance = Boolean(insuranceOpted === true || insuranceOpted === 'true' || insuranceOpted === 1);
    const finalPhone = contactPhone || contactDetails?.phone || req.user.phone || '9876543210';
    const finalEmail = contactEmail || contactDetails?.email || req.user.email || 'passenger@rupadiya.test';

    const formattedPassengers = (passengers && passengers.length > 0)
      ? passengers.map(p => ({
          seatNumber: String(p.seatNumber).trim(),
          name: p.name || 'Passenger',
          age: Number(p.age || 25),
          gender: p.gender || 'male',
          fare: trip.baseFare || 510
        }))
      : normalizedSeats.map(num => ({
          seatNumber: num,
          name: 'Customer Traveler',
          age: 25,
          gender: 'male',
          fare: trip.baseFare || 510
        }));

    // Pre-hold seats via holdStore if not already held with this token
    let token = holdToken;
    if (!token) {
      token = 'HOLD_AGT_' + crypto.randomBytes(8).toString('hex').toUpperCase();
    }

    const existingHold = holdStore.getHold(token);
    if (!existingHold) {
      const holdResult = await holdStore.holdSeats({
        tripId: trip._id.toString(),
        seatNumbers: normalizedSeats,
        passengerDetails: formattedPassengers,
        holdToken: token,
        passengerId: agentId.toString(),
        ttlSeconds: 600
      });
      if (!holdResult.success) {
        return res.status(409).json({
          success: false,
          error: holdResult.message || `Seats [${(holdResult.conflictingSeats || holdResult.conflictedSeats || []).join(', ')}] are already held or booked.`,
          conflictingSeats: holdResult.conflictingSeats || holdResult.conflictedSeats
        });
      }
    }

    // Call unified booking engine (atomic seat lock + wallet debit + ledger + commission distribution)
    const booking = await bookingService.confirmBooking({
      holdToken: token,
      passengerId: agentId,
      contactEmail: finalEmail,
      contactPhone: finalPhone,
      passengers: formattedPassengers,
      boardingPoint,
      droppingPoint,
      paymentProvider: 'agent_wallet',
      referralCode: req.user.referralCode,
      tripId: trip._id.toString(),
      seatNumbers: normalizedSeats,
      insuranceOpted: isInsurance
    });

    const commRecords = await CommissionRecord.find({ bookingId: booking.bookingId }).lean();
    const updatedWallet = await Wallet.findOne({ userId: agentId });

    res.status(201).json({
      success: true,
      message: `Booking #${booking.bookingId} confirmed successfully via Agent Wallet.`,
      booking,
      commissionsEarned: commRecords,
      walletBalance: updatedWallet ? updatedWallet.availableBalance : 0
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, error: err.message });
    }
    next(err);
  }
});

// -------------------------------------------------------------
// 9. TRACK A BUS (UPCOMING TRIPS ONLY)
// -------------------------------------------------------------
router.get('/trips/upcoming', agentOnly, async (req, res, next) => {
  try {
    const now = new Date();
    const query = {
      departureTime: { $gte: now },
      status: 'SCHEDULED'
    };
    if (req.user.companyCode) {
      query.companyCode = req.user.companyCode;
    }

    const trips = await Trip.find(query)
      .populate('routeId')
      .populate('busId')
      .sort({ departureTime: 1 })
      .limit(10);

    const formattedTrips = trips.map(t => {
      const from = (t.routeId?.fromCity?.name === 'Rupadiya' ? 'Rupaidiha' : (t.routeId?.fromCity?.name || 'Rupaidiha'));
      const to = t.routeId?.toCity?.name || 'Lucknow';
      const depTime = t.departureTime ? new Date(t.departureTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '05:30 PM';
      const depDate = t.departureTime ? new Date(t.departureTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Today';

      return {
        _id: t._id,
        tripId: t._id,
        sourceCity: from,
        destinationCity: to,
        departureTime: depTime,
        departureDate: depDate,
        busId: {
          name: t.busId?.name || t.busId?.operatorName || 'Rupadiya Express',
          busNumber: t.busId?.busNumber || 'UP-40-BT-1001',
          busType: t.busId?.busType || 'AC Seater'
        },
        baseFare: t.baseFare,
        availableSeats: t.seats ? t.seats.filter(s => s.status === 'AVAILABLE').length : 40
      };
    });

    res.json({
      success: true,
      count: formattedTrips.length,
      trips: formattedTrips,
      upcomingTrips: formattedTrips,
      data: { trips: formattedTrips }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 10. PROFILE (AGENT DETAILS & PERMITTED EDITING)
// -------------------------------------------------------------
router.get('/profile', agentOnly, async (req, res, next) => {
  try {
    const agent = await User.findById(req.user._id).select('-passwordHash');
    const wallet = await getOrCreateAgentWallet(agent._id, agent.companyCode);

    const profileData = {
      name: agent.name,
      agentCode: agent.referralCode || 'RUP-AGENT-7749',
      agencyName: agent.agencyName || 'Rupadiya Intercity Travels',
      phone: agent.phone,
      email: agent.email,
      address: agent.address || '',
      city: agent.city || '',
      state: agent.state || '',
      panNumber: agent.panNumber || '',
      aadharNumber: agent.aadharNumber || '',
      createdAt: agent.createdAt,
      kycStatus: agent.kycStatus || 'VERIFIED',
      agentLevel: agent.agentLevel || 'SILVER',
      customCashbackPercent: agent.customCashbackPercent || 2.0,
      walletBalance: wallet.availableBalance,
      serviceCharges: agent.serviceCharges || {
        bookingCharge: 20,
        bookingChargeType: 'FIXED',
        cancellationCharge: 50,
        cancellationChargeType: 'FIXED'
      }
    };

    res.json({
      success: true,
      profile: profileData,
      data: profileData
    });
  } catch (err) {
    next(err);
  }
});

router.put('/profile', agentOnly, async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const agent = await User.findById(req.user._id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Agent can ONLY change their name as the account was created by company owner
    agent.name = String(name).trim();
    await agent.save();

    const updatedData = {
      name: agent.name,
      agencyName: agent.agencyName,
      address: agent.address,
      city: agent.city,
      state: agent.state,
      panNumber: agent.panNumber,
      aadharNumber: agent.aadharNumber,
      phone: agent.phone,
      email: agent.email,
      agentCode: agent.referralCode
    };

    res.json({
      success: true,
      message: 'Agent name updated successfully.',
      profile: updatedData,
      data: updatedData
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 11. SETTINGS (BOOKING & CANCELLATION CHARGES - MAX 200RS & 50RS/SEAT)
// -------------------------------------------------------------
router.get('/settings', agentOnly, async (req, res, next) => {
  try {
    const agent = await User.findById(req.user._id);
    const serviceCharges = agent.serviceCharges || {
      bookingCharge: 20,
      bookingChargeType: 'FIXED',
      cancellationCharge: 50,
      cancellationChargeType: 'FIXED'
    };
    res.json({
      success: true,
      settings: serviceCharges,
      data: { serviceCharges }
    });
  } catch (err) {
    next(err);
  }
});

router.put('/settings', agentOnly, async (req, res, next) => {
  try {
    const { bookingCharge, cancellationCharge, serviceCharges } = req.body;
    const agent = await User.findById(req.user._id);

    const bCharge = bookingCharge !== undefined ? bookingCharge : serviceCharges?.bookingCharge;
    const cCharge = cancellationCharge !== undefined ? cancellationCharge : serviceCharges?.cancellationCharge;

    // Strict limits: Agent service charge max ₹200, Cancellation fee max ₹50 per seat
    const safeBookingCharge = Math.min(200, Math.max(0, Number(bCharge ?? 20)));
    const safeCancellationCharge = Math.min(50, Math.max(0, Number(cCharge ?? 50)));

    agent.serviceCharges = {
      bookingCharge: safeBookingCharge,
      bookingChargeType: 'FIXED',
      cancellationCharge: safeCancellationCharge,
      cancellationChargeType: 'FIXED'
    };

    await agent.save();

    res.json({
      success: true,
      message: 'Service charge settings saved successfully.',
      settings: agent.serviceCharges,
      data: { serviceCharges: agent.serviceCharges }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 12. REFERRAL NETWORK & REFERRALS LIST (REAL DB DATA)
// -------------------------------------------------------------
router.get('/referrals', agentOnly, async (req, res, next) => {
  try {
    const agentId = req.user._id;
    const agent = await User.findById(agentId);

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Ensure agent has a compliant 12-character unique referral code
    if (!agent.referralCode || agent.referralCode.length !== 12) {
      agent.referralCode = await generateUniqueReferralCode('AGT');
      await agent.save();
    }

    // Direct referred users / sub-agents (real database query)
    const directReferred = await User.find({ referredBy: agentId })
      .select('name agencyName email phone city state role agentLevel createdAt')
      .sort({ createdAt: -1 });

    // Bookings linked to this agent
    const linkedBookings = await Booking.find({ referralAgentId: agentId, status: 'CONFIRMED' })
      .select('bookingId fareBreakdown seatNumbers createdAt status passengerPhone')
      .sort({ createdAt: -1 });

    // Real commission earnings
    const commissions = await CommissionRecord.find({ agentId, status: 'CREDITED' });
    const totalCommissionEarned = commissions.reduce((sum, c) => sum + (c.netCommission || 0), 0);
    const totalVolume = linkedBookings.reduce((sum, b) => sum + (b.fareBreakdown?.totalPayable || b.totalAmount || 0), 0);
    const commissionPercent = agent.customCashbackPercent || 5.0;

    // Real downline list with actual metrics
    const referralList = directReferred.map(u => ({
      id: u._id,
      name: u.name,
      agencyName: u.agencyName || u.name,
      city: u.city || 'Counter Station',
      phone: u.phone,
      tier: 1,
      status: 'Active',
      joinedDate: u.createdAt
    }));

    res.json({
      success: true,
      referralCode: agent.referralCode,
      referralUrl: `https://rupadiya.com/?ref=${agent.referralCode}`,
      agentLevel: agent.agentLevel || 'SILVER',
      commissionPercent,
      stats: {
        totalReferredCount: directReferred.length,
        totalBookings: linkedBookings.length,
        totalVolume,
        totalCommissionEarned
      },
      tiers: [
        { tier: 1, label: 'Tier 1 (Direct Sub-agents)', rate: '5.0%', count: directReferred.length, volume: `₹${totalVolume.toLocaleString('en-IN')}`, earnings: `₹${totalCommissionEarned.toLocaleString('en-IN')}`, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
        { tier: 2, label: 'Tier 2 (Level 2 Sub-agents)', rate: '3.0%', count: 0, volume: '₹0', earnings: '₹0', color: 'text-sky-700 bg-sky-50 border-sky-200' },
        { tier: 3, label: 'Tier 3 (Level 3 Sub-agents)', rate: '2.0%', count: 0, volume: '₹0', earnings: '₹0', color: 'text-purple-700 bg-purple-50 border-purple-200' },
        { tier: 4, label: 'Tier 4 (Level 4 Sub-agents)', rate: '1.0%', count: 0, volume: '₹0', earnings: '₹0', color: 'text-amber-700 bg-amber-50 border-amber-200' },
        { tier: 5, label: 'Tier 5 (Level 5 Sub-agents)', rate: '0.5%', count: 0, volume: '₹0', earnings: '₹0', color: 'text-slate-600 bg-slate-50 border-slate-200' }
      ],
      referrals: referralList
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 13. REFERRAL CODE REFRESH (INVALIDATES PREVIOUS CODE)
// -------------------------------------------------------------
router.post(['/referral-code/refresh', '/referrals/refresh-code'], agentOnly, async (req, res, next) => {
  try {
    const agentId = req.user._id;
    const agent = await User.findById(agentId);

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const oldCode = agent.referralCode;
    if (oldCode) {
      if (!Array.isArray(agent.previousReferralCodes)) {
        agent.previousReferralCodes = [];
      }
      if (!agent.previousReferralCodes.includes(oldCode)) {
        agent.previousReferralCodes.push(oldCode);
      }
    }

    const newCode = await generateUniqueReferralCode('AGT');
    agent.referralCode = newCode;
    agent.referralCodeUpdatedAt = new Date();
    await agent.save();

    res.json({
      success: true,
      referralCode: newCode,
      referralUrl: `https://rupadiya.com/?ref=${newCode}`,
      message: 'New 12-character referral code generated successfully. Your previous code is now permanently invalid.'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
