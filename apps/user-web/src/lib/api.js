const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4500/api/v1';

async function request(endpoint, options = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('rupadiya_token') : null;
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
      const errorMsg = data.message || `Request failed with status ${res.status}`;
      throw new Error(errorMsg);
    }
    return data;
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
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

  // Auth
  sendOtp: (phone) => request('/auth/otp/send', { method: 'POST', body: JSON.stringify({ phone }) }),
  verifyOtp: (phone, otp, name, email) => request('/auth/otp/verify', { method: 'POST', body: JSON.stringify({ phone, otp, name, email }) }),
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (userData) => request('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),
  me: () => request('/auth/me'),
  updateProfile: (data) => request('/auth/profile', { method: 'PUT', body: JSON.stringify(data) })
};

