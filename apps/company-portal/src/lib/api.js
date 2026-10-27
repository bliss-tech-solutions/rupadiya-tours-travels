const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4500/api/v1';

async function request(endpoint, options = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('owner_token') : null;
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
    console.error(`Company API Error: ${endpoint}`, err);
    throw err;
  }
}

export const api = {
  // Auth
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request('/auth/me'),

  // Company Overview & Fleet
  getCompanyOverview: () => request('/companies/me'),
  getBuses: () => request('/fleet/buses'),
  addBus: (busData) => request('/fleet/buses', { method: 'POST', body: JSON.stringify(busData) }),
  
  // Trips & Scheduler
  getTrips: () => request('/trips'),
  scheduleTrip: (tripData) => request('/trips', { method: 'POST', body: JSON.stringify(tripData) }),

  // Agents & Performance
  getCompanyAgents: () => request('/companies/agents'),
  getTargets: () => request('/companies/targets'),
};

