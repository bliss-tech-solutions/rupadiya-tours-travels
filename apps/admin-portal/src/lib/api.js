const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4500/api/v1';

async function request(endpoint, options = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const url = `${API_BASE}${endpoint}`;
  try {
    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || `Request failed with status ${res.status}`);
    }
    return data;
  } catch (err) {
    console.error(`Admin API Error: ${endpoint}`, err);
    throw err;
  }
}

export const api = {
  // Auth
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request('/auth/me'),

  // Command Center Overview
  getDashboard: () => request('/admin/dashboard'),

  // 33 Companies Management
  getCompanies: () => request('/admin/companies'),
  assignCompanyOwner: (code, payload) => request(`/admin/companies/${code}/assign-owner`, { method: 'POST', body: JSON.stringify(payload) }),
  updateCompanyTarget: (code, targetPassengers) => request(`/admin/companies/${code}/target`, { method: 'PATCH', body: JSON.stringify({ targetPassengers }) }),

  // Global Agents Management (Across All 33 Companies)
  getGlobalAgents: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/admin/agents?${q}`);
  },
  createAgent: (payload) => request('/admin/agents', { method: 'POST', body: JSON.stringify(payload) }),
  deleteAgent: (id) => request(`/admin/agents/${id}`, { method: 'DELETE' }),
  adjustAgentWallet: (id, payload) => request(`/admin/agents/${id}/wallet`, { method: 'POST', body: JSON.stringify(payload) }),

  // Fleet & Paper Expiry Compliance
  getFleet: () => request('/admin/fleet'),
  getFleetCompliance: () => request('/admin/fleet'),
  addBus: (payload) => request('/admin/buses', { method: 'POST', body: JSON.stringify(payload) }),

  // Corridors & Fares
  getRoutes: () => request('/admin/routes'),
  createRoute: (payload) => request('/admin/routes', { method: 'POST', body: JSON.stringify(payload) }),
  updateRouteFare: (id, fare) => request(`/routes/${id}/fare`, { method: 'PATCH', body: JSON.stringify({ fare }) }),

  // Tours Manager
  listTours: () => request('/tours'),
  createTour: (tourData) => request('/tours', { method: 'POST', body: JSON.stringify(tourData) }),
  deleteTour: (id) => request(`/tours/${id}`, { method: 'DELETE' }),

  // Master Bookings
  getBookings: () => request('/bookings'),

  // KYC Queue
  getPendingKyc: (status = 'PENDING') => request(`/admin/kyc?status=${status}`),
  approveKyc: (id, status, rejectionReason = '') => request(`/admin/kyc/${id}`, { method: 'PATCH', body: JSON.stringify({ status, rejectionReason }) }),

  // Tax Reports
  getTaxReports: () => request('/admin/reports/tax'),

  // Audit Logs
  getAuditLogs: () => request('/admin/audit-logs'),
};
