const bookingService = require('./booking.service');
const Booking = require('./booking.model');
const holdStore = require('../../config/holdStore');
const websocketService = require('../../services/websocket.service');
const { validateSeatHoldRequest } = require('../../config/validation');
const { normalisePhone } = require('../../utils/phone');

class BookingController {
  async quote(req, res, next) {
    try {
      const { tripId, seatNumbers, offerCode, couponCode, insuranceOpted, insurancePerPassenger, paymentChannel } = req.body;
      const isAgent = req.user?.role === 'AGENT';
      const agentChargeCap = isAgent ? Math.min(200, Number(req.user.serviceCharges?.bookingCharge ?? 0) || 0) : 0;
      const agentServiceCharge = isAgent
        ? Math.max(0, Math.min(agentChargeCap, Number(req.body.agentServiceCharge ?? agentChargeCap) || 0))
        : 0;
      if (!tripId || !Array.isArray(seatNumbers) || seatNumbers.length === 0 || seatNumbers.length > 6) {
        return res.status(400).json({ error: 'tripId and 1-6 seatNumbers are required' });
      }

      const code = offerCode || couponCode || null;
      // Within an active hold the seat prices are locked to what was shown when the seats were held.
      const hold = req.body.holdToken ? holdStore.getHold(req.body.holdToken) : null;
      const seatFares = hold && String(hold.tripId) === String(tripId) ? hold.seatFares : null;
      const quote = await bookingService.calculateQuote({
        tripId,
        seatNumbers,
        offerCode: code,
        insuranceOpted,
        insurancePerPassenger,
        seatFares,
        paymentChannel: isAgent ? (paymentChannel || 'WALLET') : 'ONLINE',
        agentServiceCharge
      });
      if (code && !quote.appliedOffer) {
        return res.status(400).json({ success: false, error: `Coupon ${String(code).toUpperCase()} is not valid for this booking.`, code: 'INVALID_COUPON', quote });
      }
      res.json({ success: true, quote });
    } catch (err) {
      next(err);
    }
  }

  async hold(req, res, next) {
    try {
      const body = req.body || {};
      // The user website sends the manifest inside passengerContext; the agent portal sends it top-level.
      const passengers = Array.isArray(body.passengers) && body.passengers.length > 0
        ? body.passengers
        : (Array.isArray(body.passengerContext?.passengers) ? body.passengerContext.passengers : undefined);

      const validation = validateSeatHoldRequest({ ...body, passengers });
      if (!validation.isValid) {
        return res.status(400).json({ success: false, error: validation.errors.join(', ') });
      }

      const hold = await bookingService.holdSeats({
        tripId: body.tripId,
        seatNumbers: body.seatNumbers,
        passengers,
        passengerId: req.user ? req.user._id : null,
        actor: req.user || null,
        tabId: req.tabId || req.headers['x-tab-id'] || null,
        clientRef: typeof body.clientRef === 'string' ? body.clientRef : null
      });

      res.status(201).json({ success: true, ...hold });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({
          success: false,
          error: err.message,
          code: err.code,
          conflictingSeats: err.conflictingSeats,
          restrictedSeats: err.restrictedSeats
        });
      }
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

  /**
   * Direct confirmation endpoint.
   * Real money never flows through here: Razorpay tickets are issued by
   * /payments/verify (or the webhook) and agent wallet tickets by
   * /agent/bookings/wallet-pay. This endpoint only serves the development sandbox.
   */
  async confirm(req, res, next) {
    try {
      const body = req.body || {};
      const provider = body.paymentProvider || 'dummy';
      if (provider !== 'dummy') {
        return res.status(400).json({
          success: false,
          error: provider === 'razorpay'
            ? 'Online payments are confirmed automatically after payment verification.'
            : 'Wallet bookings must be made from the agent portal.'
        });
      }

      const booking = await bookingService.confirmBooking({
        holdToken: body.holdToken || body.holdId,
        passengerId: req.user ? req.user._id : null,
        contactEmail: body.contactEmail || body.primaryContact?.email,
        contactPhone: body.contactPhone || body.primaryContact?.phone,
        passengers: body.passengers,
        boardingPoint: body.boardingPoint,
        droppingPoint: body.droppingPoint,
        paymentProvider: 'dummy',
        paymentDetails: body.paymentDetails || { status: 'SUCCESS' },
        referralCode: body.referralCode,
        offerCode: body.offerCode || body.couponCode || null,
        insuranceOpted: body.insuranceOpted === true || body.insuranceOpted === 'true',
        tabId: req.tabId || req.headers['x-tab-id'] || null
      });

      res.status(201).json({ success: true, booking });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, error: err.message, code: err.code });
      }
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
      b.qrToken = require('../../services/ticketQr.service').sign(b.bookingId, String(bookingDoc.tripId?._id || bookingDoc.tripId));

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
      const cleanQueryPhone = req.query.phone ? (normalisePhone(req.query.phone) || req.query.phone.replace(/\D/g, '')) : null;
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
      const rawReqPhone = req.body.contactPhone || req.body.phone || '';
      const reqPhone = normalisePhone(rawReqPhone) || String(rawReqPhone).replace(/\D/g, '');
      const isPhoneVerified = reqPhone && booking.contactDetails?.phone === reqPhone;

      if (!isOwner && !isPhoneVerified) {
        return res.status(403).json({
          success: false,
          error: 'Access Denied: You must be signed in as the passenger or provide the verified booking contact phone to cancel this reservation.',
          code: 'UNAUTHORIZED_CANCELLATION'
        });
      }

      const result = await bookingService.cancelBooking({
        bookingId: booking.bookingId,
        reason,
        cancelledByUserId: req.user ? req.user._id : null
      });

      res.json({ success: true, ...result });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, error: err.message });
      }
      next(err);
    }
  }
}

module.exports = new BookingController();
