const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4500/api/v1';

const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export function isOwnerSessionValid() {
  if (typeof window === 'undefined') return false;
  const token = localStorage.getItem('owner_token');
  const loginTimeStr = localStorage.getItem('owner_login_time');
  if (!token || !loginTimeStr) return false;

  const loginTime = parseInt(loginTimeStr, 10);
  if (isNaN(loginTime)) return false;

  const isExpired = Date.now() - loginTime > SESSION_MAX_AGE_MS;
  if (isExpired) {
    clearOwnerSession();
    return false;
  }
  return true;
}

export function saveOwnerSession(token, user) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('owner_token', token);
  localStorage.setItem('owner_user', JSON.stringify(user));
  localStorage.setItem('owner_login_time', String(Date.now()));
}

export function clearOwnerSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('owner_token');
  localStorage.removeItem('owner_user');
  localStorage.removeItem('owner_login_time');
}

export function getSessionRemainingTime() {
  if (typeof window === 'undefined') return null;
  const loginTimeStr = localStorage.getItem('owner_login_time');
  if (!loginTimeStr) return null;
  const loginTime = parseInt(loginTimeStr, 10);
  if (isNaN(loginTime)) return null;
  const elapsed = Date.now() - loginTime;
  const remaining = SESSION_MAX_AGE_MS - elapsed;
  if (remaining <= 0) return 0;
  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  return `${hours}h ${minutes}m left`;
}

async function request(endpoint, options = {}) {
  const isAuthRoute = endpoint.startsWith('/auth/login') || endpoint.startsWith('/auth/register');

  if (!isAuthRoute && typeof window !== 'undefined') {
    if (!isOwnerSessionValid()) {
      clearOwnerSession();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login?expired=1';
      }
      throw new Error('24-hour session expired. Please sign in again.');
    }
  }

  const token = typeof window !== 'undefined' ? localStorage.getItem('owner_token') : null;
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const url = `${API_BASE}${endpoint}`;
  try {
    const res = await fetch(url, { ...options, headers });
    
    if (res.status === 401 && !isAuthRoute && typeof window !== 'undefined') {
      clearOwnerSession();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login?expired=1';
      }
      throw new Error('Session unauthorized or expired.');
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || `Request failed with status ${res.status}`);
    }
    return data;
  } catch (err) {
    console.error(`Company API Error: ${endpoint}`, err);
    throw err;
  }
}

export const api = {
  // Auth
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (payload) => request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  me: () => request('/auth/me'),

  // Company Overview & Wallet
  getDashboard: () => request('/owner/dashboard'),
  getCompanyOverview: () => request('/owner/dashboard'),
  depositCompanyWallet: (amount, paymentMethod = 'UPI') => request('/owner/wallet/deposit', { method: 'POST', body: JSON.stringify({ amount, paymentMethod }) }),
  updatePaymentMethods: (paymentMethods) => request('/owner/payment-methods', { method: 'PATCH', body: JSON.stringify({ paymentMethods }) }),
  getPaymentConfig: () => request('/payments/config'),
  createPaymentOrder: (payload) => request('/payments/create-order', { method: 'POST', body: JSON.stringify(payload) }),
  verifyPayment: (payload) => request('/payments/verify', { method: 'POST', body: JSON.stringify(payload) }),

  // Fleet & Buses
  getBuses: () => request('/owner/fleet'),
  getFleet: () => request('/owner/fleet'),
  addBus: (busData) => request('/owner/fleet', { method: 'POST', body: JSON.stringify(busData) }),
  updateBus: (id, busData) => request(`/owner/fleet/${id}`, { method: 'PUT', body: JSON.stringify(busData) }),
  deleteBus: (id) => request(`/owner/fleet/${id}`, { method: 'DELETE' }),

  // Trips & Scheduler
  getTrips: () => request('/trips'),
  scheduleTrip: (tripData) => request('/trips', { method: 'POST', body: JSON.stringify(tripData) }),

  // Agents Management
  getAgents: () => request('/owner/agents'),
  getCompanyAgents: () => request('/owner/agents'),
  createAgent: (payload) => request('/owner/agents', { method: 'POST', body: JSON.stringify(payload) }),
  deleteAgent: (id) => request(`/owner/agents/${id}`, { method: 'DELETE' }),
  addAgentWallet: (id, amount, note) => request(`/owner/agents/${id}/wallet`, { method: 'POST', body: JSON.stringify({ amount, note }) }),
  toggleAgentStatus: (id, isActive) => request(`/owner/agents/${id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),

  // Agent Withdrawals Queue
  getWithdrawals: () => request('/owner/withdrawals'),
  approveWithdrawal: (id) => request(`/owner/withdrawals/${id}/approve`, { method: 'POST' }),
  rejectWithdrawal: (id, reason) => request(`/owner/withdrawals/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),

  // Reports & Network
  getReports: () => request('/owner/reports'),
  getTargets: () => request('/owner/reports'),
  getNetwork: () => request('/owner/network'),
};
