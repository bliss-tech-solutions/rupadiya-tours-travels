const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4500/api/v1';

let isRefreshing = false;
let refreshSubscribers = [];
let refreshFailed = false;

export function isAgentSessionValid() {
  if (typeof window === 'undefined') return false;
  return Boolean(localStorage.getItem('agent_user'));
}

function subscribeTokenRefresh(cb) {
  refreshSubscribers.push(cb);
}

function onRefreshed(success) {
  refreshSubscribers.forEach(cb => cb(success));
  refreshSubscribers = [];
}

async function request(endpoint, options = {}, isRetry = false) {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'x-rupadiya-client': 'agent-portal',
    ...(options.headers || {})
  };

  const url = `${API_BASE}${endpoint}`;
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      ...options,
      headers,
      credentials: 'include' // Send httpOnly cookies
    });

    if (res.status === 304) {
      return { success: true };
    }

    // 401 Auto-refresh transparent 24hr revalidation
    if (res.status === 401 && !isRetry && !endpoint.startsWith('/auth/login') && !endpoint.startsWith('/auth/refresh') && !endpoint.startsWith('/auth/otp')) {
      if (refreshFailed || !isAgentSessionValid()) {
        try { localStorage.removeItem('agent_user'); } catch {}
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
        throw new Error('Agent authentication required.');
      }

      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-rupadiya-client': 'agent-portal'
            },
            credentials: 'include'
          });

          if (refreshRes.ok) {
            isRefreshing = false;
            refreshFailed = false;
            onRefreshed(true);
            return request(endpoint, options, true);
          } else {
            isRefreshing = false;
            refreshFailed = true;
            onRefreshed(false);
            try { localStorage.removeItem('agent_user'); } catch {}
            if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
              window.location.href = '/login';
            }
            throw new Error('Agent session expired. Please sign in again.');
          }
        } catch (err) {
          isRefreshing = false;
          refreshFailed = true;
          onRefreshed(false);
          try { localStorage.removeItem('agent_user'); } catch {}
          if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
            window.location.href = '/login';
          }
          throw err;
        }
      } else {
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh((success) => {
            if (success) {
              resolve(request(endpoint, options, true));
            } else {
              reject(new Error('Agent session expired. Please sign in again.'));
            }
          });
        });
      }
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || `Request failed with status ${res.status}`);
    }
    return data;
  } catch (err) {
    if (!isRetry) {
      console.error(`Agent API Error: ${endpoint}`, err);
    }
    throw err;
  }
}

export const api = {
  // Authentication
  login: async (email, password) => {
    refreshFailed = false;
    const res = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (res?.user) {
      try { localStorage.setItem('agent_user', JSON.stringify(res.user)); } catch {}
    }
    return res;
  },
  logout: () => {
    refreshFailed = true;
    try { localStorage.removeItem('agent_user'); } catch {}
    return request('/auth/logout', { method: 'POST' });
  },
  refreshToken: () => request('/auth/refresh', { method: 'POST' }),
  session: () => request('/auth/session'),
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
  getActivePaymentMethods: (companyCode) => request(`/payments/methods/active${companyCode ? `?companyCode=${companyCode}` : ''}`),
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

  // 7. My Rewards & Referrals
  getRewards: () => request('/agent/rewards'),
  getReferrals: () => request('/agent/referrals'),

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
