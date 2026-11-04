const crypto = require('crypto');
const Trip = require('../trips/trip.model');
const Route = require('../routes/route.model');
const Bus = require('../fleet/bus.model');
const User = require('../users/user.model');
const Booking = require('./booking.model');
const Company = require('../companies/company.model');
const Refund = require('../payments/refund.model');
const Offer = require('../offers/offer.model');
const holdStore = require('../../config/holdStore');
const commissionService = require('../commissions/commission.service');
const taxService = require('../tax/tax.service');
const websocketService = require('../../services/websocket.service');
const { Wallet, WalletLedger } = require('../wallets/wallet.model');
const { TRANSACTION_TYPES, SEAT_STATUS, BOOKING_STATUS, PAYMENT_STATUS, REFUND_STATUS } = require('../../config/constants');
const dummyPayment = require('../../providers/payments/DummyPaymentProvider');
const razorpayPayment = require('../../providers/payments/RazorpayProvider');
const env = require('../../config/env');

class BookingService {
  /**
   * Quote fare for selected seats
   */
  async calculateQuote({ tripId, seatNumbers, offerCode, insuranceOpted = false }) {
    const trip = await Trip.findById(tripId);
    if (!trip) throw new Error('Trip not found');

    const seatCount = seatNumbers.length;
    const baseFare = trip.baseFare;
    const subtotal = baseFare * seatCount;
    const gstAmount = Math.round(subtotal * env.GST_RATE);
    const isInsurance = Boolean(insuranceOpted === true || insuranceOpted === 'true' || insuranceOpted === 1);
    const insuranceAmount = isInsurance ? (seatCount * 5) : 0;

    let discountAmount = 0;
    let appliedOffer = null;

    if (offerCode) {
      const offer = await Offer.findOne({
        code: offerCode.toUpperCase(),
        isActive: true,
        validUntil: { $gte: new Date() }
      });

      if (offer && subtotal >= offer.minBookingAmount) {
        discountAmount = Math.min(
          Math.round((subtotal * offer.discountPercent) / 100),
          offer.maxDiscountAmount
        );
        appliedOffer = {
          code: offer.code,
          title: offer.title,
          discountAmount
        };
      }
    }

    const totalPayable = subtotal + gstAmount + insuranceAmount - discountAmount;

    return {
      tripId,
      seatNumbers,
      seatCount,
      baseFare,
      subtotal,
      gstAmount,
      insuranceOpted: isInsurance,
      insuranceAmount,
      discountAmount,
      appliedOffer,
      totalPayable
    };
  }

  /**
   * Atomic 10-minute seat hold with dynamic adjacent female preference check
   */
  async holdSeats({ tripId, seatNumbers, passengers, passengerId, referralCode }) {
    const trip = await Trip.findById(tripId).populate('routeId').populate('busId');
    if (!trip) throw new Error('Trip not found');

    // Identify which booked seats have female passengers
    const femaleBookedSeats = new Set();
    trip.seats.forEach(s => {
      if (s.status === SEAT_STATUS.BOOKED && s.passenger && s.passenger.gender === 'female') {
        femaleBookedSeats.add(s.seatNumber);
      }
    });

    const requestedSet = new Set(seatNumbers.map(s => s.toString()));

    const normalizedSeatNumbers = [];

    // 1. Verify each seat exists, isn't booked, and satisfies adjacent female preference
    for (const rawSeatNum of seatNumbers) {
      const seat = trip.seats.find(s => s.seatNumber === rawSeatNum.toString())
        || trip.seats.find(s => s.seatNumber.toLowerCase() === rawSeatNum.toString().toLowerCase())
        || trip.seats.find(s => s.seatNumber.replace(/\D/g, '') === rawSeatNum.toString().replace(/\D/g, ''));

      if (!seat) throw new Error(`Seat ${rawSeatNum} does not exist on this bus.`);
      const seatNum = seat.seatNumber;
      normalizedSeatNumbers.push(seatNum);

      if (seat.status === SEAT_STATUS.BOOKED || seat.status === SEAT_STATUS.BLOCKED) {
        throw new Error(`Seat ${seatNum} is already booked.`);
      }

      // Check dynamic female preference:
      const adjacentNum = Trip.getAdjacentSeatNumber(seatNum);
      const isAdjacentToBookedFemale = adjacentNum && femaleBookedSeats.has(adjacentNum);

      // If adjacent seat was previously booked by an independent female stranger
      if (isAdjacentToBookedFemale) {
        const pass = (passengers || []).find(p => p.seatNumber === rawSeatNum.toString() || p.seatNumber === seatNum);
        if (pass && pass.gender && pass.gender.toLowerCase() === 'male') {
          throw new Error(
            `Seat ${seatNum} is adjacent to a seat booked by a female passenger. ` +
            `To ensure safety and comfort, this seat is reserved for female passengers only.`
          );
        }
      }
    }

    // 2. Atomic hold in holdStore
    const holdToken = `HOLD_${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    const holdResult = await holdStore.holdSeats({
      tripId: tripId.toString(),
      seatNumbers: normalizedSeatNumbers,
      passengerDetails: passengers || [],
      holdToken,
      ttlSeconds: env.HOLD_DURATION_SECONDS
    });

    if (!holdResult.success) {
      const err = new Error(holdResult.message);
      err.statusCode = 409;
      err.conflictingSeats = holdResult.conflictingSeats;
      throw err;
    }

    // 3. Generate fare quote
    const quote = await this.calculateQuote({ tripId, seatNumbers });

    try {
      websocketService.broadcastSeatHeld(tripId.toString(), normalizedSeatNumbers, holdResult.expiresAt);
    } catch (e) {}

    return {
      success: true,
      holdToken,
      expiresAt: holdResult.expiresAt,
      ttlRemainingSeconds: holdResult.ttlRemainingSeconds,
      trip: {
        id: trip._id,
        route: trip.routeId,
        bus: trip.busId,
        departureTime: trip.departureTime,
        arrivalTime: trip.arrivalTime
      },
      quote
    };
  }

  /**
   * Confirm booking and finalize ticket
   */
  async confirmBooking({
    holdToken,
    passengerId,
    contactEmail,
    contactPhone,
    passengers,
    boardingPoint,
    droppingPoint,
    paymentProvider = 'dummy',
    paymentDetails = {},
    referralCode,
    tripId,
    seatNumbers,
    insuranceOpted = false,
    insuranceAmount
  }) {
    // 1. Validate hold token or recover from database if memory was cleared
    let hold = holdToken ? holdStore.getHold(holdToken) : null;
    if (!hold) {
      const targetTripId = tripId || (passengers?.[0]?.tripId);
      const targetSeats = (seatNumbers || (passengers || []).map(p => p.seatNumber)).filter(Boolean);

      if (targetTripId && targetSeats.length > 0) {
        const tripCheck = await Trip.findById(targetTripId);
        if (tripCheck) {
          const bookedConflict = tripCheck.seats.filter(s => 
            targetSeats.map(String).includes(s.seatNumber.toString()) && 
            (s.status === SEAT_STATUS.BOOKED || s.status === SEAT_STATUS.BLOCKED)
          );

          if (bookedConflict.length === 0) {
            // Seats are available in database, re-hold safely
            const tokenToUse = holdToken || `HOLD_${Date.now()}`;
            await holdStore.holdSeats({
              tripId: targetTripId.toString(),
              seatNumbers: targetSeats.map(s => s.toString()),
              passengerDetails: passengers || [],
              holdToken: tokenToUse,
              ttlSeconds: env.HOLD_DURATION_SECONDS || 600
            });
            hold = holdStore.getHold(tokenToUse);
          } else {
            const err = new Error(`Seats [${bookedConflict.map(s => s.seatNumber).join(', ')}] have already been booked by another passenger.`);
            err.statusCode = 409;
            throw err;
          }
        }
      }
    }

    if (!hold) {
      const err = new Error('Your 10-minute seat reservation has expired. Please choose your seats again.');
      err.statusCode = 410;
      throw err;
    }

    const trip = await Trip.findById(hold.tripId).populate('routeId').populate('busId');
    if (!trip) throw new Error('Scheduled trip was not found');

    // Ensure valid passengerId without requiring user login
    if (!passengerId) {
      const User = require('../users/user.model');
      const email = (contactEmail || 'guest@rupadiya.test').toLowerCase();
      const cleanPhone = contactPhone ? contactPhone.replace(/\D/g, '') : null;
      let guestUser = await User.findOne({
        $or: [
          ...(cleanPhone ? [{ phone: cleanPhone }] : []),
          { email }
        ]
      });
      if (!guestUser) {
        guestUser = await User.create({
          name: passengers?.[0]?.name || 'Guest Traveler',
          email,
          phone: cleanPhone || '9999999999',
          role: 'PASSENGER',
          passwordHash: 'guest-no-login'
        });
      }
      passengerId = guestUser._id;
    }

    // 2. Process or verify payment
    let paymentVerified = false;
    let paymentRef = '';

    if (paymentProvider === 'agent_wallet') {
      const { Wallet, WalletLedger } = require('../wallets/wallet.model');
      const User = require('../users/user.model');
      
      // Determine agent performing the wallet booking
      let agentUser = null;
      if (passengerId) {
        agentUser = await User.findById(passengerId);
      }
      if (!agentUser && referralCode) {
        const codeUpper = String(referralCode).toUpperCase().trim();
        const expiredOwner = await User.findOne({ previousReferralCodes: codeUpper });
        if (expiredOwner) {
          throw new Error('This referral code has been refreshed and is no longer valid.');
        }
        agentUser = await User.findOne({ referralCode: codeUpper });
      }

      if (!agentUser) {
        throw new Error('Agent authentication or valid referral code required for agent wallet booking.');
      }

      const agentWallet = await Wallet.findOne({ userId: agentUser._id });
      const quoteCheck = await this.calculateQuote({
        tripId: trip._id,
        seatNumbers: hold.seatNumbers,
        insuranceOpted
      });

      const currentBal = agentWallet ? (agentWallet.availableBalance ?? agentWallet.balance ?? 0) : 0;
      if (!agentWallet || currentBal < quoteCheck.totalPayable) {
        throw new Error(`Insufficient agent wallet balance. Required: ₹${quoteCheck.totalPayable}, Available: ₹${currentBal}`);
      }

      // Atomically debit agent wallet
      agentWallet.availableBalance = currentBal - quoteCheck.totalPayable;
      if (agentWallet.balance !== undefined) agentWallet.balance = agentWallet.availableBalance;
      await agentWallet.save();

      paymentRef = `WALLET_TXN_${Date.now()}`;
      await WalletLedger.create({
        walletId: agentWallet._id,
        userId: agentUser._id,
        companyCode: trip.companyCode || 1,
        entryType: 'DEBIT',
        amount: quoteCheck.totalPayable,
        transactionType: TRANSACTION_TYPES.TICKET_PURCHASE,
        referenceType: 'BOOKING',
        referenceId: paymentRef,
        description: `Customer Ticket Booking - Seats [${hold.seatNumbers.join(', ')}]`,
        idempotencyKey: `WALLET_BOOKING_${paymentRef}`,
        balanceAfter: agentWallet.availableBalance
      });

      paymentVerified = true;
      if (!referralAgentId) referralAgentId = agentUser._id;
    } else if (paymentProvider === 'razorpay') {
      let verifyRes = null;
      const Payment = require('../payments/payment.model');

      // 1. Verify against database captured Payment record
      if (paymentDetails?.paymentId && paymentDetails?.orderId) {
        const paymentRecord = await Payment.findOne({
          orderId: paymentDetails.orderId,
          paymentId: paymentDetails.paymentId,
          status: 'CAPTURED'
        });
        if (paymentRecord) {
          verifyRes = { verified: true, transactionId: paymentRecord.paymentId };
        }
      }

      // 2. Cryptographic signature verification with gateway
      if (!verifyRes && paymentDetails?.signature && paymentDetails?.orderId && paymentDetails?.paymentId) {
        verifyRes = await razorpayPayment.verifyPayment(paymentDetails);
      }

      // 3. In development / test mode only, allow simulation if gateway not configured
      const isDevSimulation = process.env.NODE_ENV !== 'production' && (paymentDetails?.verified || paymentDetails?.alreadyVerified);
      if (!verifyRes && isDevSimulation) {
        verifyRes = { verified: true, transactionId: paymentDetails?.paymentId || `SIM_${Date.now()}` };
      }

      if (!verifyRes || !verifyRes.verified) {
        throw new Error('Payment verification failed. Booking cannot be confirmed without valid payment verification.');
      }
      paymentVerified = true;
      paymentRef = verifyRes.transactionId || paymentDetails?.paymentId || `RZP_${Date.now()}`;
    } else {
      // Production guard: Dummy provider strictly rejected in production
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Simulated card payments are disabled in production environment.');
      }
      const dummyRes = await dummyPayment.verifyPayment({
        paymentId: paymentDetails.paymentId,
        status: paymentDetails.status || 'SUCCESS'
      });
      if (!dummyRes.verified) {
        throw new Error('Simulated card payment declined.');
      }
      paymentVerified = true;
      paymentRef = dummyRes.transactionId;
    }

    // 3. Mark seats as BOOKED on the Trip document atomically
    for (const seatNum of hold.seatNumbers) {
      const seat = trip.seats.find(s => s.seatNumber === seatNum.toString());
      if (seat) {
        seat.status = SEAT_STATUS.BOOKED;
        const passInfo = (passengers || []).find(p => p.seatNumber === seatNum.toString()) || {};
        seat.passenger = {
          name: passInfo.name || 'Passenger',
          age: passInfo.age || 25,
          gender: passInfo.gender || 'other'
        };
      }
    }
    await trip.save();

    // 4. Calculate final quote
    const quote = await this.calculateQuote({
      tripId: trip._id,
      seatNumbers: hold.seatNumbers,
      insuranceOpted
    });

    const pnr = `RUP-${Math.floor(100000 + Math.random() * 900000)}`;
    const bookingId = `BK_${Date.now()}_${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // Resolve referral agent if provided
    let referralAgentId = null;
    if (referralCode) {
      const User = require('../users/user.model');
      const codeUpper = String(referralCode).toUpperCase().trim();
      const expiredOwner = await User.findOne({ previousReferralCodes: codeUpper });
      if (expiredOwner) {
        throw new Error('This referral code has been refreshed and is no longer valid. Please obtain the new referral code from your sponsor.');
      }
      const agent = await User.findOne({ referralCode: codeUpper });
      if (agent) referralAgentId = agent._id;
    }

    // Safely resolve boarding and dropping point with fallback times
    const depTimeFormatted = new Date(trip.departureTime).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    const arrTimeFormatted = new Date(trip.arrivalTime).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const resolvedBoarding = {
      name: (boardingPoint && boardingPoint.name) || trip.routeId?.boardingPoints?.[0]?.name || 'Main Border Terminal',
      time: (boardingPoint && boardingPoint.time) || depTimeFormatted
    };

    const resolvedDropping = {
      name: (droppingPoint && droppingPoint.name) || trip.routeId?.droppingPoints?.[0]?.name || 'Central Terminal',
      time: (droppingPoint && droppingPoint.time) || arrTimeFormatted
    };

    // 5. Create Booking record
    const booking = new Booking({
      bookingId,
      pnr,
      passengerId,
      contactDetails: {
        email: contactEmail,
        phone: contactPhone
      },
      tripId: trip._id,
      routeId: trip.routeId._id,
      busId: trip.busId._id,
      companyId: trip.companyId || null,
      companyCode: trip.companyCode,
      referralAgentId,
      seatNumbers: hold.seatNumbers,
      passengers: (passengers || []).map(p => ({
        seatNumber: p.seatNumber,
        name: p.name,
        age: p.age,
        gender: p.gender,
        fare: trip.baseFare
      })),
      boardingPoint: resolvedBoarding,
      droppingPoint: resolvedDropping,
      fareBreakdown: {
        baseFare: quote.baseFare,
        seatCount: quote.seatCount,
        subtotal: quote.subtotal,
        gstAmount: quote.gstAmount,
        insuranceAmount: quote.insuranceAmount,
        discountAmount: quote.discountAmount,
        totalPayable: quote.totalPayable
      },
      insuranceOpted: quote.insuranceOpted,
      insurancePremium: quote.insuranceAmount,
      status: BOOKING_STATUS.CONFIRMED,
      paymentStatus: PAYMENT_STATUS.SUCCESS,
      paymentProvider,
      paymentReference: paymentRef
    });

    await booking.save();

    // 6. Release lock from holdStore
    holdStore.releaseHold(holdToken);

    // Record 5% GST in tax_entries table per PDF specification
    try {
      await taxService.recordGstEntry({
        booking,
        subtotal: quote.subtotal,
        gstAmount: quote.gstAmount
      });
    } catch (taxErr) {
      console.error('[TaxEngine GST Error]', taxErr);
    }

    // 7. Calculate and distribute 5-level commissions if booked via an agent
    if (referralAgentId) {
      try {
        const commRecords = await commissionService.distributeCommissions({
          booking,
          trip,
          seatCount: hold.seatNumbers.length
        });
        if (Array.isArray(commRecords)) {
          commRecords.forEach(cr => {
            websocketService.broadcastCommissionEarned(cr.agentId, {
              pnr: booking.pnr,
              level: cr.level,
              grossCommission: cr.grossCommission,
              tcsDeducted: cr.tcsDeducted,
              netCommission: cr.netCommission
            });
          });
        }
      } catch (commErr) {
        console.error('[Commission Engine Error]', commErr);
      }
    }

    // Real-time booking confirmation broadcast via WebSocket hub
    try {
      websocketService.broadcastBookingConfirmed(booking, trip);
    } catch (wsErr) {
      console.error('[WebSocket Broadcast Error]', wsErr);
    }

    // Populate relations for complete ticket view
    await booking.populate([
      { path: 'tripId', populate: [{ path: 'busId' }, { path: 'routeId' }] },
      { path: 'routeId' },
      { path: 'busId' }
    ]);

    const bookingObj = booking.toObject();
    bookingObj.trip = bookingObj.tripId;
    bookingObj.bus = bookingObj.busId;
    bookingObj.route = bookingObj.routeId;
    bookingObj.seats = bookingObj.seatNumbers;
    bookingObj.totalAmount = bookingObj.fareBreakdown?.totalPayable;

    return bookingObj;
  }

  /**
   * Cancel booking with RedBus-style refund calculation, operator fee credit, and gateway refund queuing
   */
  async cancelBooking({ bookingId, reason, cancelledByUserId }) {
    const booking = await Booking.findOne({ $or: [{ bookingId }, { pnr: bookingId }] })
      .populate('tripId');

    if (!booking) throw new Error('Booking not found');
    if (booking.status === BOOKING_STATUS.CANCELLED) {
      throw new Error('This booking is already cancelled');
    }

    const trip = await Trip.findById(booking.tripId);
    if (!trip) throw new Error('Associated trip not found');

    for (const seatNum of booking.seatNumbers) {
      const seat = trip.seats.find(s => s.seatNumber === seatNum.toString());
      if (seat) {
        seat.status = SEAT_STATUS.AVAILABLE;
        seat.passenger = null;
      }
    }
    await trip.save();

    const now = new Date();
    const depTime = new Date(trip.departureTime || trip.departureDate || booking.createdAt);
    const hoursToDep = (depTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    let refundPercent = 0.0;
    if (trip.chartPrepared) {
      // Post-chart manifest generation: 85% cancellation fee (15% refund only)
      refundPercent = 0.15;
    } else if (hoursToDep > 48) {
      refundPercent = 0.90; // > 48h: 90% refund, 10% fee
    } else if (hoursToDep > 24) {
      refundPercent = 0.75; // 24-48h: 75% refund, 25% fee
    } else if (hoursToDep > 12) {
      refundPercent = 0.50; // 12-24h: 50% refund, 50% fee
    } else {
      refundPercent = 0.0;  // < 12h: non-refundable
    }

    const paidTotal = Number(booking.fareBreakdown?.totalPayable || booking.totalAmount || 0);
    const refundAmount = Math.round(paidTotal * refundPercent);
    const cancellationFee = Math.max(0, paidTotal - refundAmount);

    let generatedRefundId = null;

    // 1. Operator Share Settlement: Retained cancellation fee goes directly to Company Owner Wallet
    if (cancellationFee > 0 && booking.companyCode) {
      try {
        const company = await Company.findOne({ $or: [{ companyCode: booking.companyCode }, { code: booking.companyCode }] });
        let ownerUser = null;
        if (company && company.ownerId) {
          ownerUser = await User.findById(company.ownerId);
        }
        if (!ownerUser) {
          ownerUser = await User.findOne({ role: 'COMPANY', companyCode: booking.companyCode });
        }

        if (ownerUser) {
          let ownerWallet = await Wallet.findOne({ userId: ownerUser._id, companyCode: booking.companyCode });
          if (!ownerWallet) {
            ownerWallet = await Wallet.create({
              userId: ownerUser._id,
              companyCode: booking.companyCode,
              balance: 0,
              availableBalance: 0,
              reservedBalance: 0
            });
          }

          ownerWallet.availableBalance += cancellationFee;
          ownerWallet.balance += cancellationFee;
          await ownerWallet.save();

          await WalletLedger.create({
            walletId: ownerWallet._id,
            userId: ownerUser._id,
            companyCode: booking.companyCode,
            entryType: 'CREDIT',
            amount: cancellationFee,
            balanceAfter: ownerWallet.availableBalance,
            transactionType: TRANSACTION_TYPES.CANCELLATION_FEE_OPERATOR_CREDIT,
            referenceType: 'BOOKING',
            referenceId: booking.bookingId,
            description: `Retained cancellation fee for PNR #${booking.pnr} (${Math.round((1 - refundPercent) * 100)}% fee)`,
            idempotencyKey: `OP_CANC_${booking.bookingId}_${Date.now()}`
          });
        }
      } catch (opErr) {
        console.error('[Operator Cancellation Fee Credit Error]:', opErr);
      }
    }

    // 2. Customer / Agent Refund Routing
    const isAgentWallet = booking.paymentProvider === 'agent_wallet';
    if (isAgentWallet && refundAmount > 0) {
      try {
        const wallet = await Wallet.findOne({ userId: booking.passengerId });
        if (wallet) {
          wallet.availableBalance += refundAmount;
          wallet.balance += refundAmount;
          await wallet.save();
          await WalletLedger.create({
            walletId: wallet._id,
            userId: booking.passengerId,
            companyCode: booking.companyCode,
            entryType: 'CREDIT',
            amount: refundAmount,
            balanceAfter: wallet.availableBalance,
            transactionType: TRANSACTION_TYPES.TICKET_CANCELLATION_REFUND,
            referenceType: 'BOOKING',
            referenceId: booking.bookingId,
            description: `Cancellation refund (${Math.round(refundPercent * 100)}%) for PNR #${booking.pnr}`,
            idempotencyKey: `REF_${booking.bookingId}_${Date.now()}`
          });
        }
      } catch (walErr) {
        console.error('[Wallet Refund Error]:', walErr);
      }
      booking.paymentStatus = PAYMENT_STATUS.REFUNDED;
    } else if (!isAgentWallet && refundAmount > 0) {
      // Online Payment Gateway: Queue formal Refund record for Super Admin review & payout
      try {
        const company = await Company.findOne({ $or: [{ companyCode: booking.companyCode }, { code: booking.companyCode }] });
        const refId = `RFND-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        generatedRefundId = refId;

        await Refund.create({
          refundId: refId,
          bookingId: booking._id,
          pnr: booking.pnr,
          companyCode: booking.companyCode,
          companyName: company?.name || `Franchise #${booking.companyCode}`,
          customerName: booking.passengerDetails?.name || 'Customer',
          customerPhone: booking.passengerDetails?.phone || '',
          customerEmail: booking.passengerDetails?.email || '',
          paymentId: booking.paymentReference || null,
          paymentMethod: booking.paymentProvider === 'razorpay' ? 'RAZORPAY' : 'UPI',
          totalFare: paidTotal,
          cancellationFee,
          refundAmount,
          status: REFUND_STATUS.PENDING,
          notes: `Customer cancelled ticket #${booking.pnr}. Reason: ${reason || 'Customer cancellation request'}`
        });

        booking.paymentStatus = PAYMENT_STATUS.REFUND_PENDING;
      } catch (refErr) {
        console.error('[Refund Record Queue Error]:', refErr);
      }
    }

    // 3. Update Booking Model
    booking.status = BOOKING_STATUS.CANCELLED;
    booking.cancellationDetails = {
      cancelledAt: new Date(),
      cancelledBy: cancelledByUserId || null,
      refundAmount,
      cancellationFee,
      refundId: generatedRefundId,
      reason: reason || 'Customer requested cancellation'
    };
    await booking.save();

    // 4. Reverse Multi-tier Commissions and GST Entries
    try {
      await commissionService.reverseCommissions(booking._id);
    } catch (commErr) {
      console.error('[Commission Reversal Error]', commErr);
    }

    try {
      await taxService.reverseBookingGstEntry(booking);
    } catch (taxErr) {
      console.error('[TaxEngine GST Reversal Error]', taxErr);
    }

    // 5. Broadcast WebSocket Seat Released
    try {
      websocketService.broadcastSeatReleased(booking.tripId.toString(), booking.seatNumbers);
    } catch (e) {}

    return {
      success: true,
      booking,
      refundAmount,
      cancellationFee,
      refundPercent: refundPercent * 100,
      refundId: generatedRefundId,
      refundRouting: isAgentWallet ? 'AGENT_WALLET' : (refundAmount > 0 ? 'PENDING_ADMIN_APPROVAL' : 'NON_REFUNDABLE')
    };
  }
}

module.exports = new BookingService();
