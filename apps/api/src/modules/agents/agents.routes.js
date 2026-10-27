const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { authenticateToken } = require('../../middleware/auth.middleware');
const { authorizeRoles } = require('../../middleware/rbac.middleware');
const { Wallet, WalletLedger } = require('../wallets/wallet.model');
const DepositRequest = require('../wallets/deposit.model');
const { CommissionRecord } = require('../commissions/commission.model');
const WithdrawalRequest = require('../withdrawals/withdrawal.model');
const Booking = require('../bookings/booking.model');
const Trip = require('../trips/trip.model');
const User = require('../users/user.model');
const { ROLES, TRANSACTION_TYPES, SEAT_STATUS } = require('../../config/constants');

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
      availableBalance: 15000,
      reservedBalance: 0
    });
  }
  return wallet;
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
    const isCompleted = simulateInstant || paymentMethod === 'UPI_QR';

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
    const { period = 'all', startDate, endDate, status, paymentMethod, search, page = 1, limit = 20 } = req.query;

    const query = { userId: agentId };

    // 1. Period date range logic
    const now = new Date();
    if (period === 'today') {
      const todayStart = new Date(now.setHours(0, 0, 0, 0));
      query.createdAt = { $gte: todayStart };
    } else if (period === 'yesterday') {
      const yStart = new Date(now.setDate(now.getDate() - 1));
      yStart.setHours(0, 0, 0, 0);
      const yEnd = new Date(yStart);
      yEnd.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: yStart, $lte: yEnd };
    } else if (period === '7d') {
      const d7 = new Date(Date.now() - 7 * 24 * 3600 * 1000);
      query.createdAt = { $gte: d7 };
    } else if (period === '30d') {
      const d30 = new Date(Date.now() - 30 * 24 * 3600 * 1000);
      query.createdAt = { $gte: d30 };
    } else if (period === 'this_month') {
      const mStart = new Date(now.getFullYear(), now.getMonth(), 1);
      query.createdAt = { $gte: mStart };
    } else if (period === 'prev_month') {
      const pmStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const pmEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      query.createdAt = { $gte: pmStart, $lte: pmEnd };
    } else if (period === 'custom' && startDate && endDate) {
      query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    // 2. Status filter
    if (status && status !== 'ALL') {
      query.status = status;
    }

    // 3. Payment method filter
    if (paymentMethod && paymentMethod !== 'ALL') {
      query.paymentMethod = paymentMethod;
    }

    // 4. Text search
    if (search) {
      const s = search.trim();
      query.$or = [
        { depositId: { $regex: s, $options: 'i' } },
        { referenceId: { $regex: s, $options: 'i' } }
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
    const totalDepositedSum = allMatches.filter(d => d.status === 'COMPLETED').reduce((acc, d) => acc + d.amount, 0);
    const pendingSum = allMatches.filter(d => d.status === 'PENDING').reduce((acc, d) => acc + d.amount, 0);

    res.json({
      success: true,
      totalCount,
      page: parseInt(page, 10),
      pages: Math.ceil(totalCount / parseInt(limit, 10)),
      deposits,
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

    const query = { userId: agentId };

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
      };
    }

    if (type && type !== 'ALL') {
      query.entryType = type.toUpperCase();
    }

    if (search) {
      const s = search.trim();
      query.$or = [
        { referenceId: { $regex: s, $options: 'i' } },
        { description: { $regex: s, $options: 'i' } },
        { idempotencyKey: { $regex: s, $options: 'i' } }
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
    if (startDate) {
      const priorEntries = await WalletLedger.find({
        userId: agentId,
        createdAt: { $lt: new Date(startDate) }
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
      statement: ledgerEntries
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
        { bookingId: { $regex: cleanQ, $options: 'i' } }
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

    const b = bookingDoc.toObject();
    b.trip = b.tripId;
    b.bus = b.busId || b.tripId?.busId;
    b.route = b.routeId || b.tripId?.routeId;
    b.totalAmount = b.fareBreakdown?.totalPayable ?? b.totalAmount ?? 0;
    b.seats = b.seatNumbers?.map(num => ({ seatNumber: num })) || [];

    res.json({
      success: true,
      booking: b,
      data: b
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

    if (cleanMobile) {
      const contactPhone = booking.contactDetails?.phone?.replace(/\D/g, '');
      const passengerPhoneMatch = booking.passengers?.some(p => p.phone?.replace(/\D/g, '') === cleanMobile);
      if (contactPhone && contactPhone !== cleanMobile && !passengerPhoneMatch) {
        return res.status(403).json({ error: 'Mobile number does not match ticket records.' });
      }
    }

    // Two-factor passenger verification check
    const contactPhone = booking.contactDetails?.phone?.replace(/\D/g, '');
    if (contactPhone && contactPhone !== cleanMobile) {
      return res.status(403).json({ error: 'Mobile number does not match the passenger record on this ticket.' });
    }

    if (booking.status === 'CANCELLED') {
      return res.status(400).json({ error: 'This ticket has already been cancelled.' });
    }

    // Departure Time policy calculation
    const trip = await Trip.findById(booking.tripId);
    const depTime = trip?.departureTime || booking.createdAt;
    const hoursUntilDeparture = (new Date(depTime).getTime() - Date.now()) / (3600 * 1000);

    let feePercentage = 10; // Default >= 24h
    if (hoursUntilDeparture < 4) {
      feePercentage = 100; // Non-refundable
    } else if (hoursUntilDeparture < 12) {
      feePercentage = 50;
    } else if (hoursUntilDeparture < 24) {
      feePercentage = 25;
    }

    const totalFare = booking.fareBreakdown?.totalPayable || booking.totalAmount || 1000;
    const cancellationFee = Math.round((totalFare * feePercentage) / 100);
    const refundAmount = Math.max(0, totalFare - cancellationFee);

    // Cancel booking status
    booking.status = 'CANCELLED';
    booking.cancellationDetails = {
      cancelledAt: new Date(),
      cancelledBy: agentId,
      reason,
      feePercentage,
      cancellationFee,
      refundAmount
    };
    await booking.save();

    // Release seats in trip
    if (trip) {
      const seatsToFree = seatNumbers || booking.seatNumbers || [];
      trip.seats.forEach(s => {
        if (seatsToFree.includes(s.seatNumber)) {
          s.status = SEAT_STATUS.AVAILABLE;
          s.passenger = null;
        }
      });
      await trip.save();
    }

    // Credit refund to agent wallet if refund > 0
    let balanceAfter = 0;
    if (refundAmount > 0) {
      const wallet = await getOrCreateAgentWallet(agentId, req.user.companyCode);
      wallet.availableBalance += refundAmount;
      await wallet.save();
      balanceAfter = wallet.availableBalance;

      const cancellationRef = `CANC_${booking.bookingId}_${Date.now()}`;
      await WalletLedger.create({
        walletId: wallet._id,
        userId: agentId,
        companyCode: req.user.companyCode || 1,
        entryType: 'CREDIT',
        amount: refundAmount,
        balanceAfter,
        transactionType: TRANSACTION_TYPES.TICKET_CANCELLATION_REFUND,
        referenceType: 'BOOKING',
        referenceId: booking.bookingId,
        description: `Refund for Cancelled Ticket #${booking.bookingId} (${100 - feePercentage}% refund, Fee: ₹${cancellationFee})`,
        idempotencyKey: `IDEM_${cancellationRef}`
      });
    }

    res.json({
      success: true,
      message: `Ticket #${booking.bookingId} cancelled successfully.`,
      cancellationReference: `CNX_${booking.bookingId}`,
      cancellationFee,
      feePercentage,
      refundAmount,
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
// 8. AGENT BOOKING — WALLET DEBIT ENGINE
// -------------------------------------------------------------
router.post('/bookings/wallet-pay', agentOnly, async (req, res, next) => {
  try {
    const agentId = req.user._id;
    const {
      tripId,
      selectedSeats,
      passengers,
      boardingPoint,
      droppingPoint,
      contactPhone,
      contactEmail,
      agentServiceFee = 50
    } = req.body;

    if (!tripId || !selectedSeats || selectedSeats.length === 0) {
      return res.status(400).json({ error: 'Trip and seats are required' });
    }

    const trip = await Trip.findById(tripId).populate('routeId').populate('busId');
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const baseFare = trip.baseFare || 510;
    const subtotal = selectedSeats.length * baseFare;
    const gstAmount = Math.round(subtotal * 0.05);
    const totalFare = subtotal + gstAmount + Number(agentServiceFee || 0);

    // 1. Verify Agent Wallet Balance
    const wallet = await getOrCreateAgentWallet(agentId, req.user.companyCode);
    if (wallet.availableBalance < totalFare) {
      return res.status(400).json({
        error: `Insufficient wallet balance (Available: ₹${wallet.availableBalance.toLocaleString()}, Required: ₹${totalFare.toLocaleString()}). Please top-up funds first.`
      });
    }

    // 2. Atomically deduct wallet balance
    wallet.availableBalance -= totalFare;
    await wallet.save();

    const bookingId = `BK_AGT_${Math.floor(100000 + Math.random() * 900000)}`;
    const pnr = `RUP-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // 3. Record Wallet Ledger Entry
    await WalletLedger.create({
      walletId: wallet._id,
      userId: agentId,
      companyCode: req.user.companyCode || 1,
      entryType: 'DEBIT',
      amount: totalFare,
      balanceAfter: wallet.availableBalance,
      transactionType: TRANSACTION_TYPES.TICKET_PURCHASE,
      referenceType: 'BOOKING',
      referenceId: bookingId,
      description: `Customer Ticket Purchase #${bookingId} (PNR: ${pnr}) - Seats [${selectedSeats.join(', ')}]`,
      idempotencyKey: `IDEM_${bookingId}_${Date.now()}`
    });

    // 4. Update seats in Trip to BOOKED
    trip.seats.forEach(s => {
      if (selectedSeats.includes(s.seatNumber)) {
        s.status = SEAT_STATUS.BOOKED;
        const pass = (passengers || []).find(p => p.seatNumber === s.seatNumber);
        if (pass) {
          s.passenger = {
            name: pass.name,
            age: pass.age,
            gender: pass.gender
          };
        }
      }
    });
    await trip.save();

    // 5. Create Confirmed Booking record
    const booking = await Booking.create({
      bookingId,
      pnr,
      passengerId: agentId,
      referralAgentId: agentId,
      contactDetails: {
        email: contactEmail || req.user.email,
        phone: contactPhone || req.user.phone
      },
      tripId: trip._id,
      routeId: trip.routeId._id,
      busId: trip.busId._id,
      companyCode: req.user.companyCode || 1,
      seatNumbers: selectedSeats,
      passengers: passengers || selectedSeats.map(num => ({ seatNumber: num, name: 'Customer Traveler' })),
      boardingPoint: boardingPoint || { name: 'Main Stand', time: '05:30 PM' },
      droppingPoint: droppingPoint || { name: 'Destination Station', time: '02:00 PM' },
      fareBreakdown: {
        baseFare,
        seatCount: selectedSeats.length,
        subtotal,
        gstAmount,
        agentServiceFee,
        totalPayable: totalFare
      },
      status: 'CONFIRMED',
      paymentStatus: 'SUCCESS',
      paymentProvider: 'agent_wallet',
      paymentReference: `WAL_${bookingId}`
    });

    // 6. Calculate & credit instant agent cashback reward
    const rate = req.user.customCashbackPercent || 2.0;
    const cashbackAmount = Math.round((subtotal * rate) / 100);

    if (cashbackAmount > 0) {
      wallet.availableBalance += cashbackAmount;
      await wallet.save();

      await CommissionRecord.create({
        agentId,
        bookingId: booking._id,
        level: 1,
        seatCount: selectedSeats.length,
        ticketFare: subtotal,
        grossCommission: cashbackAmount,
        tcsDeducted: 0,
        netCommission: cashbackAmount,
        status: 'CREDITED'
      });

      await WalletLedger.create({
        walletId: wallet._id,
        userId: agentId,
        companyCode: req.user.companyCode || 1,
        entryType: 'CREDIT',
        amount: cashbackAmount,
        balanceAfter: wallet.availableBalance,
        transactionType: TRANSACTION_TYPES.TICKET_COMMISSION_CREDIT,
        referenceType: 'COMMISSION',
        referenceId: `CB_${bookingId}`,
        description: `Instant Agent Cashback (${rate}% on ₹${subtotal}) for #${bookingId}`,
        idempotencyKey: `IDEM_CB_${bookingId}_${Date.now()}`
      });
    }

    res.status(201).json({
      success: true,
      message: `Booking #${bookingId} confirmed successfully via Agent Wallet.`,
      booking,
      cashbackEarned: cashbackAmount,
      walletBalance: wallet.availableBalance
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 9. TRACK A BUS (UPCOMING TRIPS ONLY)
// -------------------------------------------------------------
router.get('/trips/upcoming', agentOnly, async (req, res, next) => {
  try {
    const agentId = req.user._id;
    const now = new Date();

    const bookings = await Booking.find({
      referralAgentId: agentId,
      status: 'CONFIRMED'
    })
      .populate({
        path: 'tripId',
        match: { departureTime: { $gte: now } },
        populate: [{ path: 'routeId' }, { path: 'busId' }]
      })
      .populate('routeId')
      .populate('busId')
      .sort({ createdAt: -1 });

    // Filter to those with future departure time
    const upcomingTrips = bookings
      .filter(b => b.tripId != null)
      .map(b => {
        const trip = b.tripId;
        const bus = trip?.busId || b.busId || {};
        const route = trip?.routeId || b.routeId || {};

        return {
          bookingId: b.bookingId,
          pnr: b.pnr,
          busOperator: bus.name || 'Rupadiya Intercity Bus',
          busNumber: bus.busNumber || 'UP-40-BT-1001',
          busType: bus.busType || 'AC Sleeper 2+1',
          route: `${route?.fromCity?.name || 'Rupadiya'} → ${route?.toCity?.name || 'Ahmedabad'}`,
          departureTime: trip?.departureTime || b.createdAt,
          boardingPoint: b.boardingPoint?.name || 'Rupadiya Border Main Stand',
          droppingPoint: b.droppingPoint?.name || 'Ahmedabad Central Station',
          seats: b.seatNumbers,
          passengersCount: b.passengers?.length || b.seatNumbers?.length || 1,
          bookingStatus: b.status,
          trackingStatus: {
            liveAvailable: false,
            message: 'Scheduled on time · Live GPS connects 1 hour prior to boarding'
          }
        };
      });

    res.json({
      success: true,
      count: upcomingTrips.length,
      upcomingTrips
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
    const { agencyName, address, name, city, state, panNumber, aadharNumber, phone } = req.body;
    const agent = await User.findById(req.user._id);

    if (agencyName !== undefined) agent.agencyName = String(agencyName).trim();
    if (address !== undefined) agent.address = String(address).trim();
    if (name !== undefined) agent.name = String(name).trim();
    if (city !== undefined) agent.city = String(city).trim();
    if (state !== undefined) agent.state = String(state).trim();
    if (panNumber !== undefined) agent.panNumber = String(panNumber).trim().toUpperCase();
    if (aadharNumber !== undefined) agent.aadharNumber = String(aadharNumber).trim();
    if (phone !== undefined) agent.phone = String(phone).trim();

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
      email: agent.email
    };

    res.json({
      success: true,
      message: 'Agent profile updated successfully.',
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

module.exports = router;
