const bookingService = require('./booking.service');
const Booking = require('./booking.model');
const holdStore = require('../../config/holdStore');
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

      const hold = await bookingService.holdSeats({
        tripId,
        seatNumbers,
        passengers,
        passengerId,
        referralCode,
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
      if (token) {
        holdStore.releaseHold(token);
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
        tripId: tripId || req.body.tripId,
        seatNumbers: selectedSeats || seatNumbers || req.body.selectedSeats || req.body.seatNumbers
      });

      const cashbackCoupon = {
        code: `NEXTTRIP${Math.floor(100 + Math.random() * 900)}`,
        discountAmount: 150,
        minBookingAmount: 500,
        validDays: 30,
        title: 'Next Journey Cashback',
        description: 'Enjoy ₹150 instant cashback on your next intercity coach or tour booking!'
      };

      res.status(201).json({ success: true, booking, cashbackCoupon });
    } catch (err) {
      next(err);
    }
  }

  async getMine(req, res, next) {
    try {
      const orFilter = [{ passengerId: req.user._id }];
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

      res.json({ success: true, booking: b });
    } catch (err) {
      next(err);
    }
  }

  async cancel(req, res, next) {
    try {
      const { bookingId } = req.params;
      const { reason } = req.body;

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
