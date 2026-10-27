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
      throw new Error(data.message || `Request failed with status ${res.status}`);
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

  // Companies (33)
  getCompanies: () => request('/companies'),
  
  // Corridors & Fares
  getRoutes: () => request('/routes'),
  updateRouteFare: (id, fare) => request(`/routes/${id}/fare`, { method: 'PATCH', body: JSON.stringify({ fare }) }),

  // Tours Manager
  listTours: () => request('/tours'),
  createTour: (tourData) => request('/tours', { method: 'POST', body: JSON.stringify(tourData) }),
  deleteTour: (id) => request(`/tours/${id}`, { method: 'DELETE' }),

  // Master Bookings
  getBookings: () => request('/bookings'),

  // KYC
  getPendingKyc: () => request('/kyc/pending'),
  approveKyc: (id, status) => request(`/kyc/${id}/verify`, { method: 'POST', body: JSON.stringify({ status }) }),

  // Tax Reports
  getTaxReports: () => request('/reports/tax'),
};

