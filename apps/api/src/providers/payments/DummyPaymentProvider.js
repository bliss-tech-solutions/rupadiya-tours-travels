const PaymentProvider = require('./PaymentProvider');

class DummyPaymentProvider extends PaymentProvider {
  constructor() {
    super();
    this.name = 'dummy';
  }

  async createPaymentOrder({ bookingId, amount, currency = 'INR', notes = {} }) {
    const orderId = `DUMMY_ORD_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    return {
      success: true,
      provider: 'dummy',
      orderId,
      amount,
      currency,
      checkoutUrl: `/payment/${bookingId}?orderId=${orderId}&dummy=true`,
      notes
    };
  }

  async verifyPayment({ orderId, paymentId, status = 'SUCCESS' }) {
    if (status === 'FAILED') {
      return {
        success: false,
        verified: false,
        error: 'Simulated payment failure by user choice'
      };
    }

    return {
      success: true,
      verified: true,
      transactionId: paymentId || `DUMMY_TXN_${Date.now()}`,
      provider: 'dummy',
      settledAt: new Date()
    };
  }

  async processRefund({ paymentReference, amount, reason }) {
    return {
      success: true,
      refundId: `DUMMY_REFUND_${Date.now()}`,
      amount,
      status: 'PROCESSED',
      reason
    };
  }
}

module.exports = new DummyPaymentProvider();

