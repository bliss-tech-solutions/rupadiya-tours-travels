const crypto = require('crypto');
const Payment = require('./payment.model');
const { Wallet, WalletLedger } = require('../wallets/wallet.model');
const DepositRequest = require('../wallets/deposit.model');
const Trip = require('../trips/trip.model');
const Booking = require('../bookings/booking.model');
const bookingService = require('../bookings/booking.service');
const env = require('../../config/env');
const { TRANSACTION_TYPES, SEAT_STATUS } = require('../../config/constants');

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
      // Resilient test / demo sandbox simulation order
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
   * 2. Verify Razorpay cryptographic signature and idempotently fulfill the purpose
   */
  async verifyAndFulfill({
    orderId,
    paymentId,
    signature,
    userId = null,
    paymentMethod = null,
    gatewayEntity = null
  }) {
    if (!orderId || !paymentId) {
      throw new Error('Order ID and Payment ID are required for verification.');
    }

    const payment = await Payment.findOne({ orderId });
    if (!payment) {
      throw new Error(`No payment order found for order ID: ${orderId}`);
    }

    // Idempotency check: if already captured, return fulfilled result immediately
    if (payment.status === 'CAPTURED') {
      return {
        success: true,
        alreadyProcessed: true,
        message: 'Payment was already verified and fulfilled.',
        payment
      };
    }

    // Simulation security guard
    const allowSimulation = process.env.NODE_ENV !== 'production' && process.env.ALLOW_PAYMENT_SIMULATION === 'true';
    if ((paymentId?.startsWith('pay_sim_') || signature?.startsWith('sig_sim_')) && !allowSimulation) {
      payment.status = 'FAILED';
      payment.failureReason = 'Payment simulation is disabled. Real gateway verification required.';
      await payment.save();
      throw new Error('Payment simulation rejected. Please use a live payment method.');
    }

    // Cryptographic signature check
    if (this.isConfigured() && !paymentId?.startsWith('pay_sim_') && !signature?.startsWith('sig_sim_')) {
      if (!signature) {
        throw new Error('Razorpay signature is required for verification.');
      }
      const expectedSignature = crypto
        .createHmac('sha256', this.keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      if (expectedSignature !== signature) {
        payment.status = 'FAILED';
        payment.failureReason = 'Cryptographic HMAC signature mismatch';
        await payment.save();
        throw new Error('Invalid payment signature. Payment verification rejected.');
      }
    }

    // Mark payment as captured atomically
    payment.status = 'CAPTURED';
    payment.paymentId = paymentId;
    payment.signature = signature || 'TEST_SIMULATED_SIG';
    payment.verifiedAt = new Date();
    await payment.save();

    // Discover detailed Razorpay payment method (UPI, Card, Netbanking, Wallet)
    let rzpMethod = 'RAZORPAY';
    let rzpDetailInfo = '';
    let depositorAccount = '';

    if (gatewayEntity && gatewayEntity.method) {
      const m = String(gatewayEntity.method).toUpperCase();
      if (['UPI', 'CARD', 'NETBANKING', 'WALLET'].includes(m)) rzpMethod = m;
      if (gatewayEntity.vpa) {
        rzpDetailInfo = `UPI (${gatewayEntity.vpa})`;
        depositorAccount = gatewayEntity.vpa;
      } else if (gatewayEntity.card) {
        const net = gatewayEntity.card.network || 'Card';
        const l4 = gatewayEntity.card.last4 ? `*${gatewayEntity.card.last4}` : '';
        rzpDetailInfo = `${net} ${l4}`.trim();
        depositorAccount = rzpDetailInfo;
      } else if (gatewayEntity.bank) {
        rzpDetailInfo = `NetBanking (${gatewayEntity.bank})`;
        depositorAccount = gatewayEntity.bank;
      } else if (gatewayEntity.wallet) {
        rzpDetailInfo = `Wallet (${gatewayEntity.wallet})`;
        depositorAccount = gatewayEntity.wallet;
      }
    } else if (this.isConfigured() && !paymentId?.startsWith('pay_sim_')) {
      try {
        const authHeader = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
        const pRes = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
          headers: { 'Authorization': `Basic ${authHeader}` }
        });
        if (pRes.ok) {
          const pData = await pRes.json();
          const m = (pData.method || '').toUpperCase();
          if (['UPI', 'CARD', 'NETBANKING', 'WALLET'].includes(m)) rzpMethod = m;
          if (pData.vpa) {
            rzpDetailInfo = `UPI (${pData.vpa})`;
            depositorAccount = pData.vpa;
          } else if (pData.card) {
            const net = pData.card.network || 'Card';
            const l4 = pData.card.last4 ? `*${pData.card.last4}` : '';
            rzpDetailInfo = `${net} ${l4}`.trim();
            depositorAccount = rzpDetailInfo;
          } else if (pData.bank) {
            rzpDetailInfo = `NetBanking (${pData.bank})`;
            depositorAccount = pData.bank;
          } else if (pData.wallet) {
            rzpDetailInfo = `Wallet (${pData.wallet})`;
            depositorAccount = pData.wallet;
          }
          payment.rawGatewayResponse = pData;
          payment.paymentMethod = ['UPI', 'CARD', 'NETBANKING', 'WALLET'].includes(rzpMethod) ? rzpMethod : 'RAZORPAY';
          await payment.save();
        }
      } catch (fErr) {
        console.warn('Could not fetch Razorpay payment mode:', fErr.message);
      }
    } else if (paymentMethod) {
      const pm = String(paymentMethod).toUpperCase();
      if (['UPI', 'CARD', 'NETBANKING', 'WALLET', 'UPI_QR'].includes(pm)) {
        rzpMethod = pm;
        rzpDetailInfo = `${pm} Instant`;
      }
    }


    let fulfillmentResult = {};

    // -----------------------------------------------------------------
    // FULFILLMENT HANDLERS BY PURPOSE
    // -----------------------------------------------------------------

    // A. AGENT / USER WALLET DEPOSIT
    if (payment.purpose === 'WALLET_DEPOSIT') {
      let targetUserId = payment.userId || userId || payment.metadata?.userId || payment.notes?.userId;
      if (!targetUserId && payment.companyCode) {
        const User = require('../users/user.model');
        const fallbackUser = await User.findOne({ companyCode: payment.companyCode, role: { $in: ['AGENT', 'COMPANY_OWNER'] } });
        if (fallbackUser) targetUserId = fallbackUser._id;
      }
      if (!targetUserId) {
        const User = require('../users/user.model');
        const defaultAgent = await User.findOne({ role: 'AGENT' });
        if (defaultAgent) targetUserId = defaultAgent._id;
      }
      if (!targetUserId) throw new Error('User ID required to credit wallet deposit.');

      let wallet = await Wallet.findOne({ userId: targetUserId });
      if (!wallet) {
        wallet = await Wallet.create({
          userId: targetUserId,
          companyCode: payment.companyCode || 1,
          availableBalance: 0,
          reservedBalance: 0
        });
      }

      wallet.availableBalance += payment.amount;
      await wallet.save();

      const depositRef = `DEP_${Date.now()}`;
      const idempotencyKey = `PAY_DEP_${paymentId}`;

      // Insert immutable audit ledger
      const ledger = await WalletLedger.create({
        walletId: wallet._id,
        userId: targetUserId,
        companyCode: payment.companyCode || 1,
        entryType: 'CREDIT',
        amount: payment.amount,
        balanceAfter: wallet.availableBalance,
        transactionType: TRANSACTION_TYPES.WALLET_DEPOSIT,
        referenceType: 'DEPOSIT',
        referenceId: depositRef,
        description: `Wallet reload via Razorpay (${rzpDetailInfo ? rzpDetailInfo : rzpMethod}) - Ref: ${paymentId}`,
        idempotencyKey
      });

      // Update or create DepositRequest record
      await DepositRequest.create({
        depositId: depositRef,
        userId: targetUserId,
        companyCode: payment.companyCode || 1,
        amount: payment.amount,
        paymentMethod: ['UPI', 'CARD', 'NETBANKING', 'WALLET', 'UPI_QR'].includes(rzpMethod) ? rzpMethod : 'RAZORPAY',
        referenceId: paymentId,
        bankDetails: {
          bankName: rzpDetailInfo ? `Razorpay ${rzpDetailInfo}` : 'Razorpay Gateway',
          senderAccount: depositorAccount || 'Online Terminal',
          notes: `Order ID: ${orderId} | Gateway: Razorpay (${rzpMethod})`
        },
        status: 'COMPLETED',
        verifiedBy: `RAZORPAY_${rzpMethod}`,
        verifiedAt: new Date()
      });

      fulfillmentResult = {
        wallet: {
          availableBalance: wallet.availableBalance,
          reservedBalance: wallet.reservedBalance
        },
        deposit: {
          depositId: depositRef,
          amount: payment.amount,
          status: 'COMPLETED'
        },
        ledger
      };
    }

    // B. PASSENGER TICKET BOOKING (User Web or Agent Booking)
    else if (payment.purpose === 'TICKET_BOOKING') {
      const meta = payment.metadata || {};
      
      const confirmPayload = {
        holdToken: meta.holdToken || meta.holdId,
        passengerId: payment.userId || userId,
        contactEmail: meta.contactEmail || meta.primaryContact?.email,
        contactPhone: meta.contactPhone || meta.primaryContact?.phone,
        passengers: meta.passengers || [],
        boardingPoint: meta.boardingPoint,
        droppingPoint: meta.droppingPoint,
        paymentProvider: 'razorpay',
        paymentDetails: {
          paymentId,
          orderId,
          signature,
          status: 'SUCCESS',
          verified: true,
          alreadyVerified: true
        },
        referralCode: meta.referralCode,
        tripId: meta.tripId,
        seatNumbers: meta.seatNumbers || meta.selectedSeats,
        insuranceOpted: meta.insuranceOpted ?? false,
        insuranceAmount: meta.insuranceAmount ?? 0
      };

      const bookingResult = await bookingService.confirmBooking(confirmPayload);
      fulfillmentResult = { bookingResult };
    }

    // C. COMPANY FRANCHISE WALLET DEPOSIT
    else if (payment.purpose === 'COMPANY_WALLET_DEPOSIT') {
      let targetUserId = payment.userId || userId || payment.metadata?.userId;
      const targetCompanyCode = payment.companyCode || 1;

      let companyWallet = null;
      if (targetUserId) {
        companyWallet = await Wallet.findOne({ companyCode: targetCompanyCode, userId: targetUserId });
      }
      if (!companyWallet) {
        companyWallet = await Wallet.findOne({ companyCode: targetCompanyCode });
      }

      if (!companyWallet) {
        if (!targetUserId) {
          const User = require('../users/user.model');
          const ownerUser = await User.findOne({ companyCode: targetCompanyCode, role: 'COMPANY_OWNER' });
          if (ownerUser) targetUserId = ownerUser._id;
        }
        companyWallet = await Wallet.create({
          userId: targetUserId,
          companyCode: targetCompanyCode,
          availableBalance: 0,
          reservedBalance: 0
        });
      }

      companyWallet.availableBalance += payment.amount;
      await companyWallet.save();

      const idempotencyKey = `PAY_COMP_${paymentId}`;
      const ledger = await WalletLedger.create({
        walletId: companyWallet._id,
        userId: companyWallet.userId || targetUserId,
        companyCode: targetCompanyCode,
        entryType: 'CREDIT',
        amount: payment.amount,
        balanceAfter: companyWallet.availableBalance,
        transactionType: TRANSACTION_TYPES.WALLET_DEPOSIT,
        referenceType: 'DEPOSIT',
        referenceId: `COMP_DEP_${Date.now()}`,
        description: `Company Franchise Wallet reload via Razorpay (Payment ID: ${paymentId})`,
        idempotencyKey
      });

      fulfillmentResult = {
        companyWallet: {
          availableBalance: companyWallet.availableBalance
        },
        wallet: {
          availableBalance: companyWallet.availableBalance
        },
        ledger
      };
    }

    payment.metadata = {
      ...payment.metadata,
      fulfillmentResult
    };
    await payment.save();

    return {
      success: true,
      verified: true,
      payment,
      ...fulfillmentResult
    };
  }

  /**
   * 3. Handle asynchronous Razorpay Webhook events
   */
  async handleWebhook(rawBody, signature) {
    if (this.webhookSecret && signature) {
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(rawBody)
        .digest('hex');

      if (expectedSignature !== signature) {
        throw new Error('Invalid Razorpay webhook signature');
      }
    }

    const event = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    const { event: eventType, payload } = event;

    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const paymentEntity = payload.payment?.entity;
      const orderId = paymentEntity?.order_id;
      const paymentId = paymentEntity?.id;

      if (orderId && paymentId) {
        await this.verifyAndFulfill({
          orderId,
          paymentId,
          signature: 'WEBHOOK_VERIFIED'
        });
      }
    } else if (eventType === 'payment.failed') {
      const paymentEntity = payload.payment?.entity;
      const orderId = paymentEntity?.order_id;
      if (orderId) {
        await Payment.findOneAndUpdate(
          { orderId },
          { status: 'FAILED', failureReason: paymentEntity.error_description || 'Gateway Payment Failed' }
        );
      }
    }

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
   * 6. Process Gateway Refund via Razorpay REST API (or resilient sandbox simulation)
   */
  async processRefund({ paymentId, amount, notes = {}, refundSpeed = 'optimum' }) {
    if (!paymentId) {
      throw new Error('Payment ID is required to process refund');
    }

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      throw new Error('Valid refund amount is required');
    }

    let gatewayRefundId = null;
    let gatewayResponse = null;

    if (this.isConfigured() && paymentId.startsWith('pay_')) {
      try {
        const authHeader = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
        const refundPayload = {
          amount: Math.round(numAmount * 100), // amount in paise
          speed: refundSpeed,
          notes: {
            ...notes,
            processedAt: new Date().toISOString()
          }
        };

        const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${authHeader}`
          },
          body: JSON.stringify(refundPayload)
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ? data.error.description : 'Razorpay refund request failed');
        }

        gatewayRefundId = data.id;
        gatewayResponse = data;
      } catch (err) {
        console.error('[Razorpay Refund API Error]:', err.message);
        // If gateway call fails on demo/test mock payment ID in development, fallback to simulated sandbox refund
        if (process.env.NODE_ENV !== 'production' || paymentId.includes('test') || paymentId.includes('mock') || paymentId.includes('sim')) {
          console.warn('[Falling back to simulated refund for mock/test payment]:', err.message);
          gatewayRefundId = `rfnd_sim_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
          gatewayResponse = {
            id: gatewayRefundId,
            payment_id: paymentId,
            amount: Math.round(numAmount * 100),
            status: 'processed',
            speed_processed: refundSpeed,
            simulated: true,
            gatewayNotice: err.message
          };
        } else {
          throw err;
        }
      }
    } else {
      // Resilient test / demo sandbox simulation refund
      gatewayRefundId = `rfnd_sim_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      gatewayResponse = {
        id: gatewayRefundId,
        payment_id: paymentId,
        amount: Math.round(numAmount * 100),
        status: 'processed',
        speed_processed: refundSpeed,
        simulated: true
      };
    }

    // Update payment record in database if found
    try {
      await Payment.findOneAndUpdate(
        { $or: [{ paymentId }, { orderId: paymentId }] },
        {
          status: 'REFUNDED',
          'refundDetails.refundId': gatewayRefundId,
          'refundDetails.amount': numAmount,
          'refundDetails.status': 'processed',
          'refundDetails.refundedAt': new Date()
        }
      );
    } catch (dbErr) {
      console.warn('[Payment Record Update Warning on Refund]:', dbErr.message);
    }

    return {
      success: true,
      refundId: gatewayRefundId,
      amount: numAmount,
      rawResponse: gatewayResponse
    };
  }
}

module.exports = new PaymentService();

