const express = require('express');
const router = express.Router();
const paymentService = require('./payment.service');
const { authenticateToken } = require('../../middleware/auth.middleware');
const { paymentLimiter } = require('../../middleware/rateLimit.middleware');
const PaymentMethodConfig = require('./paymentMethodConfig.model');
const { authorizeRoles } = require('../../middleware/rbac.middleware');
const { ROLES } = require('../../config/constants');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');

function resolveUserFromRequest(req) {
  const token = req.cookies?.rupadiya_access_token || 
    (req.headers['authorization']?.startsWith('Bearer ') ? req.headers['authorization'].split(' ')[1] : null);
  if (!token) return null;
  try {
    return jwt.verify(token, env.AUTH_ACCESS_SECRET);
  } catch {
    return null;
  }
}

// Public config: Returns the active Razorpay Key ID
router.get('/config', (req, res) => {
  res.json({
    success: true,
    keyId: paymentService.keyId || 'rzp_test_rupadiya_demo',
    isTestMode: !paymentService.isConfigured()
  });
});

// Create Razorpay Order
// Allows authenticated users (Agents, Owners, Passengers) and guest public passengers
router.post('/create-order', paymentLimiter, async (req, res, next) => {
  try {
    const user = resolveUserFromRequest(req);

    const {
      amount,
      currency = 'INR',
      purpose = 'TICKET_BOOKING',
      metadata = {},
      notes = {}
    } = req.body;

    const resolvedUserId = user?.id || user?._id || user?.userId || req.body.userId || metadata?.userId || null;
    const resolvedCompanyCode = user?.companyCode || req.body.companyCode || metadata?.companyCode || 1;

    const orderResult = await paymentService.createOrder({
      amount,
      currency,
      purpose,
      userId: resolvedUserId,
      companyCode: resolvedCompanyCode,
      metadata: {
        ...metadata,
        userId: resolvedUserId,
        companyCode: resolvedCompanyCode
      },
      notes
    });

    res.status(201).json(orderResult);
  } catch (err) {
    next(err);
  }
});

// Verify Payment and Fulfill Purpose
router.post('/verify', paymentLimiter, async (req, res, next) => {
  try {
    const user = resolveUserFromRequest(req);

    const {
      orderId,
      paymentId,
      signature,
      paymentMethod
    } = req.body;

    const resolvedUserId = user?.id || user?._id || user?.userId || req.body.userId || req.body.metadata?.userId || null;

    const result = await paymentService.verifyAndFulfill({
      orderId,
      paymentId,
      signature,
      userId: resolvedUserId,
      paymentMethod
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Webhook listener
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res, next) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const result = await paymentService.handleWebhook(req.body, signature);
    res.json(result);
  } catch (err) {
    console.error('Razorpay Webhook Error:', err);
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
router.get('/:id', async (req, res, next) => {
  try {
    const payment = await paymentService.getPaymentDetails(req.params.id);
    if (!payment) return res.status(404).json({ error: 'Payment record not found' });
    res.json({ success: true, payment });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

