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
  let token = null;
  if (typeof window !== 'undefined') {
    try {
      token = localStorage.getItem('agent_token');
    } catch {}
  }

  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'x-rupadiya-client': 'agent-portal',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
      const loginTime = typeof window !== 'undefined' ? parseInt(localStorage.getItem('agent_login_time') || '0', 10) : 0;
      const isRecentLogin = Date.now() - loginTime < 15000;

      if ((refreshFailed && !isRecentLogin) || !isAgentSessionValid()) {
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
            cache: 'no-store',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'x-rupadiya-client': 'agent-portal',
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            credentials: 'include'
          });

          if (refreshRes.ok || refreshRes.status === 304) {
            const refreshData = await refreshRes.json().catch(() => ({}));
            if (refreshData?.accessToken || refreshData?.token) {
              try { localStorage.setItem('agent_token', refreshData.accessToken || refreshData.token); } catch {}
            }
            isRefreshing = false;
            refreshFailed = false;
            onRefreshed(true);
            return request(endpoint, options, true);
          } else {
            isRefreshing = false;
            if (!isRecentLogin) {
              refreshFailed = true;
              onRefreshed(false);
              try { localStorage.removeItem('agent_user'); } catch {}
              if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
                window.location.href = '/login';
              }
              throw new Error('Agent session expired. Please sign in again.');
            }
            return { success: false, error: 'Token refresh failed' };
          }
        } catch (err) {
          isRefreshing = false;
          if (!isRecentLogin) {
            refreshFailed = true;
            onRefreshed(false);
            try { localStorage.removeItem('agent_user'); } catch {}
            if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
              window.location.href = '/login';
            }
            throw err;
          }
          return { success: false, error: err.message };
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
    const token = res.accessToken || res.token || res.data?.token;
    if (token) {
      try { localStorage.setItem('agent_token', token); } catch {}
    }
    if (res?.user) {
      try { localStorage.setItem('agent_user', JSON.stringify(res.user)); } catch {}
    }
    try { localStorage.setItem('agent_login_time', Date.now().toString()); } catch {}
    return res;
  },
  logout: () => {
    refreshFailed = true;
    try { localStorage.removeItem('agent_user'); } catch {}
    try { localStorage.removeItem('agent_token'); } catch {}
    try { localStorage.removeItem('agent_login_time'); } catch {}
    return request('/auth/logout', { method: 'POST' });
  },
  refreshToken: () => request('/auth/refresh', { method: 'POST' }),
  session: () => request('/auth/session'),
  me: () => request('/auth/me'),

  // File Upload with Strict 1MB Limit
  uploadFile: (file, folder = 'documents', onProgress = null) => {
    return new Promise((resolve, reject) => {
      if (!file) {
        return reject(new Error('No file selected for upload.'));
      }
      // Strict 1MB validation (1,048,576 bytes)
      if (file.size > 1024 * 1024) {
        return reject(new Error(`File "${file.name}" exceeds 1MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB). Please select a file under 1MB.`));
      }

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const base64Data = reader.result;
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `${API_BASE}/upload/direct`);
          xhr.setRequestHeader('Content-Type', 'application/json');
          xhr.setRequestHeader('x-rupadiya-client', 'agent-portal');
          xhr.withCredentials = true;

          if (xhr.upload && onProgress) {
            xhr.upload.onprogress = (evt) => {
              if (evt.lengthComputable) {
                const percent = Math.round((evt.loaded / evt.total) * 100);
                onProgress(percent);
              }
            };
          }

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              const data = JSON.parse(xhr.responseText);
              let url = data.url;
              if (url && url.startsWith('/uploads')) {
                const backendBase = API_BASE.replace(/\/api\/v1\/?$/, '');
                url = `${backendBase}${url}`;
              }
              resolve({ success: true, url, key: data.key });
            } else {
              let errMsg = `Upload failed with status ${xhr.status}`;
              try {
                const errData = JSON.parse(xhr.responseText);
                if (errData?.error) errMsg = errData.error;
              } catch {}
              reject(new Error(errMsg));
            }
          };

          xhr.onerror = () => reject(new Error('Network error during file upload'));
          xhr.send(JSON.stringify({
            folder,
            fileName: file.name,
            contentType: file.type || 'application/octet-stream',
            base64Data
          }));
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  },

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
    const cleanParams = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '' && v !== 'undefined' && v !== 'ALL') {
        cleanParams[k] = v;
      }
    }
    const query = new URLSearchParams(cleanParams).toString();
    return request(`/agent/deposits${query ? `?${query}` : ''}`);
  },

  // 4. Statement
  getStatement: (params = {}) => {
    const cleanParams = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '' && v !== 'undefined' && v !== 'ALL') {
        cleanParams[k] = v;
      }
    }
    const query = new URLSearchParams(cleanParams).toString();
    return request(`/agent/statement${query ? `?${query}` : ''}`);
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

  // 5B. Booking History
  getBookings: (params = {}) => {
    const cleanParams = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '' && v !== 'undefined' && v !== 'ALL') {
        cleanParams[k] = v;
      }
    }
    const query = new URLSearchParams(cleanParams).toString();
    return request(`/agent/bookings${query ? `?${query}` : ''}`);
  },

  // 6. Cancel Ticket
  cancelTicket: (payload) => request('/agent/tickets/cancel', { method: 'POST', body: JSON.stringify(payload) }),

  // 7. My Rewards & Referrals
  getRewards: () => request('/agent/rewards'),
  getReferrals: () => request('/agent/referrals'),
  refreshReferralCode: () => request('/agent/referral-code/refresh', { method: 'POST' }),

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
  getKycStatus: () => request('/kyc/status'),
  uploadKyc: (payload) => request('/kyc/upload', { method: 'POST', body: JSON.stringify(payload) }),
  submitKyc: (payload) => request('/kyc/upload', { method: 'POST', body: JSON.stringify(payload) }),

  // Agent Earnings Withdrawals & Bank Transfers
  requestWithdrawal: (payload, legacyDetails) => {
    const body = (typeof payload === 'object' && payload !== null)
      ? payload
      : { amount: payload, payoutDetails: legacyDetails };
    return request('/withdrawals', { method: 'POST', body: JSON.stringify(body) });
  },
  getMyWithdrawals: () => request('/withdrawals/mine'),
  getWithdrawalSummary: () => request('/withdrawals/mine'),
};
