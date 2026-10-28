const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4500/api/v1';

async function request(endpoint, options = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('agent_token') : null;
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const url = `${API_BASE}${endpoint}`;
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      ...options,
      headers
    });
    if (res.status === 304) {
      return { success: true };
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || `Request failed with status ${res.status}`);
    }
    return data;
  } catch (err) {
    console.error(`Agent API Error: ${endpoint}`, err);
    throw err;
  }
}

export const api = {
  // Authentication
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request('/auth/me'),

  // Wallet
  getMyWallet: () => request('/wallet'),
  getWallet: () => request('/wallet'),
  getLedger: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/wallet/ledger?${query}`);
  },
  requestTopup: (amount, paymentMethod = 'UPI') => request('/wallet/deposit', { method: 'POST', body: JSON.stringify({ amount, paymentMethod }) }),

  // Unified Razorpay Payment Module
  getPaymentConfig: () => request('/payments/config'),
  createPaymentOrder: (payload) => request('/payments/create-order', { method: 'POST', body: JSON.stringify(payload) }),
  verifyPayment: (payload) => request('/payments/verify', { method: 'POST', body: JSON.stringify(payload) }),

  // 1. Dashboard Overview
  getDashboard: () => request('/agent/dashboard'),

  // 2. Make Deposit
  makeDeposit: (payload) => request('/agent/deposits', { method: 'POST', body: JSON.stringify(payload) }),

  // 3. Deposit History
  getDepositHistory: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/agent/deposits?${query}`);
  },

  // 4. Statement
  getStatement: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/agent/statement?${query}`);
  },

  // 5. Print Ticket / Lookup
  searchTicket: (param, mobile = '') => {
    let queryParams = {};
    if (typeof param === 'object' && param !== null) {
      queryParams = param;
    } else {
      queryParams = { q: param, ...(mobile ? { mobile } : {}) };
    }
    const cleanParams = Object.fromEntries(
      Object.entries(queryParams).filter(([_, v]) => v !== undefined && v !== null && v !== '')
    );
    const query = new URLSearchParams(cleanParams).toString();
    return request(`/agent/tickets/search?${query}`);
  },

  // 6. Cancel Ticket
  cancelTicket: (payload) => request('/agent/tickets/cancel', { method: 'POST', body: JSON.stringify(payload) }),

  // 7. My Rewards
  getRewards: () => request('/agent/rewards'),

  // 8. Booking Engine
  searchTrips: (from, to, date) => request(`/trips?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&date=${encodeURIComponent(date)}`),
  getTrip: (id) => request(`/trips/${id}`),
  holdSeats: (tripId, seatNumbers, passengers) => request('/bookings/hold', { method: 'POST', body: JSON.stringify({ tripId, seatNumbers, passengers }) }),
  bookWithWallet: (payload) => request('/agent/bookings/wallet-pay', { method: 'POST', body: JSON.stringify(payload) }),

  // 9. Track a Bus (Upcoming Trips Only)
  getUpcomingTrips: () => request('/agent/trips/upcoming'),

  // 10. Profile
  getProfile: () => request('/agent/profile'),
  updateProfile: (payload) => request('/agent/profile', { method: 'PUT', body: JSON.stringify(payload) }),

  // 11. Settings
  getSettings: () => request('/agent/settings'),
  updateSettings: (payload) => request('/agent/settings', { method: 'PUT', body: JSON.stringify(payload) }),

  // KYC
  getKycStatus: () => request('/kyc/me'),
  submitKyc: (kycData) => request('/kyc/submit', { method: 'POST', body: JSON.stringify(kycData) }),

  // Legacy Withdrawals (if needed)
  requestWithdrawal: (amount, bankDetails) => request('/withdrawals/request', { method: 'POST', body: JSON.stringify({ amount, bankDetails }) }),
  getMyWithdrawals: () => request('/withdrawals/me'),
};
