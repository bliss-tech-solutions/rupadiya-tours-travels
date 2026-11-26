const crypto = require('crypto');
const Payment = require('./payment.model');
const { Wallet, WalletLedger } = require('../wallets/wallet.model');
const DepositRequest = require('../wallets/deposit.model');
const Booking = require('../bookings/booking.model');
const bookingService = require('../bookings/booking.service');
const env = require('../../config/env');
const walletLedger = require('../../services/walletLedger.service');
const { TRANSACTION_TYPES } = require('../../config/constants');

class PaymentService {
  constructor() {
    this.keyId = env.RAZORPAY_KEY_ID;
    this.keySecret = env.RAZORPAY_KEY_SECRET;
    this.webhookSecret = env.RAZORPAY_WEBHOOK_SECRET;
  }

  isConfigured() {
    return Boolean(this.keyId && this.keySecret && !this.keyId.includes('YOUR_'));
  }

  /**
   * 1. Create a Razorpay Order and record payment document in DB
   */
  async createOrder({
    amount,
    currency = 'INR',
    purpose,
    userId = null,
    companyCode = null,
    metadata = {},
    notes = {}
  }) {
    const numAmount = Number(amount);
    if (!numAmount || numAmount < 1) {
      throw new Error('Invalid payment amount. Minimum amount is ₹1.');
    }

    let orderId;
    let gatewayKeyId = this.keyId || 'rzp_test_rupadiya_demo';

    if (this.isConfigured()) {
      // Create live order via Razorpay REST API
      const authHeader = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
      const orderPayload = {
        amount: Math.round(numAmount * 100), // amount in paise
        currency: currency.toUpperCase(),
        receipt: `RCP_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
        notes: {
          purpose,
          userId: userId ? userId.toString() : 'guest',
          companyCode: companyCode ? String(companyCode) : '1',
          ...notes
        }
      };

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
        throw new Error(data.error ? data.error.description : 'Failed to create Razorpay payment order');
      }
      orderId = data.id;
    } else {
      if (env.NODE_ENV === 'production') {
        throw httpError('Online payments are temporarily unavailable (gateway not configured).', 503);
      }
      // Development sandbox order (never reachable in production)
      orderId = `order_test_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }

    // Save initial Payment record in MongoDB
    const payment = await Payment.create({
      orderId,
      amount: numAmount,
      currency: currency.toUpperCase(),
      purpose,
      userId,
      companyCode: companyCode || 1,
      status: 'CREATED',
      metadata,
      idempotencyKey: `IDEM_ORD_${orderId}`
    });

    return {
      success: true,
      orderId,
      amount: numAmount,
      currency: currency.toUpperCase(),
      keyId: gatewayKeyId,
      paymentRecordId: payment._id,
      isTestMode: !this.isConfigured()
    };
  }

  /**
   * Fetch the authoritative payment entity from Razorpay.
   */
  async fetchGatewayPayment(paymentId) {
    const authHeader = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    const res = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Basic ${authHeader}` }
    });
    if (!res.ok) {
      throw new Error(`Unable to fetch payment ${paymentId} from Razorpay (HTTP ${res.status}).`);
    }
    return res.json();
  }

  describeMethod(entity) {
    let method = 'RAZORPAY';
    let detail = '';
    let account = '';
    if (!entity) return { method, detail, account };
    const m = String(entity.method || '').toUpperCase();
    if (['UPI', 'CARD', 'NETBANKING', 'WALLET'].includes(m)) method = m;
    if (entity.vpa) {
      detail = `UPI (${entity.vpa})`;
      account = entity.vpa;
    } else if (entity.card) {
      detail = `${entity.card.network || 'Card'} ${entity.card.last4 ? `*${entity.card.last4}` : ''}`.trim();
      account = detail;
    } else if (entity.bank) {
      detail = `NetBanking (${entity.bank})`;
      account = entity.bank;
    } else if (entity.wallet) {
      detail = `Wallet (${entity.wallet})`;
      account = entity.wallet;
    }
    return { method, detail, account };
  }

  /**
   * 2. Verify a payment and fulfil what it paid for — exactly once.
   *
   * Security model:
   *  - Browser callbacks must carry a valid HMAC signature (orderId|paymentId).
   *  - Webhook callbacks are trusted only after the webhook HMAC was verified by
   *    handleWebhook (trustedWebhook = true).
   *  - The gateway's own record is cross-checked: same order, same amount, captured.
   *  - CREATED → CAPTURED is an atomic transition, so a browser callback racing the
   *    webhook can never credit a wallet or issue a ticket twice.
   *  - Without gateway keys, only explicit simulation in non-production is allowed.
   */
  async verifyAndFulfill({
    orderId,
    paymentId,
    signature,
    userId = null,
    gatewayEntity = null,
    trustedWebhook = false
  }) {
    if (!orderId || !paymentId) {
      throw httpError('Order ID and Payment ID are required for verification.', 400);
    }

    const payment = await Payment.findOne({ orderId });
    if (!payment) throw httpError('Payment order not found.', 404);

    // Callers may only verify their own orders (guest orders have no owner).
    if (!trustedWebhook && payment.userId && userId && String(payment.userId) !== String(userId)) {
      throw httpError('This payment belongs to another account.', 403);
    }

    if (payment.status === 'CAPTURED' || payment.status === 'REFUNDED') {
      return this.buildIdempotentResult(payment);
    }

    let entity = gatewayEntity;

    if (this.isConfigured()) {
      if (!trustedWebhook) {
        if (!signature) throw httpError('Razorpay signature is required for verification.', 400);
        const expected = crypto.createHmac('sha256', this.keySecret).update(`${orderId}|${paymentId}`).digest('hex');
        const a = Buffer.from(expected, 'utf8');
        const b = Buffer.from(String(signature), 'utf8');
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
          // Do not mark FAILED: a forged callback must not be able to block the genuine one.
          throw httpError('Invalid payment signature. Payment verification rejected.', 400);
        }
      }

      if (!entity) {
        try {
          entity = await this.fetchGatewayPayment(paymentId);
        } catch (fetchErr) {
          // Signature is valid; the amount check below falls back to the order amount.
          console.warn('[Razorpay fetch payment]', fetchErr.message);
        }
      }

      if (entity) {
        if (entity.order_id && entity.order_id !== orderId) {
          throw httpError('Payment does not belong to this order.', 400);
        }
        if (entity.amount !== undefined && Number(entity.amount) !== Math.round(payment.amount * 100)) {
          throw httpError('Paid amount does not match the order amount.', 400);
        }
        if (entity.status && !['captured', 'authorized'].includes(entity.status)) {
          throw httpError(`Payment is ${entity.status}; it cannot be used.`, 400);
        }
      }
    } else {
      const allowSimulation = env.NODE_ENV !== 'production';
      if (!allowSimulation) {
        throw httpError('Payment gateway is not configured. Please contact support.', 503);
      }
    }

    // Atomic claim of the capture transition.
    const { method, detail, account } = this.describeMethod(entity);
    const captured = await Payment.findOneAndUpdate(
      { _id: payment._id, status: { $in: ['CREATED', 'ATTEMPTED', 'FAILED'] } },
      {
        $set: {
          status: 'CAPTURED',
          paymentId,
          signature: trustedWebhook ? 'WEBHOOK_VERIFIED' : (signature || 'SIMULATED'),
          verifiedAt: new Date(),
          paymentMethod: ['UPI', 'CARD', 'NETBANKING', 'WALLET'].includes(method) ? method : 'RAZORPAY',
          ...(entity ? { rawGatewayResponse: entity } : {})
        }
      },
      { new: true }
    );

    if (!captured) {
      // Lost the race to a concurrent verifier (browser vs webhook).
      return this.buildIdempotentResult(await Payment.findById(payment._id));
    }

    const fulfillmentResult = await this.fulfill(captured, { method, detail, account });

    // Razorpay's real charge for this payment (fee includes GST; both in paise).
    await this.recordActualGatewayFee(captured, entity, fulfillmentResult?.bookingResult?.bookingId);

    await Payment.updateOne(
      { _id: captured._id },
      { $set: { fulfillmentStatus: 'FULFILLED', 'metadata.fulfillmentResult': summariseFulfillment(fulfillmentResult) } }
    );

    return { success: true, verified: true, payment: publicPayment(captured), ...fulfillmentResult };
  }

  /**
   * Store the real gateway fee Razorpay deducted (entity.fee includes entity.tax), on the payment
   * and on the booking breakdown, so tickets and reports show the actual charge.
   */
  async recordActualGatewayFee(payment, entity, bookingId) {
    try {
      let e = entity;
      if ((!e || e.fee === undefined) && this.isConfigured() && payment.paymentId && String(payment.paymentId).startsWith('pay_')) {
        e = await this.fetchGatewayPayment(payment.paymentId).catch(() => null);
      }
      if (!e || e.fee === undefined || e.fee === null) return;
      const fee = Math.round(Number(e.fee)) / 100;
      const tax = Math.round(Number(e.tax || 0)) / 100;
      await Payment.updateOne({ _id: payment._id }, { $set: { gatewayFee: fee, gatewayTax: tax } });
      if (bookingId) {
        await Booking.updateOne(
          { bookingId },
          { $set: { 'fareBreakdown.gatewayFeeActual': fee, 'fareBreakdown.gatewayTaxActual': tax } }
        );
      }
    } catch (err) {
      console.warn('[Gateway fee capture]', err.message);
    }
  }

  async buildIdempotentResult(payment) {
    const result = { success: true, alreadyProcessed: true, verified: true, payment: publicPayment(payment) };
    if (payment.purpose === 'TICKET_BOOKING' && payment.consumedByBooking) {
      const booking = await Booking.findOne({ bookingId: payment.consumedByBooking })
        .populate([{ path: 'tripId', select: '-seats', populate: [{ path: 'busId' }, { path: 'routeId' }] }, { path: 'routeId' }, { path: 'busId' }]);
      if (booking) {
        const b = booking.toObject();
        b.trip = b.tripId; b.bus = b.busId; b.route = b.routeId; b.totalAmount = b.fareBreakdown?.totalPayable;
        result.bookingResult = b;
      }
    }
    if (payment.status === 'REFUNDED' || payment.fulfillmentStatus === 'FAILED_REFUNDED') {
      result.success = false;
      result.refunded = true;
      result.error = payment.failureReason || 'This payment was refunded.';
    }
    return result;
  }

  /**
   * Performs the business action paid for. Runs once per captured payment.
   */
  async fulfill(payment, { method, detail, account }) {
    const meta = payment.metadata || {};

    if (payment.purpose === 'WALLET_DEPOSIT' || payment.purpose === 'COMPANY_WALLET_DEPOSIT') {
      const isCompany = payment.purpose === 'COMPANY_WALLET_DEPOSIT';
      let targetUserId = payment.userId;
      if (!targetUserId && isCompany) {
        const User = require('../users/user.model');
        const owner = await User.findOne({ companyCode: payment.companyCode, role: 'COMPANY_OWNER' }).select('_id');
        targetUserId = owner?._id;
      }
      if (!targetUserId) throw httpError('Wallet owner could not be resolved for this deposit.', 400);

      const depositRef = `DEP_${payment.paymentId}`;
      const { ledger, wallet } = await walletLedger.credit({
        userId: targetUserId,
        amount: payment.amount,
        ownerType: isCompany ? 'COMPANY' : 'AGENT',
        companyCode: payment.companyCode || null,
        transactionType: TRANSACTION_TYPES.WALLET_DEPOSIT,
        referenceType: 'DEPOSIT',
        referenceId: depositRef,
        description: `${isCompany ? 'Company wallet' : 'Wallet'} top-up via Razorpay ${detail || method} · Payment ${payment.paymentId}`,
        idempotencyKey: `PAY_DEP_${payment.paymentId}`
      });

      if (!isCompany) {
        await DepositRequest.create({
          depositId: depositRef,
          userId: targetUserId,
          companyCode: payment.companyCode || 1,
          amount: payment.amount,
          paymentMethod: ['UPI', 'CARD', 'NETBANKING', 'WALLET'].includes(method) ? method : 'RAZORPAY',
          referenceId: payment.paymentId,
          bankDetails: {
            bankName: detail ? `Razorpay ${detail}` : 'Razorpay Gateway',
            senderAccount: account || 'Online',
            notes: `Order ${payment.orderId}`
          },
          status: 'COMPLETED',
          verifiedBy: `RAZORPAY_${method}`,
          verifiedAt: new Date()
        }).catch((e) => console.warn('[DepositRequest record]', e.message));
      }

      const freshWallet = wallet || await Wallet.findOne({ userId: targetUserId });
      const walletView = {
        availableBalance: freshWallet?.availableBalance ?? 0,
        reservedBalance: freshWallet?.reservedBalance ?? 0
      };
      return isCompany
        ? { companyWallet: walletView, wallet: walletView, ledger }
        : { wallet: walletView, deposit: { depositId: depositRef, amount: payment.amount, status: 'COMPLETED' }, ledger };
    }

    if (payment.purpose === 'TICKET_BOOKING') {
      try {
        const bookingResult = await bookingService.confirmBooking({
          holdToken: meta.holdToken,
          passengerId: payment.userId || null,
          contactEmail: meta.contactEmail,
          contactPhone: meta.contactPhone,
          passengers: meta.passengers || [],
          boardingPoint: meta.boardingPoint,
          droppingPoint: meta.droppingPoint,
          paymentProvider: 'razorpay',
          paymentDetails: {
            orderId: payment.orderId,
            paymentId: payment.paymentId,
            recoverSeats: { tripId: meta.tripId, seatNumbers: meta.seatNumbers }
          },
          referralCode: meta.referralCode,
          offerCode: meta.offerCode || null,
          insuranceOpted: Boolean(meta.insuranceOpted),
          insurancePerPassenger: meta.insurancePerPassenger,
          emergencyContact: meta.emergencyContact || null,
          agentUserId: meta.channel === 'AGENT_PORTAL' ? payment.userId : null,
          agentServiceCharge: meta.agentServiceCharge || 0,
          channel: meta.channel || 'USER_WEB',
          trustedPayment: true
        });
        return { bookingResult };
      } catch (bookErr) {
        // Money was taken but no ticket could be issued (seat taken, hold expired…):
        // refund the full amount automatically.
        const reason = `Ticket could not be issued: ${bookErr.message}`;
        let refunded = false;
        try {
          await this.processRefund({
            paymentId: payment.paymentId,
            amount: payment.amount,
            notes: { reason: 'BOOKING_FAILED', orderId: payment.orderId }
          });
          refunded = true;
        } catch (refErr) {
          console.error('[CRITICAL] Auto-refund failed for', payment.orderId, refErr.message);
        }
        await Payment.updateOne(
          { _id: payment._id },
          {
            $set: {
              fulfillmentStatus: refunded ? 'FAILED_REFUNDED' : 'FAILED_REFUND_PENDING',
              failureReason: reason,
              ...(refunded ? { status: 'REFUNDED' } : {})
            }
          }
        );
        throw httpError(
          refunded
            ? `${bookErr.message} Your payment of ₹${payment.amount} has been refunded to the original payment method.`
            : `${bookErr.message} Your payment of ₹${payment.amount} will be refunded within 5-7 working days.`,
          bookErr.statusCode || 409
        );
      }
    }

    throw httpError(`Unsupported payment purpose ${payment.purpose}`, 400);
  }

  /**
   * 3. Razorpay webhook: verified with the webhook secret, idempotent per event id.
   */
  async handleWebhook(rawBody, signature, parsedBody = null) {
    if (!this.webhookSecret) {
      if (env.NODE_ENV === 'production') {
        throw new Error('[SECURITY] Razorpay webhook secret is not configured.');
      }
      throw new Error('Webhook secret not configured; webhook ignored.');
    }
    if (!signature) throw new Error('Razorpay webhook signature is required.');

    const rawString = Buffer.isBuffer(rawBody)
      ? rawBody.toString('utf8')
      : (typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody));

    const expected = crypto.createHmac('sha256', this.webhookSecret).update(rawString).digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(String(signature), 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new Error('Invalid Razorpay webhook signature');
    }

    const event = JSON.parse(rawString);
    const eventId = event.id || crypto.createHash('sha256').update(rawString).digest('hex');
    const WebhookEvent = require('./webhookEvent.model');

    if (await WebhookEvent.findOne({ eventId })) {
      return { status: 'ok', event: event.event, alreadyProcessed: true };
    }

    const { event: eventType, payload } = event;
    const entity = payload?.payment?.entity;

    if ((eventType === 'payment.captured' || eventType === 'order.paid') && entity?.order_id && entity?.id) {
      try {
        await this.verifyAndFulfill({
          orderId: entity.order_id,
          paymentId: entity.id,
          gatewayEntity: entity,
          trustedWebhook: true
        });
      } catch (err) {
        // Business failures (e.g. seat already taken → auto refunded) are final; acknowledge.
        console.warn('[Webhook fulfillment]', entity.order_id, err.message);
      }
    } else if (eventType === 'payment.failed' && entity?.order_id) {
      await Payment.updateOne(
        { orderId: entity.order_id, status: { $in: ['CREATED', 'ATTEMPTED'] } },
        { $set: { status: 'FAILED', failureReason: entity.error_description || 'Gateway payment failed' } }
      );
    }

    await WebhookEvent.create({
      eventId,
      eventType,
      orderId: entity?.order_id || null,
      paymentId: entity?.id || null,
      processed: true,
      processedAt: new Date()
    }).catch((e) => console.warn('[Webhook Event Persistence]', e.message));

    return { status: 'ok', event: eventType };
  }


  /**
   * 4. Retrieve single payment details
   */
  async getPaymentDetails(paymentIdOrOrderId) {
    return Payment.findOne({
      $or: [{ orderId: paymentIdOrOrderId }, { paymentId: paymentIdOrOrderId }]
    });
  }

  /**
   * 5. User payment history
   */
  async getUserPaymentHistory(userId) {
    return Payment.find({ userId }).sort({ createdAt: -1 });
  }

  /**
   * 6. Gateway refund. Simulation is only possible outside production.
   */
  async processRefund({ paymentId, amount, notes = {}, refundSpeed = 'optimum' }) {
    if (!paymentId) throw httpError('Payment ID is required to process refund', 400);
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) throw httpError('Valid refund amount is required', 400);

    let gatewayRefundId;
    let gatewayResponse;
    const isProd = env.NODE_ENV === 'production';

    if (this.isConfigured() && String(paymentId).startsWith('pay_')) {
      const authHeader = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
      const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Basic ${authHeader}` },
        body: JSON.stringify({
          amount: Math.round(numAmount * 100),
          speed: refundSpeed,
          notes: { ...notes, processedAt: new Date().toISOString() }
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw httpError(data?.error?.description || 'Razorpay refund request failed', 502);
      }
      gatewayRefundId = data.id;
      gatewayResponse = data;
    } else if (!isProd) {
      gatewayRefundId = `rfnd_sim_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      gatewayResponse = { id: gatewayRefundId, payment_id: paymentId, amount: Math.round(numAmount * 100), status: 'processed', simulated: true };
    } else {
      throw httpError('Gateway refund is unavailable for this payment. Use manual bank transfer.', 502);
    }

    await Payment.updateOne(
      { paymentId },
      {
        $set: {
          status: 'REFUNDED',
          'refundDetails.refundId': gatewayRefundId,
          'refundDetails.status': gatewayResponse?.status || 'processed',
          'refundDetails.refundedAt': new Date()
        },
        $inc: { 'refundDetails.amount': numAmount }
      }
    ).catch((dbErr) => console.warn('[Payment refund record update]', dbErr.message));

    return { success: true, refundId: gatewayRefundId, amount: numAmount, rawResponse: gatewayResponse };
  }
}

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function publicPayment(p) {
  if (!p) return null;
  return {
    orderId: p.orderId,
    paymentId: p.paymentId,
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    purpose: p.purpose,
    paymentMethod: p.paymentMethod,
    fulfillmentStatus: p.fulfillmentStatus,
    verifiedAt: p.verifiedAt
  };
}

function summariseFulfillment(r) {
  if (!r) return null;
  if (r.bookingResult) return { bookingId: r.bookingResult.bookingId, pnr: r.bookingResult.pnr };
  if (r.wallet) return { availableBalance: r.wallet.availableBalance };
  return null;
}

module.exports = new PaymentService();
