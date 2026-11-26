import { getGuestTabHeaders, ensureTabGuestToken } from './guestTab';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4500/api/v1';

let isRefreshing = false;
let refreshSubscribers = [];

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
      token = localStorage.getItem('user_token');
    } catch {}

    // Ensure tab-isolated guest token is initialized for unauthenticated visitor tabs
    if (!endpoint.startsWith('/auth/guest-token')) {
      await ensureTabGuestToken(API_BASE);
    }
  }

  const tabHeaders = typeof window !== 'undefined' ? getGuestTabHeaders() : {};

  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'x-rupadiya-client': 'web-client',
    ...tabHeaders,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const url = `${API_BASE}${endpoint}`;
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      ...options,
      headers,
      credentials: 'include' // Always pass httpOnly cookies (access_token, refresh_token, session)
    });

    if (res.status === 304) {
      return { success: true };
    }

    // Handle 401 Unauthorized with automatic transparent 24hr silent token refresh
    if (res.status === 401 && !isRetry && !endpoint.startsWith('/auth/login') && !endpoint.startsWith('/auth/refresh') && !endpoint.startsWith('/auth/otp') && !endpoint.startsWith('/auth/guest-token')) {
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
              'x-rupadiya-client': 'web-client',
              ...tabHeaders,
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            credentials: 'include'
          });

          if (refreshRes.ok || refreshRes.status === 304) {
            const refreshData = await refreshRes.json().catch(() => ({}));
            if (refreshData?.accessToken || refreshData?.token) {
              try { localStorage.setItem('user_token', refreshData.accessToken || refreshData.token); } catch {}
            }
            isRefreshing = false;
            onRefreshed(true);
            return request(endpoint, options, true); // Retry original call
          } else {
            isRefreshing = false;
            onRefreshed(false);
          }
        } catch {
          isRefreshing = false;
          onRefreshed(false);
        }
      } else {
        // Wait for active refresh to finish then retry
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh((success) => {
            if (success) {
              resolve(request(endpoint, options, true));
            } else {
              reject(new Error('Session expired. Please sign in again.'));
            }
          });
        });
      }
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errorMsg = data.error || data.message || `Request failed with status ${res.status}`;
      throw new Error(errorMsg);
    }
    return data;
  } catch (err) {
    if (!isRetry) {
      console.error(`API Error on ${endpoint}:`, err);
    }
    throw err;
  }
}

export const api = {
  // Tab-isolated guest session
  initGuestTab: () => ensureTabGuestToken(API_BASE),

  // Trips
  searchTrips: (from, to, date) => request(`/trips?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&date=${encodeURIComponent(date)}`),
  getTrip: (id) => request(`/trips/${id}`),
  
  // Seat holds
  holdSeats: (tripId, seatNumbers, passengerContext) => 
    request('/bookings/hold', {
      method: 'POST',
      body: JSON.stringify({ tripId, seatNumbers, passengerContext })
    }),
  getQuote: ({ tripId, seatNumbers, insuranceOpted, offerCode, holdToken }) =>
    request('/bookings/quote', {
      method: 'POST',
      body: JSON.stringify({ tripId, seatNumbers, insuranceOpted, offerCode, holdToken })
    }),
  releaseHold: (holdId) =>
    request('/bookings/hold/release', {
      method: 'POST',
      body: JSON.stringify({ holdId, holdToken: holdId })
    }),
    
  // Razorpay Payments
  getPaymentConfig: () => request('/payments/config'),
  getActivePaymentMethods: (companyCode) => request(`/payments/methods/active${companyCode ? `?companyCode=${companyCode}` : ''}`),
  createPaymentOrder: (payload) => request('/payments/create-order', { method: 'POST', body: JSON.stringify(payload) }),
  verifyPayment: (payload) => request('/payments/verify', { method: 'POST', body: JSON.stringify(payload) }),

  // Bookings
  confirmBooking: (bookingPayload) =>
    request('/bookings/confirm', {
      method: 'POST',
      body: JSON.stringify(bookingPayload)
    }),
  getBooking: (id) => request(`/bookings/${id}`),
  getMyBookings: () => request('/bookings/my-bookings'),
  
  // Tours
  listTours: () => request('/tours'),
  getTour: (id) => request(`/tours/${id}`),
  bookTour: (tourPayload) =>
    request('/tours/book', {
      method: 'POST',
      body: JSON.stringify(tourPayload)
    }),
  getMyTourBookings: () => request('/tours/my-bookings'),
  
  // Calendar low-fare
  getCalendarFares: (from, to, month) =>
    request(`/trips/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&month=${encodeURIComponent(month || '')}`),

  // Auth (httpOnly cookies handled by browser with token fallback)
  sendOtp: (phone) => request('/auth/otp/send', { method: 'POST', body: JSON.stringify({ phone }) }),
  verifyOtp: async (phone, otp, name, email) => {
    const res = await request('/auth/otp/verify', { method: 'POST', body: JSON.stringify({ phone, otp, name, email }) });
    const token = res.accessToken || res.token || res.data?.token;
    if (token) {
      try { localStorage.setItem('user_token', token); } catch {}
    }
    return res;
  },
  login: async (email, password) => {
    const res = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    const token = res.accessToken || res.token || res.data?.token;
    if (token) {
      try { localStorage.setItem('user_token', token); } catch {}
    }
    return res;
  },
  register: (userData) => request('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),
  refreshToken: () => request('/auth/refresh', { method: 'POST' }),
  logout: () => {
    try { localStorage.removeItem('user_token'); } catch {}
    return request('/auth/logout', { method: 'POST' });
  },
  session: () => request('/auth/session'),
  me: () => request('/auth/me'),
  updateProfile: (data) => request('/auth/profile', { method: 'PUT', body: JSON.stringify(data) })
};
