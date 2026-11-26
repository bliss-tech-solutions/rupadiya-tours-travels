const express = require('express');
const router = express.Router();
const payoutService = require('./payout.service');

// RazorpayX payout status webhook (payout.processed / failed / reversed / rejected / queued).
// Authenticated by HMAC signature over the raw body, not by session.
router.post('/webhook', async (req, res) => {
  try {
    const result = await payoutService.handleWebhook(
      req.rawBody || JSON.stringify(req.body || {}),
      req.headers['x-razorpay-signature'],
      req.headers['x-razorpay-event-id'] || null
    );
    res.json(result);
  } catch (err) {
    console.error('[RazorpayX Webhook]', err.message);
    res.status(err.statusCode || 400).json({ error: err.message });
  }
});

module.exports = router;
