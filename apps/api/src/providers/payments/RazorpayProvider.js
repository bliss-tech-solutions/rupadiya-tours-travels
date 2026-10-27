const crypto = require('crypto');
const PaymentProvider = require('./PaymentProvider');
const env = require('../../config/env');

class RazorpayProvider extends PaymentProvider {
  constructor() {
    super();
    this.name = 'razorpay';
    this.keyId = env.RAZORPAY_KEY_ID;
    this.keySecret = env.RAZORPAY_KEY_SECRET;
  }

  isConfigured() {
    return Boolean(this.keyId && this.keySecret);
  }

  async createPaymentOrder({ bookingId, amount, currency = 'INR', notes = {} }) {
    if (!this.isConfigured()) {
      throw new Error('Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
    }

    const orderPayload = {
      amount: Math.round(amount * 100), // amount in paise
      currency,
      receipt: `RCP_${bookingId.substring(0, 20)}`,
      notes
    };

    const authHeader = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authHeader}`
      },
      body: JSON.stringify(orderPayload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ? data.error.description : 'Failed to create Razorpay order');
    }

    return {
      success: true,
      provider: 'razorpay',
      orderId: data.id,
      amount: data.amount / 100,
      currency: data.currency,
      keyId: this.keyId
    };
  }

  async verifyPayment({ orderId, paymentId, signature }) {
    if (!this.isConfigured()) {
      throw new Error('Razorpay is not configured.');
    }

    const body = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.keySecret)
      .update(body.toString())
      .digest('hex');

    const isMatch = expectedSignature === signature;
    return {
      success: isMatch,
      verified: isMatch,
      transactionId: paymentId,
      provider: 'razorpay',
      settledAt: isMatch ? new Date() : null,
      error: isMatch ? null : 'Invalid Razorpay signature'
    };
  }

  async processRefund({ paymentReference, amount, reason }) {
    if (!this.isConfigured()) {
      throw new Error('Razorpay is not configured.');
    }

    const authHeader = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentReference}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authHeader}`
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100),
        notes: { reason: reason || 'Customer cancellation' }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ? data.error.description : 'Razorpay refund failed');
    }

    return {
      success: true,
      refundId: data.id,
      amount: data.amount / 100,
      status: data.status,
      reason
    };
  }
}

module.exports = new RazorpayProvider();

