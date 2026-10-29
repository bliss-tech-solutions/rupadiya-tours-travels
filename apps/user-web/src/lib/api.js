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
  const headers = {
    'Content-Type': 'application/json',
    'x-rupadiya-client': 'web-client',
    ...(options.headers || {})
  };

  const url = `${API_BASE}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include' // Always pass httpOnly cookies (access_token, refresh_token, session)
    });

    // Handle 401 Unauthorized with automatic transparent 24hr silent token refresh
    if (res.status === 401 && !isRetry && !endpoint.startsWith('/auth/login') && !endpoint.startsWith('/auth/refresh') && !endpoint.startsWith('/auth/otp')) {
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-rupadiya-client': 'web-client'
            },
            credentials: 'include'
          });

          if (refreshRes.ok) {
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
  // Trips
  searchTrips: (from, to, date) => request(`/trips?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&date=${encodeURIComponent(date)}`),
  getTrip: (id) => request(`/trips/${id}`),
  
  // Seat holds
  holdSeats: (tripId, seatNumbers, passengerContext) => 
    request('/bookings/hold', {
      method: 'POST',
      body: JSON.stringify({ tripId, seatNumbers, passengerContext })
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

  // Auth (httpOnly cookies handled by browser)
  sendOtp: (phone) => request('/auth/otp/send', { method: 'POST', body: JSON.stringify({ phone }) }),
  verifyOtp: (phone, otp, name, email) => request('/auth/otp/verify', { method: 'POST', body: JSON.stringify({ phone, otp, name, email }) }),
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (userData) => request('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),
  refreshToken: () => request('/auth/refresh', { method: 'POST' }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  session: () => request('/auth/session'),
  me: () => request('/auth/me'),
  updateProfile: (data) => request('/auth/profile', { method: 'PUT', body: JSON.stringify(data) })
};
