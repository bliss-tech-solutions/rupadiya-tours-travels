class PaymentProvider {
  async createPaymentOrder({ bookingId, amount, currency, notes }) {
    throw new Error('Method createPaymentOrder() must be implemented');
  }

  async verifyPayment({ orderId, paymentId, signature }) {
    throw new Error('Method verifyPayment() must be implemented');
  }

  async processRefund({ paymentReference, amount, reason }) {
    throw new Error('Method processRefund() must be implemented');
  }
}

module.exports = PaymentProvider;

