const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4500/api/v1';

let isRefreshing = false;
let refreshSubscribers = [];
let refreshFailed = false;

export function isOwnerSessionValid() {
  if (typeof window === 'undefined') return true;
  return Boolean(localStorage.getItem('owner_user'));
}

export function saveOwnerSession(_token, user) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('owner_token'); // Do not save token in localStorage
    if (user) {
      localStorage.setItem('owner_user', JSON.stringify(user));
    }
    refreshFailed = false; // Reset failure flag on successful login
  } catch {}
}

export function clearOwnerSession() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('owner_token');
    localStorage.removeItem('owner_user');
    localStorage.removeItem('owner_login_time');
    refreshFailed = true;
  } catch {}
}

export function getSessionRemainingTime() {
  return '24h active';
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
    'x-rupadiya-client': 'company-portal',
    ...(options.headers || {})
  };

  const url = `${API_BASE}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include' // Passes httpOnly cookies
    });

    if (res.status === 401 && !isRetry && !endpoint.startsWith('/auth/login') && !endpoint.startsWith('/auth/refresh') && !endpoint.startsWith('/auth/otp')) {
      // If refresh already failed or user not logged in, stop immediately
      if (refreshFailed || !isOwnerSessionValid()) {
        clearOwnerSession();
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login?expired=1';
        }
        throw new Error('Authentication required. Please sign in.');
      }

      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-rupadiya-client': 'company-portal'
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
            clearOwnerSession();
            if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
              window.location.href = '/login?expired=1';
            }
            throw new Error('Company owner session expired. Please sign in again.');
          }
        } catch (rErr) {
          isRefreshing = false;
          refreshFailed = true;
          onRefreshed(false);
          clearOwnerSession();
          if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
            window.location.href = '/login?expired=1';
          }
          throw rErr;
        }
      } else {
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh((success) => {
            if (success) {
              resolve(request(endpoint, options, true));
            } else {
              reject(new Error('Company owner session expired. Please sign in again.'));
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
      console.error(`Company API Error: ${endpoint}`, err);
    }
    throw err;
  }
}

export const api = {
  // Auth
  login: async (email, password) => {
    refreshFailed = false;
    const res = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (res?.user) {
      saveOwnerSession(null, res.user);
    }
    return res;
  },
  register: (payload) => request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  refreshToken: () => request('/auth/refresh', { method: 'POST' }),
  session: () => request('/auth/session'),
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

  // File Upload with Live Progress
  uploadFile: (file, folder = 'documents', onProgress = null) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const base64Data = reader.result;
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `${API_BASE}/upload/direct`);
          xhr.setRequestHeader('Content-Type', 'application/json');
          xhr.setRequestHeader('x-rupadiya-client', 'company-portal');
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
                url = `http://localhost:4500${url}`;
              }
              resolve({ success: true, url, key: data.key });
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
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

  // Trips & Scheduler
  getTrips: () => request('/owner/trips'),
  scheduleTrip: (tripData) => request('/owner/trips', { method: 'POST', body: JSON.stringify(tripData) }),
  prepareSeatChart: (tripId) => request(`/owner/trips/${tripId}/prepare-chart`, { method: 'POST' }),
  getSeatChart: (tripId) => request(`/owner/trips/${tripId}/seat-chart`),

  // Levels & Hierarchy
  getLevels: () => request('/owner/levels'),
  updateAgentLevel: (id, payload) => request(`/owner/agents/${id}/level`, { method: 'PUT', body: JSON.stringify(payload) }),

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

  // Payment Methods Governance
  getPaymentMethodConfig: () => request('/payments/methods/config'),
  updatePaymentMethodConfig: (allowedMethods) => request('/payments/methods/config', { method: 'PUT', body: JSON.stringify({ allowedMethods }) }),
};
