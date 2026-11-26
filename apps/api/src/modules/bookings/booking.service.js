const crypto = require('crypto');
const Trip = require('../trips/trip.model');
const User = require('../users/user.model');
const Booking = require('./booking.model');
const SeatReservation = require('./seatReservation.model');
const Company = require('../companies/company.model');
const Refund = require('../payments/refund.model');
const Offer = require('../offers/offer.model');
const holdStore = require('../../config/holdStore');
const commissionService = require('../commissions/commission.service');
const taxService = require('../tax/tax.service');
const websocketService = require('../../services/websocket.service');
const walletLedger = require('../../services/walletLedger.service');
const { assertGenderPolicy } = require('../../services/seatPolicy');
const cashPolicy = require('../../services/cashPolicy.service');
const notificationService = require('../notifications/notification.service');
const ticketQr = require('../../services/ticketQr.service');
const {
  TRANSACTION_TYPES,
  SEAT_STATUS,
  BOOKING_STATUS,
  PAYMENT_STATUS,
  REFUND_STATUS,
  ROLES
} = require('../../config/constants');
const dummyPayment = require('../../providers/payments/DummyPaymentProvider');
const env = require('../../config/env');
const { withTransaction } = require('../../utils/transaction');
const { normalisePhone, PHONE_ERROR } = require('../../utils/phone');

const MAX_SEATS_PER_BOOKING = 6;
const INSURANCE_PER_PASSENGER = 28; // travel insurance is a fixed ₹28 per passenger (yes / no only)
const AGENT_CHARGE_MAX = 200;
const PAYMENT_CHANNELS = ['ONLINE', 'WALLET', 'CASH'];

// Any premium sent by a client is ignored: insurance is either off or ₹28 per passenger.
function normaliseInsurancePremium(insuranceOpted) {
  const opted = insuranceOpted === true || insuranceOpted === 'true' || insuranceOpted === 1;
  return opted ? INSURANCE_PER_PASSENGER : 0;
}

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

const norm = (s) => String(s ?? '').trim();

/** Agents can only sell seats on buses of their own company. */
function assertAgentCompanyScope(agentUser, trip) {
  if (!agentUser || agentUser.role !== ROLES.AGENT) return;
  if (agentUser.companyCode != null && Number(agentUser.companyCode) !== Number(trip.companyCode)) {
    throw httpError('You can only book buses of your own company.', 403, { code: 'AGENT_COMPANY_SCOPE' });
  }
}

/**
 * Resolve requested seat labels against the trip's real seat list.
 * Returns canonical seat numbers in request order.
 */
function resolveSeats(trip, rawSeats) {
  return rawSeats.map((raw) => {
    const wanted = norm(raw);
    const seat = trip.seats.find((s) => s.seatNumber === wanted)
      || trip.seats.find((s) => s.seatNumber.toLowerCase() === wanted.toLowerCase());
    if (!seat) throw httpError(`Seat ${wanted} does not exist on this bus.`, 400);
    return seat;
  });
}

/**
 * Validate and normalise the passenger manifest against the seats being booked.
 * Every seat must have exactly one passenger with a name, age and gender.
 */
function normalisePassengers(seatNumbers, passengers, { required = true } = {}) {
  const list = Array.isArray(passengers) ? passengers : [];
  if (list.length === 0 && !required) return [];

  const bySeat = new Map(list.map((p) => [norm(p.seatNumber).toLowerCase(), p]));
  return seatNumbers.map((seatNumber, idx) => {
    const p = bySeat.get(seatNumber.toLowerCase()) || list[idx];
    if (!p) throw httpError(`Passenger details are missing for seat ${seatNumber}.`, 400);

    const name = String(p.name || '').trim();
    const age = Number(p.age);
    const gender = String(p.gender || '').toLowerCase();

    if (name.length < 2 || name.length > 60) {
      throw httpError(`Please enter a valid passenger name for seat ${seatNumber}.`, 400);
    }
    if (!Number.isInteger(age) || age < 1 || age > 120) {
      throw httpError(`Please enter a valid age (1-120) for seat ${seatNumber}.`, 400);
    }
    if (!['male', 'female', 'other'].includes(gender)) {
      throw httpError(`Please select the passenger gender for seat ${seatNumber}.`, 400);
    }

    // Infants (under 5) travel on this passenger's lap: no seat, no fare.
    const rawInfants = Array.isArray(p.infants) ? p.infants : [];
    if (rawInfants.length > 2) throw httpError(`At most 2 lap infants can travel with the passenger on seat ${seatNumber}.`, 400);
    if (rawInfants.length > 0 && age < 18) throw httpError(`Lap infants must travel with an adult (seat ${seatNumber}).`, 400);
    const infants = rawInfants.map((inf, i) => {
      const iName = String(inf?.name || '').trim();
      const iAge = Number(inf?.age);
      const iGender = String(inf?.gender || '').toLowerCase();
      if (iName.length < 2 || iName.length > 60) throw httpError(`Enter the name of infant ${i + 1} with seat ${seatNumber}.`, 400);
      if (!Number.isInteger(iAge) || iAge < 0 || iAge > 4) {
        throw httpError(`Lap infants must be under 5 years (seat ${seatNumber}). Children 5 and above need their own seat.`, 400);
      }
      if (!['male', 'female', 'other'].includes(iGender)) throw httpError(`Select the gender of infant ${i + 1} with seat ${seatNumber}.`, 400);
      return { name: iName, age: iAge, gender: iGender };
    });

    return { seatNumber, name, age, gender, isChild: age >= 5 && age <= 11, infants };
  });
}

/** Optional emergency contact (name, 10-digit phone, relation). Returns null when not provided. */
function normaliseEmergencyContact(ec) {
  if (!ec || (!ec.name && !ec.phone)) return null;
  const name = String(ec.name || '').trim();
  const phone = normalisePhone(ec.phone, ec.countryCode);
  const relation = String(ec.relation || '').trim();
  if (name.length < 2 || name.length > 60) throw httpError('Enter the emergency contact name.', 400);
  if (!phone) throw httpError(`Enter a valid emergency contact number. ${PHONE_ERROR}`, 400);
  if (relation.length < 2 || relation.length > 30) throw httpError('Enter how the emergency contact is related to the passenger.', 400);
  return { name, phone, relation };
}

function assertTripBookable(trip) {
  if (!trip) throw httpError('Trip not found', 404);
  if (trip.status && !['SCHEDULED', 'BOARDING'].includes(trip.status)) {
    throw httpError(`This trip is ${String(trip.status).toLowerCase()} and is no longer accepting bookings.`, 409);
  }
  if (trip.departureTime && new Date(trip.departureTime).getTime() < Date.now()) {
    throw httpError('This bus has already departed. Please choose another trip.', 409);
  }
}

class BookingService {
  /**
   * Server-authoritative fare quote. Every amount shown to a customer or charged
   * through a gateway / wallet must come from here.
   */
  /**
   * Fare build (decided with RBS): fees are added on top of the ticket fare.
   *   ticket fare (sum of seat fares)
   * + GST            (GST_RATE of fare)
   * + platform fee   (PLATFORM_FEE_RATE of fare)
   * + insurance      (₹28 × passengers, optional yes / no)
   * + agent charge   (agent bookings)
   * − discount
   * + gateway fee    (GATEWAY_FEE_RATE of the online amount; ONLINE channel only)
   *
   * totalPayable  = what the platform collects (gateway charge / wallet debit / cash due at company office)
   * customerTotal = what the customer pays in all (adds the agent charge the agent collects in hand for wallet/cash)
   */
  async calculateQuote({
    tripId,
    seatNumbers,
    offerCode,
    insuranceOpted = false,
    insurancePerPassenger = null,
    seatFares = null,
    paymentChannel = 'ONLINE',
    agentServiceCharge = 0
  }) {
    const trip = await Trip.findById(tripId).select('baseFare companyCode seats');
    if (!trip) throw httpError('Trip not found', 404);

    const seatCount = seatNumbers.length;
    let resolvedSeatFares = [];

    if (Array.isArray(seatFares) && seatFares.length > 0) {
      // Use locked seat fares snapshot from active hold
      const fareMap = new Map(seatFares.map(sf => [String(sf.seatNumber || sf.seat).trim().toUpperCase(), Number(sf.fare)]));
      resolvedSeatFares = seatNumbers.map(sNum => {
        const key = String(sNum).trim().toUpperCase();
        return {
          seatNumber: sNum,
          fare: fareMap.has(key) ? fareMap.get(key) : trip.baseFare
        };
      });
    } else {
      // Resolve from live trip.seats
      resolvedSeatFares = seatNumbers.map(sNum => {
        const key = String(sNum).trim().toUpperCase();
        const found = (trip.seats || []).find(s => String(s.seatNumber).trim().toUpperCase() === key);
        return {
          seatNumber: sNum,
          fare: (found && typeof found.fare === 'number') ? found.fare : trip.baseFare
        };
      });
    }

    const subtotal = resolvedSeatFares.reduce((sum, sf) => sum + sf.fare, 0);
    const baseFare = resolvedSeatFares.length > 0
      ? (resolvedSeatFares.every(sf => sf.fare === resolvedSeatFares[0].fare) ? resolvedSeatFares[0].fare : Math.min(...resolvedSeatFares.map(sf => sf.fare)))
      : trip.baseFare;
    const gstAmount = Math.round(subtotal * env.GST_RATE);
    const platformFee = Math.round(subtotal * env.PLATFORM_FEE_RATE);
    const insurancePremium = normaliseInsurancePremium(insuranceOpted);
    const isInsurance = insurancePremium > 0;
    const insuranceAmount = seatCount * insurancePremium;
    const channel = PAYMENT_CHANNELS.includes(paymentChannel) ? paymentChannel : 'ONLINE';
    // Agent booking charge (the old ₹/seat agent service charge) has been removed platform-wide:
    // the platform fee (5%) is charged instead. Any agentServiceCharge sent by a client is ignored.
    const agentCharge = 0;

    let discountAmount = 0;
    let appliedOffer = null;

    if (offerCode) {
      const offer = await Offer.findOne({
        code: String(offerCode).toUpperCase().trim(),
        isActive: true,
        validUntil: { $gte: new Date() }
      });

      if (offer && subtotal >= offer.minBookingAmount) {
        discountAmount = Math.min(
          Math.round((subtotal * offer.discountPercent) / 100),
          offer.maxDiscountAmount
        );
        appliedOffer = { code: offer.code, title: offer.title, discountAmount };
      }
    }

    // Online: the agent charge is collected through the gateway and later credited to the agent wallet.
    // Wallet / cash: the agent collects it in hand, so it is not part of what the platform collects.
    const chargedViaPlatform = channel === 'ONLINE' ? agentCharge : 0;
    const beforeGateway = Math.max(0, subtotal + gstAmount + platformFee + insuranceAmount + chargedViaPlatform - discountAmount);
    const gatewayFee = channel === 'ONLINE' ? Math.round(beforeGateway * env.GATEWAY_FEE_RATE) : 0;
    const totalPayable = beforeGateway + gatewayFee;
    const customerTotal = totalPayable + (channel === 'ONLINE' ? 0 : agentCharge);

    return {
      paymentChannel: channel,
      platformFee,
      platformFeeRate: env.PLATFORM_FEE_RATE,
      gatewayFee,
      gatewayFeeRate: channel === 'ONLINE' ? env.GATEWAY_FEE_RATE : 0,
      insurancePerPassenger: insurancePremium,
      agentServiceCharge: agentCharge,
      agentChargeCollectedBy: channel === 'ONLINE' ? 'PLATFORM' : 'AGENT',
      customerTotal,
      hasMixedFares: new Set(resolvedSeatFares.map((sf) => sf.fare)).size > 1,
      tripId,
      seatNumbers,
      seatCount,
      seatFares: resolvedSeatFares,
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
   * Validates a referral code. Returns the agent or null. Throws only for codes that
   * were explicitly rotated (so users are told to get the new code before paying).
   */
  async resolveReferralAgent(referralCode, { strict = false } = {}) {
    if (!referralCode) return null;
    const codeUpper = String(referralCode).toUpperCase().trim();
    if (!codeUpper) return null;

    const agent = await User.findOne({ referralCode: codeUpper, role: ROLES.AGENT, isActive: { $ne: false } }).select('_id role isActive');
    if (agent) return agent;

    if (strict) {
      const rotated = await User.findOne({ previousReferralCodes: codeUpper }).select('_id');
      if (rotated) {
        throw httpError('This referral code has been refreshed and is no longer valid. Please get the new code from your agent.', 400, { code: 'REFERRAL_CODE_ROTATED' });
      }
      throw httpError('Invalid referral code.', 400, { code: 'REFERRAL_CODE_INVALID' });
    }
    return null;
  }

  /**
   * Atomic 10-minute seat hold.
   *  - All-or-nothing across the requested seats.
   *  - Enforces the ladies-seat policy when the passenger manifest is supplied.
   *  - `clientRef` is an opaque random id from the caller, echoed in the realtime
   *    SEATS_HELD broadcast so the originating browser recognises its own hold.
   */
  async holdSeats({ tripId, seatNumbers, passengers, passengerId, tabId = null, clientRef = null, actor = null }) {
    if (!Array.isArray(seatNumbers) || seatNumbers.length === 0) {
      throw httpError('Please select at least one seat.', 400);
    }
    if (seatNumbers.length > MAX_SEATS_PER_BOOKING) {
      throw httpError(`Maximum ${MAX_SEATS_PER_BOOKING} seats can be booked in one transaction.`, 400);
    }

    const trip = await Trip.findById(tripId).populate('routeId').populate('busId');
    assertTripBookable(trip);
    assertAgentCompanyScope(actor, trip);

    const seats = resolveSeats(trip, seatNumbers);
    const normalizedSeatNumbers = seats.map((s) => s.seatNumber);

    const unavailable = seats.filter((s) => s.status === SEAT_STATUS.BOOKED || s.status === SEAT_STATUS.BLOCKED);
    if (unavailable.length > 0) {
      throw httpError(
        `Seat${unavailable.length > 1 ? 's' : ''} ${unavailable.map((s) => s.seatNumber).join(', ')} ${unavailable.length > 1 ? 'are' : 'is'} already booked. Please choose another seat.`,
        409,
        { conflictingSeats: unavailable.map((s) => s.seatNumber) }
      );
    }

    // Validate manifest (if supplied at hold time) and the ladies-seat rule.
    const manifest = normalisePassengers(normalizedSeatNumbers, passengers, { required: false });
    if (manifest.length > 0) assertGenderPolicy(trip, manifest);

    const quote = await this.calculateQuote({ tripId: trip._id, seatNumbers: normalizedSeatNumbers });

    const holdToken = `HOLD_${crypto.randomBytes(16).toString('hex').toUpperCase()}`;
    const holdResult = await holdStore.holdSeats({
      tripId: trip._id.toString(),
      seatNumbers: normalizedSeatNumbers,
      passengerDetails: manifest,
      seatFares: quote.seatFares,
      holdToken,
      tabId,
      passengerId: passengerId ? String(passengerId) : null,
      ttlSeconds: env.HOLD_DURATION_SECONDS
    });

    if (!holdResult.success) {
      const conflicts = holdResult.conflictingSeats || [];
      throw httpError(
        conflicts.length
          ? `Seat${conflicts.length > 1 ? 's' : ''} ${conflicts.join(', ')} ${conflicts.length > 1 ? 'are' : 'is'} being booked by another customer right now. Please choose another seat.`
          : holdResult.message,
        409,
        { conflictingSeats: conflicts }
      );
    }

    try {
      websocketService.broadcastSeatHeld(trip._id.toString(), normalizedSeatNumbers, holdResult.expiresAt, clientRef);
    } catch (e) { /* realtime is best-effort */ }

    return {
      success: true,
      holdToken,
      tabId,
      seatNumbers: normalizedSeatNumbers,
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
   * Verifies the caller owns an active hold. Returns the hold record.
   */
  assertHoldOwnership(hold, { passengerId = null, tabId = null } = {}) {
    if (!hold) {
      throw httpError('Your 10-minute seat hold has expired. Please select your seats again.', 410, { code: 'HOLD_EXPIRED' });
    }
    const ownerUser = hold.passengerId ? String(hold.passengerId) : null;
    const caller = passengerId ? String(passengerId) : null;

    if (ownerUser) {
      if (ownerUser !== caller) {
        throw httpError('This seat hold belongs to another session.', 403, { code: 'HOLD_NOT_OWNED' });
      }
      return hold;
    }
    // Guest hold: bound to the browser tab that created it.
    if (hold.tabId && hold.tabId !== tabId) {
      throw httpError('This seat hold belongs to another browser tab.', 403, { code: 'HOLD_NOT_OWNED' });
    }
    return hold;
  }

  /**
   * Confirm booking: converts an active hold into a ticket after payment is secured.
   *
   * paymentProvider:
   *   - 'agent_wallet' : `agentUserId` (authenticated AGENT) is debited atomically.
   *   - 'razorpay'     : `paymentDetails.orderId/paymentId` must reference a CAPTURED
   *                      Payment record that has not been used yet. The record is
   *                      claimed atomically so one payment can never issue two tickets.
   *   - 'dummy'        : development only.
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
    offerCode = null,
    insuranceOpted = false,
    insurancePerPassenger = null,
    emergencyContact = null,
    tabId = null,
    agentUserId = null,
    agentServiceCharge = 0,
    channel = 'USER_WEB',
    trustedPayment = false
  }) {
    // 1. Hold must be alive. A captured gateway payment may outlive an in-memory hold
    //    (server restart / slow gateway); in that case we try to re-acquire the exact
    //    seats, which fails safely if anyone else holds or booked them meanwhile.
    let hold = holdToken ? holdStore.getHold(holdToken) : null;
    if (!hold && trustedPayment && paymentDetails?.recoverSeats?.tripId && paymentDetails.recoverSeats.seatNumbers?.length) {
      const { tripId: rTrip, seatNumbers: rSeats } = paymentDetails.recoverSeats;
      const reHold = await holdStore.holdSeats({
        tripId: String(rTrip),
        seatNumbers: rSeats.map(String),
        passengerDetails: passengers || [],
        holdToken: holdToken || `HOLD_${crypto.randomBytes(16).toString('hex').toUpperCase()}`,
        passengerId: passengerId ? String(passengerId) : null,
        ttlSeconds: 120
      });
      if (reHold.success) hold = holdStore.getHold(reHold.holdToken);
    }

    if (!trustedPayment) {
      this.assertHoldOwnership(hold, { passengerId: agentUserId || passengerId, tabId });
    } else if (!hold) {
      throw httpError('Your seat hold expired before the payment completed.', 410, { code: 'HOLD_EXPIRED' });
    }

    const trip = await Trip.findById(hold.tripId).populate('routeId').populate('busId');
    assertTripBookable(trip);

    const seatNumbers = hold.seatNumbers.map(norm);
    const manifest = normalisePassengers(
      seatNumbers,
      (Array.isArray(passengers) && passengers.length > 0) ? passengers : hold.passengerDetails,
      { required: true }
    );
    assertGenderPolicy(trip, manifest);

    const cleanPhone = normalisePhone(contactPhone);
    if (!cleanPhone) throw httpError(`Contact mobile: ${PHONE_ERROR}`, 400);
    // Email is optional — keep it empty rather than inventing an address.
    const cleanEmail = String(contactEmail || '').trim().toLowerCase();

    // 2. Resolve owner of the booking (guest checkout creates/links a passenger account).
    if (!passengerId) {
      let guestUser = await User.findOne({ phone: cleanPhone, role: ROLES.PASSENGER });
      if (!guestUser) {
        guestUser = await User.create({
          name: manifest[0].name,
          ...(cleanEmail ? { email: cleanEmail } : {}),
          phone: cleanPhone,
          role: ROLES.PASSENGER,
          passwordHash: 'guest-no-login'
        }).catch(async () => User.findOne(cleanEmail ? { $or: [{ phone: cleanPhone }, { email: cleanEmail }] } : { phone: cleanPhone }));
      }
      passengerId = guestUser?._id;
      if (!passengerId) throw httpError('Unable to register passenger contact.', 400);
    }

    // 3. Attribution: agent bookings credit the booking agent; otherwise referral code.
    let referralAgentId = null;
    if (paymentProvider === 'agent_wallet' || channel === 'AGENT_PORTAL') {
      referralAgentId = agentUserId || null;
    }
    if (!referralAgentId && referralCode) {
      try {
        const refAgent = await this.resolveReferralAgent(referralCode);
        if (refAgent) referralAgentId = refAgent._id;
      } catch (e) { /* never fail a paid booking over a referral code */ }
    }

    // Agents may only sell their own company's buses.
    let agentUser = null;
    if (agentUserId) {
      agentUser = await User.findById(agentUserId).select('_id role companyCode isActive');
      assertAgentCompanyScope(agentUser, trip);
    }

    const normalisedEmergency = normaliseEmergencyContact(emergencyContact);

    const paymentChannel = paymentProvider === 'agent_wallet' ? 'WALLET'
      : paymentProvider === 'agent_cash' ? 'CASH'
      : 'ONLINE';

    const quote = await this.calculateQuote({
      tripId: trip._id,
      seatNumbers,
      offerCode,
      insuranceOpted,
      insurancePerPassenger,
      seatFares: hold?.seatFares || null,
      paymentChannel,
      agentServiceCharge: agentUserId ? agentServiceCharge : 0
    });

    const pnr = `RUP${crypto.randomInt(10000000, 99999999)}`;
    const bookingId = `BK_${Date.now()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // 4. Secure payment BEFORE touching inventory.
    let paymentRef = '';
    let paymentOrderId = null;
    let paymentRecord = null;

    if (paymentProvider === 'agent_wallet') {
      if (!agentUserId) throw httpError('Agent authentication is required for wallet bookings.', 401);
      paymentRef = `WALLET_${bookingId}`;
    } else if (paymentProvider === 'agent_cash') {
      if (!agentUserId) throw httpError('Agent authentication is required for cash bookings.', 401);
      await cashPolicy.assertCashAllowed({ agentId: agentUserId, trip, amount: quote.totalPayable });
      paymentRef = `CASH_${bookingId}`;
    } else if (paymentProvider === 'razorpay') {
      const Payment = require('../payments/payment.model');
      if (!paymentDetails?.orderId || !paymentDetails?.paymentId) {
        throw httpError('Payment reference is missing.', 400);
      }
      // Atomic claim: only one booking can ever consume a captured payment.
      paymentRecord = await Payment.findOneAndUpdate(
        {
          orderId: paymentDetails.orderId,
          paymentId: paymentDetails.paymentId,
          purpose: 'TICKET_BOOKING',
          status: 'CAPTURED',
          consumedByBooking: null
        },
        { $set: { consumedByBooking: bookingId } },
        { new: true }
      );
      if (!paymentRecord) {
        throw httpError('This payment is not valid or has already been used for another ticket.', 409, { code: 'PAYMENT_NOT_USABLE' });
      }
      if (Number(paymentRecord.amount) + 0.5 < quote.totalPayable) {
        await Payment.updateOne({ _id: paymentRecord._id, consumedByBooking: bookingId }, { $set: { consumedByBooking: null } });
        throw httpError(`Payment amount ₹${paymentRecord.amount} does not cover the fare ₹${quote.totalPayable}.`, 409, { code: 'PAYMENT_AMOUNT_MISMATCH' });
      }
      paymentRef = paymentRecord.paymentId;
      paymentOrderId = paymentRecord.orderId;
    } else {
      if (env.NODE_ENV === 'production') {
        throw httpError('Simulated payments are disabled in production.', 400);
      }
      const dummyRes = await dummyPayment.verifyPayment({
        paymentId: paymentDetails.paymentId,
        status: paymentDetails.status || 'SUCCESS'
      });
      if (!dummyRes.verified) throw httpError('Simulated card payment declined.', 402);
      paymentRef = dummyRes.transactionId;
    }

    const resolvedBoarding = this.resolvePoint(boardingPoint, trip.routeId?.boardingPoints, trip.departureTime, 'Main Bus Stand');
    const resolvedDropping = this.resolvePoint(droppingPoint, trip.routeId?.droppingPoints, trip.arrivalTime, 'Central Bus Stand');

    // 5. Inventory + money + ticket in one unit of work.
    const committed = { reservations: false, tripSeats: false, walletDebit: null };
    let booking;
    try {
      booking = await withTransaction(async (session) => {
        const opts = session ? { session } : {};

        // a) Hard uniqueness guarantee: unique (tripId, seatNumber) index.
        try {
          await SeatReservation.create(
            seatNumbers.map((seatNumber) => ({ tripId: trip._id, seatNumber, bookingId, status: 'BOOKED' })),
            // Mongoose requires ordered:true to create several docs inside a transaction (replica set / Atlas).
            { ...opts, ordered: true }
          );
          committed.reservations = true;
        } catch (dupErr) {
          if (dupErr.code === 11000 || String(dupErr.message || '').includes('E11000')) {
            throw httpError(`Seat${seatNumbers.length > 1 ? 's' : ''} ${seatNumbers.join(', ')} ${seatNumbers.length > 1 ? 'were' : 'was'} just booked by someone else. Please choose different seats.`, 409, { code: 'SEAT_ALREADY_BOOKED' });
          }
          throw dupErr;
        }

        // b) Conditional seat flip + passenger manifest in one atomic update.
        const setOps = { 'seats.$[booked].status': SEAT_STATUS.BOOKED };
        const arrayFilters = [{ 'booked.seatNumber': { $in: seatNumbers } }];
        manifest.forEach((p, i) => {
          setOps[`seats.$[p${i}].passenger`] = { name: p.name, age: p.age, gender: p.gender };
          arrayFilters.push({ [`p${i}.seatNumber`]: p.seatNumber });
        });

        const updatedTrip = await Trip.findOneAndUpdate(
          {
            _id: trip._id,
            seats: {
              $not: {
                $elemMatch: {
                  seatNumber: { $in: seatNumbers },
                  status: { $in: [SEAT_STATUS.BOOKED, SEAT_STATUS.BLOCKED] }
                }
              }
            }
          },
          { $set: setOps },
          { arrayFilters, new: true, ...opts }
        );
        if (!updatedTrip) {
          throw httpError(`Seat${seatNumbers.length > 1 ? 's' : ''} ${seatNumbers.join(', ')} ${seatNumbers.length > 1 ? 'were' : 'was'} just booked by someone else. Please choose different seats.`, 409, { code: 'SEAT_ALREADY_BOOKED' });
        }
        committed.tripSeats = true;

        // c) Agent wallet debit (atomic, overdraft-proof, idempotent).
        if (paymentProvider === 'agent_wallet') {
          const debitRes = await walletLedger.debit({
            userId: agentUserId,
            amount: quote.totalPayable,
            transactionType: TRANSACTION_TYPES.TICKET_PURCHASE,
            referenceType: 'BOOKING',
            referenceId: bookingId,
            description: `Ticket PNR ${pnr} · Seats ${seatNumbers.join(', ')} · ${manifest[0].name}${manifest.length > 1 ? ` +${manifest.length - 1}` : ''}`,
            idempotencyKey: `BOOKING_DEBIT_${bookingId}`,
            companyCode: trip.companyCode,
            session
          });
          committed.walletDebit = debitRes;
        }

        // d) Ticket.
        const [created] = await Booking.create([{
          bookingId,
          pnr,
          passengerId,
          contactDetails: { email: cleanEmail, phone: cleanPhone },
          tripId: trip._id,
          routeId: trip.routeId._id,
          busId: trip.busId._id,
          companyId: trip.companyId || null,
          companyCode: trip.companyCode,
          referralAgentId,
          bookedByAgentId: agentUserId || null,
          channel,
          seatNumbers,
          emergencyContact: normalisedEmergency,
          passengers: manifest.map((p) => {
            const sf = quote.seatFares?.find(f => String(f.seatNumber).trim().toUpperCase() === String(p.seatNumber).trim().toUpperCase());
            return { ...p, fare: sf?.fare ?? trip.baseFare };
          }),
          boardingPoint: resolvedBoarding,
          droppingPoint: resolvedDropping,
          fareBreakdown: {
            baseFare: quote.baseFare,
            seatCount: quote.seatCount,
            seatFares: quote.seatFares,
            subtotal: quote.subtotal,
            gstAmount: quote.gstAmount,
            insuranceAmount: quote.insuranceAmount,
            insurancePerPassenger: quote.insurancePerPassenger,
            discountAmount: quote.discountAmount,
            platformFee: quote.platformFee,
            gatewayFee: quote.gatewayFee,
            agentServiceCharge: quote.agentServiceCharge,
            paymentChannel: quote.paymentChannel,
            customerTotal: quote.customerTotal,
            totalPayable: quote.totalPayable
          },
          cashCollection: paymentChannel === 'CASH'
            ? { status: 'PENDING', amountDue: quote.totalPayable }
            : { status: null, amountDue: 0 },
          offerCode: quote.appliedOffer?.code || null,
          insuranceOpted: quote.insuranceOpted,
          insurancePremium: quote.insuranceAmount,
          agentServiceCharge: quote.agentServiceCharge,
          status: BOOKING_STATUS.CONFIRMED,
          paymentStatus: paymentChannel === 'CASH' ? PAYMENT_STATUS.CASH_PENDING : PAYMENT_STATUS.SUCCESS,
          paymentProvider,
          paymentReference: paymentRef,
          paymentOrderId
        }], opts);

        return created;
      });
    } catch (err) {
      // Standalone MongoDB (no transactions): compensate partial writes.
      // A rolled-back transaction wrote nothing, so only release the payment (never re-credit / free seats).
      const done = err.rolledBack ? { reservations: false, tripSeats: false, walletDebit: null } : committed;
      await this.compensateFailedConfirm({ trip, seatNumbers, bookingId, committed: done, paymentRecord, agentUserId, quote });
      throw err;
    }

    // 6. Post-commit side effects (never affect the issued ticket).
    holdStore.releaseHold(hold.holdToken, { isForce: true });

    try {
      await taxService.recordGstEntry({ booking, subtotal: quote.subtotal, gstAmount: quote.gstAmount });
    } catch (taxErr) {
      console.error('[TaxEngine GST Error]', taxErr.message);
    }

    // Online agent booking: the agent charge was collected through the gateway → credit it to the agent.
    if (paymentChannel === 'ONLINE' && agentUserId && quote.agentServiceCharge > 0) {
      try {
        await walletLedger.credit({
          userId: agentUserId,
          amount: quote.agentServiceCharge,
          companyCode: trip.companyCode,
          transactionType: TRANSACTION_TYPES.AGENT_SERVICE_CHARGE,
          referenceType: 'BOOKING',
          referenceId: booking.bookingId,
          description: `Service charge collected online · PNR ${booking.pnr}`,
          idempotencyKey: `AGENT_CHARGE_${booking.bookingId}`
        });
      } catch (chargeErr) {
        console.error('[Agent charge credit]', booking.bookingId, chargeErr.message);
      }
    }

    // Cash tickets earn commission only once the company office confirms the cash.
    if (referralAgentId && paymentChannel !== 'CASH') {
      try {
        const commRecords = await commissionService.distributeCommissions({
          booking,
          trip,
          seatCount: seatNumbers.length
        });
        (commRecords || []).forEach((cr) => {
          websocketService.broadcastCommissionEarned(cr.agentId, {
            pnr: booking.pnr,
            level: cr.level,
            grossCommission: cr.grossCommission,
            tcsDeducted: cr.tcsDeducted,
            netCommission: cr.netCommission
          });
        });
      } catch (commErr) {
        console.error('[Commission Engine Error]', commErr.message);
      }
    }

    try {
      websocketService.broadcastBookingConfirmed(booking, trip);
      notificationService.fire('bookingConfirmed', booking.toObject ? booking.toObject() : booking);
    } catch (wsErr) {
      console.error('[WebSocket Broadcast Error]', wsErr.message);
    }

    await booking.populate([
      { path: 'tripId', select: '-seats', populate: [{ path: 'busId' }, { path: 'routeId' }] },
      { path: 'routeId' },
      { path: 'busId' }
    ]);

    const bookingObj = booking.toObject();
    bookingObj.trip = bookingObj.tripId;
    bookingObj.bus = bookingObj.busId;
    bookingObj.route = bookingObj.routeId;
    bookingObj.seats = bookingObj.seatNumbers;
    bookingObj.totalAmount = bookingObj.fareBreakdown?.totalPayable;
    bookingObj.qrToken = ticketQr.sign(bookingObj.bookingId, String(trip._id));
    if (committed.walletDebit?.wallet) {
      bookingObj.walletBalanceAfter = committed.walletDebit.wallet.availableBalance;
    }
    return bookingObj;
  }

  resolvePoint(selected, routePoints, fallbackDate, fallbackName) {
    const points = Array.isArray(routePoints) ? routePoints : [];
    const name = selected && (selected.name || selected.location || (typeof selected === 'string' ? selected : null));
    const matched = name ? points.find((p) => (p.name || p.location) === name) : null;
    const fmt = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
    const timeFallback = fallbackDate ? fmt(fallbackDate) : 'Scheduled Time';

    // Only accept route-defined points when the route has them (prevents arbitrary text on tickets).
    if (points.length > 0) {
      const chosen = matched || points[0];
      let time = chosen.time || timeFallback;
      if (!chosen.time && fallbackDate && Number.isFinite(Number(chosen.timeOffsetMinutes))) {
        time = fmt(new Date(fallbackDate).getTime() + Number(chosen.timeOffsetMinutes) * 60000);
      }
      return {
        name: chosen.landmark ? `${chosen.name || chosen.location} (${chosen.landmark})` : (chosen.name || chosen.location || fallbackName),
        time
      };
    }
    return {
      name: String(name || fallbackName).slice(0, 120),
      time: (selected && selected.time) ? String(selected.time).slice(0, 20) : timeFallback
    };
  }

  async compensateFailedConfirm({ trip, seatNumbers, bookingId, committed, paymentRecord, agentUserId, quote }) {
    try {
      const stillExists = await Booking.exists({ bookingId });
      if (stillExists) return; // transaction committed after all

      if (committed.walletDebit && !committed.walletDebit.duplicate && agentUserId) {
        await walletLedger.credit({
          userId: agentUserId,
          amount: committed.walletDebit.amount || quote.totalPayable,
          transactionType: TRANSACTION_TYPES.TICKET_CANCELLATION_REFUND,
          referenceType: 'BOOKING',
          referenceId: bookingId,
          description: `Reversal of failed ticket issue ${bookingId}`,
          idempotencyKey: `BOOKING_DEBIT_REVERSAL_${bookingId}`
        });
      }
      if (committed.tripSeats) {
        await Trip.updateOne(
          { _id: trip._id },
          { $set: { 'seats.$[s].status': SEAT_STATUS.AVAILABLE, 'seats.$[s].passenger': null } },
          { arrayFilters: [{ 's.seatNumber': { $in: seatNumbers } }] }
        );
      }
      if (committed.reservations) {
        await SeatReservation.deleteMany({ bookingId });
      }
      if (paymentRecord) {
        const Payment = require('../payments/payment.model');
        await Payment.updateOne({ _id: paymentRecord._id, consumedByBooking: bookingId }, { $set: { consumedByBooking: null } });
      }
    } catch (compErr) {
      console.error('[Booking Compensation Error] Manual reconciliation needed for', bookingId, compErr.message);
    }
  }

  /**
   * Refund policy (time to departure → % of fare refunded).
   */
  computeRefund(booking, trip) {
    const now = Date.now();
    const depTime = new Date(trip.departureTime || booking.createdAt).getTime();
    const hoursToDep = (depTime - now) / (1000 * 60 * 60);

    let refundPercent;
    if (trip.chartPrepared) refundPercent = 0.15;
    else if (hoursToDep > 48) refundPercent = 0.90;
    else if (hoursToDep > 24) refundPercent = 0.75;
    else if (hoursToDep > 12) refundPercent = 0.50;
    else refundPercent = 0.0;

    const fb = booking.fareBreakdown || {};
    const paidTotal = Number(fb.totalPayable || 0);

    // An agent cash ticket whose cash never reached the company office: nothing was paid.
    if (booking.paymentStatus === PAYMENT_STATUS.CASH_PENDING) {
      return { refundPercent: 0, refundAmount: 0, cancellationFee: 0, paidTotal: 0, refundableBase: 0, hoursToDep, unpaidCash: true };
    }

    // Only fare + GST are refundable. Platform fee, gateway fee, insurance and agent charge are not.
    const refundableBase = (fb.subtotal != null && fb.gstAmount != null)
      ? Math.min(paidTotal, Number(fb.subtotal) + Number(fb.gstAmount) - Number(fb.discountAmount || 0))
      : paidTotal;
    const refundAmount = Math.round(refundableBase * refundPercent);
    const cancellationFee = Math.max(0, refundableBase - refundAmount);
    return { refundPercent, refundAmount, cancellationFee, paidTotal, refundableBase, hoursToDep, unpaidCash: false };
  }

  /**
   * Cancel a booking. Safe against double-submission: the CONFIRMED → CANCELLED
   * transition is atomic, so refunds / fee credits / commission reversals run once.
   */
  async cancelBooking({ bookingId, reason, cancelledByUserId }) {
    const existing = await Booking.findOne({ $or: [{ bookingId }, { pnr: String(bookingId).toUpperCase() }] });
    if (!existing) throw httpError('Booking not found', 404);
    if (existing.status === BOOKING_STATUS.CANCELLED) throw httpError('This booking is already cancelled', 409);
    if (existing.status !== BOOKING_STATUS.CONFIRMED) throw httpError(`Booking in status ${existing.status} cannot be cancelled`, 409);

    const trip = await Trip.findById(existing.tripId);
    if (!trip) throw httpError('Associated trip not found', 404);
    if (trip.departureTime && new Date(trip.departureTime).getTime() <= Date.now()) {
      throw httpError('This bus has already departed. Tickets cannot be cancelled after departure.', 409);
    }
    if (['DEPARTED', 'COMPLETED'].includes(trip.status)) {
      throw httpError('This trip has already departed. Cancellation is not possible.', 409);
    }

    const { refundPercent, refundAmount, cancellationFee, paidTotal } = this.computeRefund(existing, trip);
    // Wallet and (received) cash tickets are refunded to the agent wallet; the agent repays the customer.
    const isAgentWallet = ['agent_wallet', 'AGENT_WALLET', 'agent_cash'].includes(existing.paymentProvider);
    const refundRouting = existing.paymentStatus === PAYMENT_STATUS.CASH_PENDING ? 'UNPAID_CASH_NO_REFUND'
      : refundAmount <= 0 ? 'NON_REFUNDABLE' : (isAgentWallet ? 'AGENT_WALLET' : 'ORIGINAL_PAYMENT_SOURCE');

    // Atomic state transition — the single gate for all money movement below.
    const booking = await Booking.findOneAndUpdate(
      { _id: existing._id, status: BOOKING_STATUS.CONFIRMED },
      {
        $set: {
          status: BOOKING_STATUS.CANCELLED,
          'cancellationDetails.cancelledAt': new Date(),
          'cancellationDetails.cancelledBy': cancelledByUserId || null,
          'cancellationDetails.refundAmount': refundAmount,
          'cancellationDetails.cancellationFee': cancellationFee,
          'cancellationDetails.refundRouting': refundRouting,
          'cancellationDetails.reason': String(reason || 'Customer requested cancellation').slice(0, 300),
          paymentStatus: refundAmount > 0 ? PAYMENT_STATUS.REFUND_PENDING : existing.paymentStatus
        }
      },
      { new: true }
    );
    if (!booking) throw httpError('This booking is already cancelled', 409);

    // Release inventory atomically.
    await Trip.updateOne(
      { _id: trip._id },
      { $set: { 'seats.$[s].status': SEAT_STATUS.AVAILABLE, 'seats.$[s].passenger': null } },
      { arrayFilters: [{ 's.seatNumber': { $in: booking.seatNumbers }, 's.status': SEAT_STATUS.BOOKED }] }
    );
    await SeatReservation.deleteMany({ bookingId: booking.bookingId }).catch(() => {});

    // 1. Operator keeps the cancellation fee.
    if (cancellationFee > 0 && booking.companyCode) {
      try {
        const company = await Company.findOne({ $or: [{ companyCode: booking.companyCode }, { code: booking.companyCode }] });
        let ownerUserId = company?.ownerId || null;
        if (!ownerUserId) {
          const owner = await User.findOne({ role: ROLES.COMPANY_OWNER, companyCode: booking.companyCode }).select('_id');
          ownerUserId = owner?._id || null;
        }
        if (ownerUserId) {
          await walletLedger.credit({
            userId: ownerUserId,
            amount: cancellationFee,
            ownerType: 'COMPANY',
            companyCode: booking.companyCode,
            transactionType: TRANSACTION_TYPES.CANCELLATION_FEE_OPERATOR_CREDIT,
            referenceType: 'BOOKING',
            referenceId: booking.bookingId,
            description: `Cancellation fee retained for PNR ${booking.pnr} (${Math.round((1 - refundPercent) * 100)}%)`,
            idempotencyKey: `OP_CANC_FEE_${booking.bookingId}`
          });
        }
      } catch (opErr) {
        console.error('[Operator Cancellation Fee Credit Error]:', opErr.message);
      }
    }

    // 2. Customer / agent refund.
    let generatedRefundId = null;
    let refundStatus = refundAmount > 0 ? REFUND_STATUS.PENDING : null;

    if (refundAmount > 0 && isAgentWallet) {
      const walletOwner = booking.bookedByAgentId || booking.passengerId;
      await walletLedger.credit({
        userId: walletOwner,
        amount: refundAmount,
        companyCode: booking.companyCode,
        transactionType: TRANSACTION_TYPES.TICKET_CANCELLATION_REFUND,
        referenceType: 'BOOKING',
        referenceId: booking.bookingId,
        description: `Cancellation refund (${Math.round(refundPercent * 100)}%) for PNR ${booking.pnr}`,
        idempotencyKey: `CANCEL_REFUND_${booking.bookingId}`
      });
      refundStatus = REFUND_STATUS.PROCESSED;
      booking.paymentStatus = PAYMENT_STATUS.REFUNDED;
    } else if (refundAmount > 0) {
      const company = await Company.findOne({ $or: [{ companyCode: booking.companyCode }, { code: booking.companyCode }] }).select('name');
      generatedRefundId = `RFND-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

      const refundDoc = await Refund.create({
        refundId: generatedRefundId,
        bookingId: booking._id,
        pnr: booking.pnr,
        companyCode: booking.companyCode,
        companyName: company?.name || `Company #${booking.companyCode}`,
        customerName: booking.passengers?.[0]?.name || 'Customer',
        customerPhone: booking.contactDetails?.phone || '',
        customerEmail: booking.contactDetails?.email || '',
        paymentId: booking.paymentReference || null,
        orderId: booking.paymentOrderId || null,
        paymentMethod: 'RAZORPAY',
        totalFare: paidTotal,
        cancellationFee,
        refundAmount,
        status: REFUND_STATUS.PENDING,
        notes: `Cancelled PNR ${booking.pnr}. Reason: ${reason || 'Customer cancellation request'}`
      });

      // Instant refund to the original payment source (RedBus-style). If the gateway
      // call fails, the refund stays PENDING in the admin refund queue for retry.
      if (process.env.AUTO_REFUND_ON_CANCEL !== 'false' && booking.paymentProvider === 'razorpay') {
        try {
          const refundService = require('../payments/refund.service');
          const processed = await refundService.processRefundRecord(refundDoc._id, { mode: 'GATEWAY', actorId: null });
          refundStatus = processed.status;
          if (processed.status === REFUND_STATUS.PROCESSED) booking.paymentStatus = PAYMENT_STATUS.REFUNDED;
        } catch (autoErr) {
          console.warn('[Auto refund deferred to admin queue]', generatedRefundId, autoErr.message);
        }
      }
    }

    booking.cancellationDetails.refundId = generatedRefundId;
    await booking.save();

    // 3. Reverse commissions and GST.
    try {
      await commissionService.reverseCommissions(booking._id);
    } catch (commErr) {
      console.error('[Commission Reversal Error]', commErr.message);
    }
    try {
      await taxService.reverseBookingGstEntry(booking);
    } catch (taxErr) {
      console.error('[TaxEngine GST Reversal Error]', taxErr.message);
    }

    try {
      websocketService.broadcastSeatReleased(booking.tripId.toString(), booking.seatNumbers);
      notificationService.fire('bookingCancelled', booking._id);
    } catch (e) { /* best-effort */ }

    return {
      success: true,
      booking,
      refundAmount,
      cancellationFee,
      refundPercent: refundPercent * 100,
      refundId: generatedRefundId,
      refundStatus,
      refundRouting
    };
  }
}

module.exports = new BookingService();
module.exports.httpError = httpError;
module.exports.normalisePassengers = normalisePassengers;
module.exports.normaliseEmergencyContact = normaliseEmergencyContact;
module.exports.assertAgentCompanyScope = assertAgentCompanyScope;
