const express = require('express');
const router = express.Router();
const paymentService = require('./payment.service');
const { authenticateToken, optionalAuth } = require('../../middleware/auth.middleware');
const { paymentLimiter } = require('../../middleware/rateLimit.middleware');
const PaymentMethodConfig = require('./paymentMethodConfig.model');
const { authorizeRoles } = require('../../middleware/rbac.middleware');
const { ROLES } = require('../../config/constants');
const holdStore = require('../../config/holdStore');
const bookingService = require('../bookings/booking.service');

const Trip = require('../trips/trip.model');
const { assertGenderPolicy } = require('../../services/seatPolicy');
const { normalisePassengers } = require('../bookings/booking.service');
const { normalisePhone, PHONE_ERROR } = require('../../utils/phone');

// Public config: Returns the active Razorpay Key ID (never the secret)
router.get('/config', (req, res) => {
  res.json({
    success: true,
    keyId: paymentService.keyId || null,
    isTestMode: !paymentService.isConfigured()
  });
});

/**
 * Create Razorpay Order.
 *
 * TICKET_BOOKING orders are built entirely from server-side state:
 *  - the caller must own an active seat hold,
 *  - seats come from the hold, fare comes from the server quote,
 *  - passenger manifest is validated (incl. the ladies-seat rule) BEFORE money is taken.
 * The client-supplied amount is only used to detect a stale UI and is never trusted.
 */
router.post('/create-order', paymentLimiter, optionalAuth, async (req, res, next) => {
  try {
    const user = req.user || null;
    const { amount, currency = 'INR', purpose = 'TICKET_BOOKING', metadata = {}, notes = {} } = req.body || {};

    if (!['TICKET_BOOKING', 'WALLET_DEPOSIT', 'COMPANY_WALLET_DEPOSIT'].includes(purpose)) {
      return res.status(400).json({ success: false, error: 'Unsupported payment purpose.' });
    }
    if (String(currency).toUpperCase() !== 'INR') {
      return res.status(400).json({ success: false, error: 'Only INR payments are supported.' });
    }

    // Wallet top-ups: authenticated owner of the wallet only.
    if (purpose === 'WALLET_DEPOSIT' || purpose === 'COMPANY_WALLET_DEPOSIT') {
      if (!user) {
        return res.status(401).json({ success: false, error: 'Please sign in to add money to your wallet.' });
      }
      if (purpose === 'WALLET_DEPOSIT' && user.role !== ROLES.AGENT) {
        return res.status(403).json({ success: false, error: 'Only agents can top up an agent wallet.' });
      }
      if (purpose === 'COMPANY_WALLET_DEPOSIT' && user.role !== ROLES.COMPANY_OWNER) {
        return res.status(403).json({ success: false, error: 'Only company owners can top up a company wallet.' });
      }
      const depositAmount = Math.round(Number(amount) * 100) / 100;
      if (!depositAmount || depositAmount < 100 || depositAmount > 500000) {
        return res.status(400).json({ success: false, error: 'Deposit amount must be between ₹100 and ₹5,00,000.' });
      }
      const order = await paymentService.createOrder({
        amount: depositAmount,
        purpose,
        userId: user._id,
        companyCode: user.companyCode || null,
        metadata: { userId: String(user._id), companyCode: user.companyCode || null },
        notes: { purpose, userId: String(user._id) }
      });
      return res.status(201).json(order);
    }

    // ---- TICKET_BOOKING ----
    const holdToken = metadata.holdToken || metadata.holdId || req.body.holdToken || req.body.holdId;
    const tabId = req.tabId || req.headers['x-tab-id'] || null;
    const hold = holdToken ? holdStore.getHold(holdToken) : null;

    try {
      bookingService.assertHoldOwnership(hold, { passengerId: user?._id || null, tabId });
    } catch (ownErr) {
      return res.status(ownErr.statusCode || 410).json({ success: false, error: ownErr.message, code: ownErr.code });
    }

    const trip = await Trip.findById(hold.tripId).select('seats companyCode departureTime status');
    if (!trip) return res.status(404).json({ success: false, error: 'Trip not found.' });

    let passengers;
    try {
      passengers = normalisePassengers(
        hold.seatNumbers,
        metadata.passengers?.length ? metadata.passengers : hold.passengerDetails,
        { required: true }
      );
      assertGenderPolicy(trip, passengers);
      bookingService.normaliseEmergencyContact(metadata.emergencyContact);
    } catch (vErr) {
      return res.status(vErr.statusCode || 400).json({ success: false, error: vErr.message, code: vErr.code });
    }

    const contactPhone = normalisePhone(metadata.contactPhone || metadata.primaryContact?.phone || '');
    if (!contactPhone) {
      return res.status(400).json({ success: false, error: `Contact mobile: ${PHONE_ERROR}` });
    }
    const contactEmail = String(metadata.contactEmail || metadata.primaryContact?.email || '').trim().toLowerCase();

    const isAgentChannel = user?.role === ROLES.AGENT;
    let referralCode = null;
    if (!isAgentChannel && metadata.referralCode) {
      try {
        const agent = await bookingService.resolveReferralAgent(metadata.referralCode, { strict: true });
        referralCode = agent ? String(metadata.referralCode).toUpperCase().trim() : null;
      } catch (refErr) {
        return res.status(400).json({ success: false, error: refErr.message, code: refErr.code });
      }
    }

    // Agents may only sell their own company's buses.
    if (isAgentChannel) {
      try {
        bookingService.assertAgentCompanyScope(user, { companyCode: trip.companyCode });
      } catch (scopeErr) {
        return res.status(scopeErr.statusCode || 403).json({ success: false, error: scopeErr.message, code: scopeErr.code });
      }
    }

    // Online agent bookings carry the agent's own service charge (capped by the agent's settings).
    const agentChargeCap = isAgentChannel ? Math.min(200, Number(user.serviceCharges?.bookingCharge ?? 0) || 0) : 0;
    const agentServiceCharge = isAgentChannel
      ? Math.max(0, Math.min(agentChargeCap, Number(metadata.agentServiceCharge ?? agentChargeCap) || 0))
      : 0;

    const offerCode = metadata.offerCode || metadata.couponCode || null;
    const quote = await bookingService.calculateQuote({
      tripId: hold.tripId,
      seatNumbers: hold.seatNumbers,
      offerCode,
      insuranceOpted: Boolean(metadata.insuranceOpted),
      insurancePerPassenger: metadata.insurancePerPassenger,
      seatFares: hold.seatFares,
      paymentChannel: 'ONLINE',
      agentServiceCharge
    });

    if (offerCode && !quote.appliedOffer) {
      return res.status(400).json({
        success: false,
        error: `Coupon ${String(offerCode).toUpperCase()} is not valid for this booking.`,
        code: 'INVALID_COUPON'
      });
    }

    if (amount !== undefined && amount !== null && Math.abs(Number(amount) - quote.totalPayable) > 1) {
      return res.status(409).json({
        success: false,
        error: `The fare has been updated to ₹${quote.totalPayable}. Please review and pay again.`,
        code: 'FARE_CHANGED',
        quote
      });
    }

    const safeNotes = (notes && typeof notes === 'object')
      ? Object.fromEntries(Object.entries(notes).slice(0, 5).map(([k, v]) => [String(k).slice(0, 40), String(v).slice(0, 200)]))
      : {};

    const order = await paymentService.createOrder({
      amount: quote.totalPayable,
      purpose,
      userId: user?._id || null,
      companyCode: trip.companyCode,
      metadata: {
        holdToken: hold.holdToken,
        tripId: String(hold.tripId),
        seatNumbers: hold.seatNumbers,
        seatFares: quote.seatFares,
        passengers,
        boardingPoint: metadata.boardingPoint || null,
        droppingPoint: metadata.droppingPoint || null,
        contactPhone,
        contactEmail,
        referralCode,
        offerCode: quote.appliedOffer?.code || null,
        insuranceOpted: quote.insuranceOpted,
        insurancePerPassenger: quote.insurancePerPassenger,
        emergencyContact: metadata.emergencyContact || null,
        channel: isAgentChannel ? 'AGENT_PORTAL' : 'USER_WEB',
        agentServiceCharge,
        verifiedAmount: quote.totalPayable
      },
      notes: { ...safeNotes, purpose, seats: hold.seatNumbers.join(','), tripId: String(hold.tripId) }
    });

    res.status(201).json({ ...order, quote });
  } catch (err) {
    next(err);
  }
});

// Verify payment (browser callback) and fulfil it exactly once
router.post('/verify', paymentLimiter, optionalAuth, async (req, res, next) => {
  try {
    const { orderId, paymentId, signature } = req.body || {};
    const result = await paymentService.verifyAndFulfill({
      orderId,
      paymentId,
      signature,
      userId: req.user?._id || null
    });
    res.json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, error: err.message });
    }
    next(err);
  }
});

// Webhook listener - receives gateway callbacks with preserved raw buffer
router.post('/webhook', async (req, res, next) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const rawBuffer = req.rawBody || req.body;
    const result = await paymentService.handleWebhook(rawBuffer, signature, req.body);
    res.json(result);
  } catch (err) {
    console.error('[Razorpay Webhook Security Error]:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// Payment History (Authenticated)
router.get('/history', authenticateToken, async (req, res, next) => {
  try {
    const payments = await paymentService.getUserPaymentHistory(req.user._id);
    res.json({ success: true, count: payments.length, payments });
  } catch (err) {
    next(err);
  }
});


// =========================================================================
// PAYMENT METHOD GOVERNANCE (Global Super Admin & Company Agent Scopes)
// =========================================================================

// Active payment methods for checkout (Public/Semi-public)
router.get('/methods/active', async (req, res, next) => {
  try {
    const { companyCode } = req.query;
    
    // 1. Fetch Global config
    let globalConfig = await PaymentMethodConfig.findOne({ scope: 'GLOBAL' });
    if (!globalConfig) {
      globalConfig = {
        allowedMethods: { upi: true, card: true, netbanking: true, wallet: true }
      };
    }

    // 2. If companyCode is provided, fetch company-specific config
    let companyConfig = null;
    const parsedCompanyCode = companyCode ? Number(companyCode) : null;
    if (parsedCompanyCode) {
      companyConfig = await PaymentMethodConfig.findOne({ scope: 'COMPANY', companyCode: parsedCompanyCode });
    }

    // Compute effective allowed methods
    const effective = {
      upi: Boolean(globalConfig.allowedMethods?.upi ?? true) && (!companyConfig || Boolean(companyConfig.allowedMethods?.upi ?? true)),
      card: Boolean(globalConfig.allowedMethods?.card ?? true) && (!companyConfig || Boolean(companyConfig.allowedMethods?.card ?? true)),
      netbanking: Boolean(globalConfig.allowedMethods?.netbanking ?? true) && (!companyConfig || Boolean(companyConfig.allowedMethods?.netbanking ?? true)),
      wallet: Boolean(globalConfig.allowedMethods?.wallet ?? true) && (!companyConfig || Boolean(companyConfig.allowedMethods?.wallet ?? true))
    };

    res.json({
      success: true,
      allowedMethods: effective,
      globalAllowedMethods: globalConfig.allowedMethods,
      companyAllowedMethods: companyConfig ? companyConfig.allowedMethods : null,
      scope: parsedCompanyCode ? 'COMPANY' : 'GLOBAL',
      companyCode: parsedCompanyCode
    });
  } catch (err) {
    next(err);
  }
});

// Get Payment Methods Configuration (Super Admin gets GLOBAL, Company Owner gets COMPANY config)
router.get('/methods/config', authenticateToken, authorizeRoles(ROLES.SUPER_ADMIN, ROLES.COMPANY_OWNER), async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role === ROLES.SUPER_ADMIN;
    
    let globalConfig = await PaymentMethodConfig.findOne({ scope: 'GLOBAL' });
    if (!globalConfig) {
      globalConfig = await PaymentMethodConfig.create({
        scope: 'GLOBAL',
        allowedMethods: { upi: true, card: true, netbanking: true, wallet: true },
        updatedBy: req.user._id
      });
    }

    if (isSuperAdmin) {
      return res.json({
        success: true,
        scope: 'GLOBAL',
        config: globalConfig,
        allowedMethods: globalConfig.allowedMethods
      });
    }

    // Company Owner
    const companyCode = req.user.companyCode;
    let companyConfig = await PaymentMethodConfig.findOne({ scope: 'COMPANY', companyCode });
    if (!companyConfig) {
      companyConfig = await PaymentMethodConfig.create({
        scope: 'COMPANY',
        companyCode,
        allowedMethods: {
          upi: globalConfig.allowedMethods.upi,
          card: globalConfig.allowedMethods.card,
          netbanking: globalConfig.allowedMethods.netbanking,
          wallet: globalConfig.allowedMethods.wallet
        },
        updatedBy: req.user._id
      });
    }

    res.json({
      success: true,
      scope: 'COMPANY',
      companyCode,
      config: companyConfig,
      allowedMethods: companyConfig.allowedMethods,
      globalAllowedMethods: globalConfig.allowedMethods
    });
  } catch (err) {
    next(err);
  }
});

// Update Payment Methods Configuration
router.put('/methods/config', authenticateToken, authorizeRoles(ROLES.SUPER_ADMIN, ROLES.COMPANY_OWNER), async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role === ROLES.SUPER_ADMIN;
    const { allowedMethods } = req.body;

    if (!allowedMethods || typeof allowedMethods !== 'object') {
      return res.status(400).json({ error: 'allowedMethods object required with upi, card, netbanking, wallet booleans' });
    }

    const cleanMethods = {
      upi: Boolean(allowedMethods.upi),
      card: Boolean(allowedMethods.card),
      netbanking: Boolean(allowedMethods.netbanking),
      wallet: Boolean(allowedMethods.wallet)
    };

    if (isSuperAdmin) {
      const updated = await PaymentMethodConfig.findOneAndUpdate(
        { scope: 'GLOBAL' },
        {
          scope: 'GLOBAL',
          allowedMethods: cleanMethods,
          updatedBy: req.user._id
        },
        { new: true, upsert: true }
      );

      return res.json({
        success: true,
        message: 'Platform global payment methods updated successfully.',
        config: updated,
        allowedMethods: updated.allowedMethods
      });
    }

    // Company Owner
    const companyCode = req.user.companyCode;
    const updated = await PaymentMethodConfig.findOneAndUpdate(
      { scope: 'COMPANY', companyCode },
      {
        scope: 'COMPANY',
        companyCode,
        allowedMethods: cleanMethods,
        updatedBy: req.user._id
      },
      { new: true, upsert: true }
    );

    res.json({
      success: true,
      message: `Company #${companyCode} agent payment methods updated successfully.`,
      config: updated,
      allowedMethods: updated.allowedMethods
    });
  } catch (err) {
    next(err);
  }
});

// Single Payment Status Lookup
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const payment = await paymentService.getPaymentDetails(req.params.id);
    const isAdmin = req.user.role === ROLES.SUPER_ADMIN;
    if (!payment || (!isAdmin && String(payment.userId) !== String(req.user._id))) {
      return res.status(404).json({ error: 'Payment record not found' });
    }
    res.json({
      success: true,
      payment: {
        orderId: payment.orderId,
        paymentId: payment.paymentId,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        purpose: payment.purpose,
        paymentMethod: payment.paymentMethod,
        fulfillmentStatus: payment.fulfillmentStatus,
        consumedByBooking: payment.consumedByBooking,
        failureReason: payment.failureReason,
        refundDetails: payment.refundDetails,
        createdAt: payment.createdAt,
        verifiedAt: payment.verifiedAt
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
