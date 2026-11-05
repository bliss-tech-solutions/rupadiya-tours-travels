const bookingService = require('./booking.service');
const Booking = require('./booking.model');
const Offer = require('../offers/offer.model');
const holdStore = require('../../config/holdStore');
const websocketService = require('../../services/websocket.service');
const { validateSeatHoldRequest } = require('../../config/validation');

class BookingController {
  async quote(req, res, next) {
    try {
      const { tripId, seatNumbers, offerCode } = req.body;
      if (!tripId || !Array.isArray(seatNumbers) || seatNumbers.length === 0) {
        return res.status(400).json({ error: 'tripId and seatNumbers are required' });
      }

      const quote = await bookingService.calculateQuote({ tripId, seatNumbers, offerCode });
      res.json({ success: true, quote });
    } catch (err) {
      next(err);
    }
  }

  async hold(req, res, next) {
    try {
      const validation = validateSeatHoldRequest(req.body);
      if (!validation.isValid) {
        return res.status(400).json({ error: validation.errors.join(', ') });
      }

      const { tripId, seatNumbers, passengers, referralCode } = req.body;
      const passengerId = req.user ? req.user._id : null;
      const tabId = req.tabId || req.body.tabId || req.headers['x-tab-id'] || null;

      const hold = await bookingService.holdSeats({
        tripId,
        seatNumbers,
        passengers,
        passengerId,
        referralCode,
        tabId,
        browserSessionId: req.browserSessionId
      });

      res.status(201).json({ success: true, ...hold });
    } catch (err) {
      next(err);
    }
  }

  async getHoldStatus(req, res, next) {
    try {
      const { holdToken } = req.params;
      const hold = holdStore.getHold(holdToken);
      if (!hold) {
        return res.status(404).json({ success: false, error: 'Hold expired or not found' });
      }
      res.json({ success: true, hold });
    } catch (err) {
      next(err);
    }
  }

  async releaseHold(req, res, next) {
    try {
      const token = req.body.holdToken || req.body.holdId || req.params.holdToken;
      const tabId = req.tabId || req.body.tabId || req.headers['x-tab-id'] || null;
      const passengerId = req.user ? req.user._id : null;

      if (token) {
        const hold = holdStore.getHold(token);
        const tripId = hold?.tripId;
        const seatNumbers = hold?.seatNumbers;

        const released = holdStore.releaseHold(token, { tabId, passengerId });
        if (!released && holdStore.getHold(token)) {
          return res.status(403).json({
            success: false,
            error: 'Access Denied: You cannot release a seat hold belonging to another browser tab or session.',
            code: 'HOLD_RELEASE_FORBIDDEN'
          });
        }

        if (released && tripId && seatNumbers && seatNumbers.length > 0) {
          try {
            websocketService.broadcastSeatReleased(tripId.toString(), seatNumbers);
          } catch (wsErr) {
            console.error('[WebSocket] broadcastSeatReleased error:', wsErr.message);
          }
        }
      }
      res.json({ success: true, message: 'Hold released successfully' });
    } catch (err) {
      next(err);
    }
  }

  async confirm(req, res, next) {
    try {
      const holdTokenParam = req.body.holdToken || req.body.holdId;
      const emailParam = req.body.contactEmail || req.body.primaryContact?.email || 'passenger@rupadiya.test';
      const phoneParam = req.body.contactPhone || req.body.primaryContact?.phone;
      const tabId = req.tabId || req.body.tabId || req.headers['x-tab-id'] || null;

      const {
        holdToken = holdTokenParam,
        contactEmail = emailParam,
        contactPhone = phoneParam,
        passengers,
        boardingPoint,
        droppingPoint,
        paymentProvider = 'dummy',
        paymentDetails = { status: 'SUCCESS' },
        referralCode,
        tripId,
        selectedSeats,
        seatNumbers
      } = req.body;

      if (!holdToken && !tripId) {
        return res.status(400).json({ error: 'holdToken or tripId is required' });
      }
      if (!contactEmail || !contactPhone) {
        return res.status(400).json({ error: 'contactEmail and contactPhone are required' });
      }

      // If user is authenticated, use their id; otherwise guest id from contact
      let passengerId = req.user ? req.user._id : null;
      if (!passengerId) {
        // Create or find a guest user by phone or email without requiring sign-in
        const User = require('../users/user.model');
        const cleanPhone = contactPhone ? contactPhone.replace(/\D/g, '') : null;
        let guestUser = await User.findOne({
          $or: [
            ...(cleanPhone ? [{ phone: cleanPhone }] : []),
            { email: contactEmail.toLowerCase() }
          ]
        });
        if (!guestUser) {
          guestUser = await User.create({
            name: passengers?.[0]?.name || 'Guest Passenger',
            email: contactEmail.toLowerCase(),
            phone: cleanPhone || '9999999999',
            passwordHash: 'guest-no-login',
            role: 'PASSENGER'
          });
        }
        passengerId = guestUser._id;
      }

      const booking = await bookingService.confirmBooking({
        holdToken: holdToken || req.body.holdId,
        passengerId,
        contactEmail,
        contactPhone,
        passengers,
        boardingPoint,
        droppingPoint,
        paymentProvider,
        paymentDetails,
        referralCode,
        tabId,
        tripId: tripId || req.body.tripId,
        seatNumbers: selectedSeats || seatNumbers || req.body.selectedSeats || req.body.seatNumbers,
        insuranceOpted: Boolean(req.body.insuranceOpted === true || req.body.insuranceOpted === 'true' || req.body.insuranceOpted === 1),
        insuranceAmount: req.body.insuranceAmount
      });

      // Only return legitimate active promotional offer from database
      const activeOffer = await Offer.findOne({
        isActive: true,
        validUntil: { $gte: new Date() }
      }).lean();

      const cashbackCoupon = activeOffer ? {
        code: activeOffer.code,
        discountAmount: activeOffer.maxDiscountAmount || 100,
        minBookingAmount: activeOffer.minBookingAmount || 500,
        title: activeOffer.title || 'Promotional Offer',
        description: activeOffer.description || 'Special offer for your journey'
      } : null;

      res.status(201).json({ success: true, booking, cashbackCoupon });
    } catch (err) {
      next(err);
    }
  }

  async getMine(req, res, next) {
    try {
      const orFilter = [{ passengerId: req.user._id }];
      if (req.user.role === 'AGENT') {
        orFilter.push({ referralAgentId: req.user._id });
      }
      if (req.user.phone) {
        orFilter.push({ 'contactDetails.phone': req.user.phone });
      }
      if (req.user.email) {
        orFilter.push({ 'contactDetails.email': req.user.email.toLowerCase() });
      }

      const bookings = await Booking.find({ $or: orFilter })
        .populate({
          path: 'tripId',
          populate: [
            { path: 'routeId' },
            { path: 'busId' }
          ]
        })
        .populate('routeId')
        .populate('busId')
        .sort({ createdAt: -1 });

      const enriched = bookings.map(doc => {
        const b = doc.toObject();
        b.trip = b.tripId;
        b.bus = b.busId || b.tripId?.busId;
        b.route = b.routeId || b.tripId?.routeId;
        b.totalAmount = b.fareBreakdown?.totalPayable ?? b.totalAmount ?? 0;
        b.totalFare = b.totalAmount;
        b.seats = b.seatNumbers?.map(num => ({ seatNumber: num })) || (b.passengers?.map(p => ({ seatNumber: p.seatNumber })) || []);
        return b;
      });

      res.json({ success: true, count: enriched.length, bookings: enriched, data: enriched });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const { bookingId } = req.params;
      const bookingDoc = await Booking.findOne({
        $or: [{ bookingId }, { pnr: bookingId.toUpperCase() }]
      })
        .populate({
          path: 'tripId',
          populate: [
            { path: 'routeId' },
            { path: 'busId' }
          ]
        })
        .populate('routeId')
        .populate('busId');

      if (!bookingDoc) return res.status(404).json({ error: 'Booking not found' });

      const b = bookingDoc.toObject();
      b.trip = b.tripId;
      b.bus = b.busId || b.tripId?.busId;
      b.route = b.routeId || b.tripId?.routeId;
      b.totalAmount = b.fareBreakdown?.totalPayable ?? b.totalAmount ?? 0;
      b.totalFare = b.totalAmount;
      b.seats = b.seatNumbers?.map(num => ({ seatNumber: num })) || (b.passengers?.map(p => ({ seatNumber: p.seatNumber })) || []);

      // IDOR & Privacy Protection:
      // If requester is not the verified passenger or privileged admin, mask personal data
      const isSuperAdmin = req.user && req.user.role === 'SUPER_ADMIN';
      const isPassenger = req.user && (bookingDoc.passengerId?.toString() === req.user._id.toString());
      const isBookingAgent = req.user && req.user.role === 'AGENT' && (
        bookingDoc.referralAgentId?.toString() === req.user._id.toString() ||
        bookingDoc.passengerId?.toString() === req.user._id.toString()
      );
      const isCompanyOwner = req.user && req.user.role === 'COMPANY_OWNER' && (
        bookingDoc.companyCode === req.user.companyCode ||
        (bookingDoc.companyId && bookingDoc.companyId.toString() === req.user.companyId?.toString())
      );
      const isOwner = Boolean(isSuperAdmin || isPassenger || isBookingAgent || isCompanyOwner);
      const cleanQueryPhone = req.query.phone ? req.query.phone.replace(/\D/g, '') : null;
      const isMatchingPhone = cleanQueryPhone && bookingDoc.contactDetails?.phone === cleanQueryPhone;

      if (!isOwner && !isMatchingPhone) {
        if (b.contactDetails?.phone) {
          const p = b.contactDetails.phone;
          b.contactDetails.phone = p.length >= 10 ? `${p.slice(0, 2)}******${p.slice(-2)}` : '******';
        }
        if (b.contactDetails?.email) {
          const parts = b.contactDetails.email.split('@');
          b.contactDetails.email = `${parts[0].slice(0, 1)}***@${parts[1] || 'rupadiya.com'}`;
        }
        b.isMaskedView = true;
      }

      res.json({ success: true, booking: b });
    } catch (err) {
      next(err);
    }
  }

  async cancel(req, res, next) {
    try {
      const { bookingId } = req.params;
      const { reason } = req.body;

      const booking = await Booking.findOne({ $or: [{ bookingId }, { pnr: bookingId.toUpperCase() }] });
      if (!booking) return res.status(404).json({ error: 'Booking not found' });

      // IDOR Prevention: Verify that the person requesting cancellation owns the booking
      const isSuperAdmin = req.user && req.user.role === 'SUPER_ADMIN';
      const isPassenger = req.user && booking.passengerId?.toString() === req.user._id.toString();
      const isBookingAgent = req.user && req.user.role === 'AGENT' && (
        booking.referralAgentId?.toString() === req.user._id.toString() ||
        booking.passengerId?.toString() === req.user._id.toString()
      );
      const isCompanyOwner = req.user && req.user.role === 'COMPANY_OWNER' && (
        booking.companyCode === req.user.companyCode ||
        (booking.companyId && booking.companyId.toString() === req.user.companyId?.toString())
      );
      const isOwner = Boolean(isSuperAdmin || isPassenger || isBookingAgent || isCompanyOwner);
      const reqPhone = (req.body.contactPhone || req.body.phone || '').replace(/\D/g, '');
      const isPhoneVerified = reqPhone && booking.contactDetails?.phone === reqPhone;

      if (!isOwner && !isPhoneVerified) {
        return res.status(403).json({
          success: false,
          error: 'Access Denied: You must be signed in as the passenger or provide the verified booking contact phone to cancel this reservation.',
          code: 'UNAUTHORIZED_CANCELLATION'
        });
      }

      const result = await bookingService.cancelBooking({
        bookingId,
        reason,
        cancelledByUserId: req.user ? req.user._id : null
      });

      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new BookingController();
