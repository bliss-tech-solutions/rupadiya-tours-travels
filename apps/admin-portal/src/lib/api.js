const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4500/api/v1';

let isRefreshing = false;
let refreshSubscribers = [];
let refreshFailed = false;

export function isAdminSessionValid() {
  if (typeof window === 'undefined') return false;
  return Boolean(localStorage.getItem('admin_user'));
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
      token = localStorage.getItem('admin_token');
    } catch {}
  }

  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'x-rupadiya-client': 'admin-portal',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const url = `${API_BASE}${endpoint}`;
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      ...options,
      headers,
      credentials: 'include' // Always pass httpOnly cookies
    });

    // Handle 304 Not Modified safely
    if (res.status === 304) {
      return { success: true };
    }

    if (res.status === 401 && !isRetry && !endpoint.startsWith('/auth/login') && !endpoint.startsWith('/auth/refresh') && !endpoint.startsWith('/auth/otp')) {
      const loginTime = typeof window !== 'undefined' ? parseInt(localStorage.getItem('admin_login_time') || '0', 10) : 0;
      const isRecentLogin = Date.now() - loginTime < 15000;

      if ((refreshFailed && !isRecentLogin) || !isAdminSessionValid()) {
        try { localStorage.removeItem('admin_user'); } catch {}
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login?reason=session_expired';
        }
        throw new Error('Super Admin session expired.');
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
              'x-rupadiya-client': 'admin-portal',
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            credentials: 'include'
          });

          if (refreshRes.ok || refreshRes.status === 304) {
            const refreshData = await refreshRes.json().catch(() => ({}));
            if (refreshData?.accessToken || refreshData?.token) {
              try { localStorage.setItem('admin_token', refreshData.accessToken || refreshData.token); } catch {}
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
              try { localStorage.removeItem('admin_user'); } catch {}
              if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
                window.location.href = '/login?reason=session_expired';
              }
              throw new Error('Super Admin session expired. Please sign in again.');
            }
            return { success: false, error: 'Token refresh failed' };
          }
        } catch (err) {
          isRefreshing = false;
          if (!isRecentLogin) {
            refreshFailed = true;
            onRefreshed(false);
            try { localStorage.removeItem('admin_user'); } catch {}
            if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
              window.location.href = '/login?reason=session_expired';
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
              reject(new Error('Super Admin session expired. Please sign in again.'));
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
      console.error(`Admin API Error: ${endpoint}`, err);
    }
    throw err;
  }
}

/** True when the signed-in super admin is the primary (main RBS) account. */
export function isPrimaryAdminSession() {
  if (typeof window === 'undefined') return false;
  try {
    const u = JSON.parse(localStorage.getItem('admin_user') || 'null');
    return u?.role === 'SUPER_ADMIN' && u?.adminLevel === 'PRIMARY';
  } catch {
    return false;
  }
}

/** Download a server-generated file (CSV) with the admin session. */
async function downloadFile(endpoint, fallbackName) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
  const res = await fetch(`${API_BASE}${endpoint}`, {
    credentials: 'include',
    headers: { 'x-rupadiya-client': 'admin-portal', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Download failed (${res.status})`);
  }
  const blob = await res.blob();
  const match = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = match ? match[1] : fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  // WhatsApp (RBS business number) & templates
  getWhatsappStatus: () => request('/admin/whatsapp/status'),
  connectWhatsapp: () => request('/admin/whatsapp/connect', { method: 'POST' }),
  logoutWhatsapp: () => request('/admin/whatsapp/logout', { method: 'POST' }),
  testWhatsapp: (phone, message) => request('/admin/whatsapp/test', { method: 'POST', body: JSON.stringify({ phone, message }) }),
  getWhatsappStats: (days = 30) => request(`/admin/whatsapp/stats?days=${encodeURIComponent(days)}`),
  retryFailedWhatsapp: (hours = 24) => request('/admin/whatsapp/retry-failed', { method: 'POST', body: JSON.stringify({ hours }) }),
  saveAdminNotifyPhones: (phones) => request('/admin/whatsapp/admin-phones', { method: 'PUT', body: JSON.stringify({ phones }) }),
  getTemplates: () => request('/admin/templates'),
  saveTemplate: (key, payload) => request(`/admin/templates/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify(payload) }),
  previewTemplate: (payload) => request('/admin/templates/preview', { method: 'POST', body: JSON.stringify(payload) }),
  getNotifications: (params = {}) => request(`/admin/notifications?${new URLSearchParams(params).toString()}`),
  retryNotification: (id) => request(`/admin/notifications/${id}/retry`, { method: 'POST' }),
  // Company settlements
  previewSettlements: (params) => request(`/admin/settlements/preview?${new URLSearchParams(params).toString()}`),
  downloadSettlementPreview: (params) => downloadFile(`/admin/settlements/preview.csv?${new URLSearchParams(params).toString()}`, 'settlement-preview.csv'),
  issueSettlement: (payload) => request('/admin/settlements', { method: 'POST', body: JSON.stringify(payload) }),
  getSettlementList: (params = {}) => request(`/admin/settlements?${new URLSearchParams(params).toString()}`),
  settleStatement: (id, payload) => request(`/admin/settlements/${id}/settle`, { method: 'POST', body: JSON.stringify(payload) }),
  voidStatement: (id) => request(`/admin/settlements/${id}/void`, { method: 'POST' }),
  downloadStatement: (id) => downloadFile(`/admin/settlements/${id}/export.csv`, 'statement.csv'),
  // Live journeys
  getJourneys: (date) => request(`/admin/journeys${date ? `?date=${date}` : ''}`),

  // Admin accounts (primary only) & user directory
  getAdmins: () => request('/admin/admins'),
  createAdmin: (payload) => request('/admin/admins', { method: 'POST', body: JSON.stringify(payload) }),
  updateAdmin: (id, payload) => request(`/admin/admins/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  getUsers: (params = {}) => request(`/admin/users?${new URLSearchParams(params).toString()}`),
  exportUsers: (params = {}) => downloadFile(`/admin/users/export?${new URLSearchParams(params).toString()}`, 'rupadiya-users.csv'),

  // Auth
  login: async (email, password) => {
    refreshFailed = false;
    const res = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    const token = res.accessToken || res.token || res.data?.token;
    if (token) {
      try { localStorage.setItem('admin_token', token); } catch {}
    }
    if (res?.user) {
      try { localStorage.setItem('admin_user', JSON.stringify(res.user)); } catch {}
    }
    try { localStorage.setItem('admin_login_time', Date.now().toString()); } catch {}
    return res;
  },
  logout: () => {
    refreshFailed = true;
    try { localStorage.removeItem('admin_user'); } catch {}
    try { localStorage.removeItem('admin_token'); } catch {}
    try { localStorage.removeItem('admin_login_time'); } catch {}
    return request('/auth/logout', { method: 'POST' });
  },
  refreshToken: () => request('/auth/refresh', { method: 'POST' }),
  session: () => request('/auth/session'),
  me: () => request('/auth/me'),

  // Command Center Overview
  getDashboard: () => request('/admin/dashboard'),

  // 34 Companies Management (Master Passenger Ranking)
  getCompanies: () => request('/admin/companies'),
  getCompanyByCode: (code) => request(`/admin/companies/${code}`),
  updateCompany: (code, payload) => request(`/admin/companies/${code}`, { method: 'PUT', body: JSON.stringify(payload) }),
  createCompanyWithOwner: (payload) => request('/admin/companies/create-with-owner', { method: 'POST', body: JSON.stringify(payload) }),
  assignCompanyOwner: (code, payload) => request(`/admin/companies/${code}/assign-owner`, { method: 'POST', body: JSON.stringify(payload) }),
  updateCompanyTarget: (code, targetPassengers) => request(`/admin/companies/${code}/target`, { method: 'PATCH', body: JSON.stringify({ targetPassengers }) }),

  // Global Agents Management (Across All 33 Companies)
  getGlobalAgents: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/admin/agents?${q}`);
  },
  getAgentById: (id) => request(`/admin/agents/${id}`),
  createAgent: (payload) => request('/admin/agents', { method: 'POST', body: JSON.stringify(payload) }),
  deleteAgent: (id) => request(`/admin/agents/${id}`, { method: 'DELETE' }),
  adjustAgentWallet: (id, payload) => request(`/admin/agents/${id}/wallet`, { method: 'POST', body: JSON.stringify(payload) }),
  toggleAgentStatus: (id, isActive) => request(`/admin/agents/${id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),

  // Fleet & Paper Expiry Compliance
  getFleet: () => request('/admin/fleet'),
  getFleetCompliance: () => request('/admin/fleet'),
  addBus: (payload) => request('/admin/fleet', { method: 'POST', body: JSON.stringify(payload) }),
  updateBus: (id, payload) => request(`/admin/fleet/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteBus: (id) => request(`/admin/fleet/${id}`, { method: 'DELETE' }),

  // File Upload with Strict 1MB Limit & Live Progress Tracking
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
          xhr.setRequestHeader('x-rupadiya-client', 'admin-portal');
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

  // Corridors & Fares
  getRoutes: () => request('/admin/routes'),
  createRoute: (payload) => request('/admin/routes', { method: 'POST', body: JSON.stringify(payload) }),
  updateRouteFare: (id, fare) => request(`/routes/${id}/fare`, { method: 'PATCH', body: JSON.stringify({ fare }) }),

  // Tours Manager
  listTours: () => request('/tours'),
  createTour: (tourData) => request('/tours', { method: 'POST', body: JSON.stringify(tourData) }),
  deleteTour: (id) => request(`/tours/${id}`, { method: 'DELETE' }),

  // Master Bookings
  getBookings: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/admin/bookings?${q}`);
  },

  // KYC Queue
  getPendingKyc: (status = 'PENDING') => request(`/admin/kyc?status=${status}`),
  approveKyc: (id, status, rejectionReason = '') => request(`/admin/kyc/${id}`, { method: 'PATCH', body: JSON.stringify({ status, rejectionReason }) }),

  // Tax Reports
  getTaxReports: () => request('/admin/reports/tax'),

  // Audit Logs
  getAuditLogs: () => request('/admin/audit-logs'),

  // Payment Methods Governance
  getPaymentMethodConfig: () => request('/payments/methods/config'),
  updatePaymentMethodConfig: (allowedMethods) => request('/payments/methods/config', { method: 'PUT', body: JSON.stringify({ allowedMethods }) }),

  // Refunds & Returns Desk (Super Admin Exclusive)
  getRefunds: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/admin/refunds?${q}`);
  },
  processRefund: (id, payload) => request(`/admin/refunds/${id}/process`, { method: 'POST', body: JSON.stringify(payload) }),
  rejectRefund: (id, reason) => request(`/admin/refunds/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  // Agent withdrawals (companies approve; RBS admin pays)
  getWithdrawals: (params = {}) => { const q = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null))).toString(); return request(`/admin/withdrawals${q ? `?${q}` : ''}`); },
  getWithdrawalPayoutConfig: () => request('/admin/withdrawals/payout-config'),
  payWithdrawal: (id, payload) => request(`/admin/withdrawals/${id}/pay`, { method: 'POST', body: JSON.stringify(payload) }),
  rejectWithdrawal: (id, reason) => request(`/admin/withdrawals/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),

  // Finance & reconciliation
  getFinanceOverview: () => request('/admin/finance/reconciliation'),
  runReconciliation: ({ days, autoHeal }) => request('/admin/finance/reconciliation/run', { method: 'POST', body: JSON.stringify({ days, autoHeal }) }),
  syncPayouts: () => request('/admin/finance/payouts/sync', { method: 'POST' }),
};
