const crypto = require('crypto');
const env = require('../../config/env');

class RazorpayXProvider {
  constructor() {
    this.name = 'razorpayx';
    this.keyId = env.RAZORPAYX_KEY_ID || env.RAZORPAY_KEY_ID || '';
    this.keySecret = env.RAZORPAYX_KEY_SECRET || env.RAZORPAY_KEY_SECRET || '';
    this.accountNumber = env.RAZORPAYX_ACCOUNT_NUMBER || '';
    this.webhookSecret = env.RAZORPAYX_WEBHOOK_SECRET || env.RAZORPAY_WEBHOOK_SECRET || '';
  }

  isConfigured() {
    return Boolean(this.accountNumber && this.keyId && this.keySecret);
  }

  getAuthHeader() {
    return Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
  }

  /**
   * Fetches available RazorpayX account balance (in INR rupees)
   */
  async getBalance() {
    if (!this.isConfigured()) {
      // In dev/test simulation, return generous mock balance so testing never blocks
      return {
        success: true,
        isSimulated: true,
        balance: 250000, // ₹2,50,000 simulated balance
        currency: 'INR'
      };
    }

    try {
      const url = `https://api.razorpay.com/v1/accounts/${this.accountNumber}/balance`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${this.getAuthHeader()}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.description || 'Failed to fetch RazorpayX balance');
      }

      return {
        success: true,
        isSimulated: false,
        balance: (data.balance || 0) / 100, // Convert paise to rupees
        currency: data.currency || 'INR'
      };
    } catch (err) {
      console.warn('[RazorpayXProvider] Failed to fetch live balance:', err.message);
      return {
        success: false,
        error: err.message,
        balance: 0
      };
    }
  }

  /**
   * Creates or registers an Agent as a RazorpayX Contact
   */
  async createContact({ name, email, phone, referenceId, type = 'vendor' }) {
    if (!this.isConfigured()) {
      return {
        id: `cont_sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name,
        email,
        contact: phone,
        type
      };
    }

    const payload = {
      name,
      email: email || `${phone}@agent.rupadiya.in`,
      contact: phone,
      type,
      reference_id: String(referenceId || '')
    };

    const response = await fetch('https://api.razorpay.com/v1/contacts', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${this.getAuthHeader()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.description || 'Failed to create RazorpayX contact');
    }

    return data;
  }

  /**
   * Creates a Fund Account (Bank Account or UPI VPA) for the contact
   */
  async createFundAccount({ contactId, payoutDetails = {} }) {
    const method = (payoutDetails.method || 'bank').toLowerCase();

    if (!this.isConfigured()) {
      return {
        id: `fa_sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        contact_id: contactId,
        account_type: method === 'upi' ? 'vpa' : 'bank_account',
        active: true
      };
    }

    let payload;
    if (method === 'upi') {
      payload = {
        contact_id: contactId,
        account_type: 'vpa',
        vpa: {
          address: String(payoutDetails.upiId || '').trim()
        }
      };
    } else {
      payload = {
        contact_id: contactId,
        account_type: 'bank_account',
        bank_account: {
          name: payoutDetails.accountName,
          ifsc: payoutDetails.ifscCode,
          account_number: String(payoutDetails.accountNumber).trim()
        }
      };
    }

    const response = await fetch('https://api.razorpay.com/v1/fund_accounts', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${this.getAuthHeader()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.description || 'Failed to create RazorpayX fund account');
    }

    return data;
  }

  /**
   * Initiates instant payout to the fund account
   */
  async createPayout({ fundAccountId, amount, mode = 'IMPS', purpose = 'payout', referenceId, notes = {} }) {
    const amountPaise = Math.round(Number(amount) * 100);

    if (!this.isConfigured()) {
      const simUtr = `UTR_RZPX_${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 8999 + 1000)}`;
      return {
        id: `pout_sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        entity: 'payout',
        fund_account_id: fundAccountId,
        amount: amountPaise,
        currency: 'INR',
        status: 'processed', // In simulation mode, immediately settle
        utr: simUtr,
        mode,
        purpose,
        reference_id: referenceId,
        isSimulated: true
      };
    }

    const payload = {
      account_number: this.accountNumber,
      fund_account_id: fundAccountId,
      amount: amountPaise,
      currency: 'INR',
      mode: mode.toUpperCase(), // 'IMPS', 'NEFT', 'RTGS', 'UPI'
      purpose,
      queue_if_low_balance: true,
      reference_id: String(referenceId),
      notes
    };

    const response = await fetch('https://api.razorpay.com/v1/payouts', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${this.getAuthHeader()}`,
        'Content-Type': 'application/json',
        'X-Payout-Idempotency': String(referenceId)
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.description || 'RazorpayX payout request failed');
    }

    return data;
  }

  /**
   * Fetches payout status from RazorpayX
   */
  async fetchPayout(payoutId) {
    if (!this.isConfigured() || payoutId.startsWith('pout_sim_')) {
      return {
        id: payoutId,
        status: 'processed',
        utr: `UTR_RZPX_SYNC_${Date.now().toString().slice(-8)}`
      };
    }

    const response = await fetch(`https://api.razorpay.com/v1/payouts/${payoutId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${this.getAuthHeader()}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.description || 'Failed to fetch payout status from RazorpayX');
    }

    return data;
  }

  /**
   * Verifies RazorpayX webhook HMAC SHA-256 signature
   */
  verifyWebhookSignature(rawBody, signature) {
    if (!this.webhookSecret) return true; // Best effort if secret not set
    if (!rawBody || !signature) return false;

    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'))
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
  }
}

module.exports = new RazorpayXProvider();
