const express = require('express');
const router = express.Router();
const paymentService = require('./payment.service');
const { authenticateToken } = require('../../middleware/auth.middleware');

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
router.post('/create-order', async (req, res, next) => {
  try {
    // Optional token extraction if header present
    const authHeader = req.headers['authorization'];
    let user = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const env = require('../../config/env');
        const token = authHeader.split(' ')[1];
        user = jwt.verify(token, env.AUTH_ACCESS_SECRET);
      } catch (e) {}
    }

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
router.post('/verify', async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    let user = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const env = require('../../config/env');
        const token = authHeader.split(' ')[1];
        user = jwt.verify(token, env.AUTH_ACCESS_SECRET);
      } catch (e) {}
    }

    const {
      orderId,
      paymentId,
      signature
    } = req.body;

    const resolvedUserId = user?.id || user?._id || user?.userId || req.body.userId || req.body.metadata?.userId || null;

    const result = await paymentService.verifyAndFulfill({
      orderId,
      paymentId,
      signature,
      userId: resolvedUserId
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

