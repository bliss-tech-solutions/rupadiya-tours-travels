import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

/**
 * API client for the bus-manager app.
 * Mobile apps cannot use the website's httpOnly cookies, so the access token lives in memory
 * and the refresh token in the device's secure storage (Keychain / Keystore).
 */
const CLIENT = 'manager-app';
const API_PORT = 4500;
const REQUEST_TIMEOUT_MS = 15000;
const SERVER_KEY = 'rbs_server';

const CONFIGURED_URL = (Constants.expoConfig?.extra?.apiUrl || '').trim();

// Old API hosts. A saved address pointing at one of these is replaced by the current default.
const RETIRED_SERVERS = [/\/\/rupadiya-tours-travels\.onrender\.com(\/|:|$)/i];

/** Normalises what a person types: "192.168.1.12" → "http://192.168.1.12:4500/api/v1". */
export function normaliseServerUrl(input) {
  let url = String(input || '').trim().replace(/\/+$/, '');
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  const parsed = url.match(/^(https?:\/\/)([^/:]+)(:\d+)?(\/.*)?$/i);
  if (!parsed) return url;
  const [, scheme, host, port, rest] = parsed;
  const finalPort = port || (scheme.toLowerCase() === 'http://' ? `:${API_PORT}` : '');
  const finalPath = rest && rest !== '/' ? rest.replace(/\/+$/, '') : '/api/v1';
  return `${scheme}${host}${finalPort}${finalPath}`;
}

/**
 * Picks the API address:
 * 1. an address saved on the login screen ("Server"),
 * 2. in development, the computer running `expo start` (the same machine runs the API),
 *    so a real phone in Expo Go works without editing app.json,
 * 3. expo.extra.apiUrl from app.json.
 */
function defaultServerUrl() {
  const isLocalConfig = !CONFIGURED_URL || /\/\/(10\.0\.2\.2|localhost|127\.0\.0\.1)(:|\/)/.test(CONFIGURED_URL);
  const hostUri = Constants.expoConfig?.hostUri || Constants.expoGoConfig?.debuggerHost || '';
  const devHost = hostUri.split(':')[0];
  if (__DEV__ && isLocalConfig && /^\d{1,3}(\.\d{1,3}){3}$/.test(devHost)) {
    return `http://${devHost}:${API_PORT}/api/v1`;
  }
  return normaliseServerUrl(CONFIGURED_URL) || `http://10.0.2.2:${API_PORT}/api/v1`;
}

let apiBase = defaultServerUrl();

export function getApiBase() {
  return apiBase;
}

/** Loads a saved server address (call once at start-up). */
export async function loadServerUrl() {
  const saved = await SecureStore.getItemAsync(SERVER_KEY).catch(() => null);
  // Addresses of servers that were moved: drop them so the app uses the current live API.
  if (saved && RETIRED_SERVERS.some((rx) => rx.test(saved))) {
    await SecureStore.deleteItemAsync(SERVER_KEY).catch(() => {});
    return apiBase;
  }
  if (saved) apiBase = saved;
  return apiBase;
}

/** Saves a server address typed on the login screen; empty resets to the automatic one. */
export async function setServerUrl(input) {
  const url = normaliseServerUrl(input);
  if (url) {
    apiBase = url;
    await SecureStore.setItemAsync(SERVER_KEY, url);
  } else {
    apiBase = defaultServerUrl();
    await SecureStore.deleteItemAsync(SERVER_KEY).catch(() => {});
  }
  return apiBase;
}

/** fetch with a timeout, so an unreachable server shows an error instead of spinning forever. */
async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

let accessToken = null;
let onLoggedOut = () => {};

export function setLoggedOutHandler(fn) {
  onLoggedOut = fn;
}

export async function saveSession({ accessToken: at, refreshToken, user }) {
  accessToken = at;
  if (refreshToken) await SecureStore.setItemAsync('rbs_refresh', refreshToken);
  if (user) await SecureStore.setItemAsync('rbs_user', JSON.stringify(user));
}

export async function clearSession() {
  accessToken = null;
  await SecureStore.deleteItemAsync('rbs_refresh').catch(() => {});
  await SecureStore.deleteItemAsync('rbs_user').catch(() => {});
}

export async function loadSavedUser() {
  const raw = await SecureStore.getItemAsync('rbs_user');
  return raw ? JSON.parse(raw) : null;
}

export function getAccessToken() {
  return accessToken;
}

async function refresh() {
  const refreshToken = await SecureStore.getItemAsync('rbs_refresh');
  if (!refreshToken) return false;
  let res;
  try {
    res = await fetchWithTimeout(`${apiBase}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-rupadiya-client': CLIENT },
      body: JSON.stringify({ refreshToken })
    });
  } catch {
    return false;
  }
  if (!res.ok) return false;
  const data = await res.json();
  await saveSession({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  return true;
}

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function request(path, { method = 'GET', body } = {}, retried = false) {
  let res;
  try {
    res = await fetchWithTimeout(`${apiBase}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-rupadiya-client': CLIENT,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (e) {
    const timedOut = e?.name === 'AbortError';
    throw new ApiError(
      timedOut
        ? `Server did not respond (${apiBase}). Check the Server address and that the API is running.`
        : `Cannot reach the server (${apiBase}). Check your internet / Wi-Fi and the Server address.`,
      0,
      'OFFLINE'
    );
  }

  if (res.status === 401 && !retried && !path.startsWith('/auth/')) {
    if (await refresh()) return request(path, { method, body }, true);
    await clearSession();
    onLoggedOut();
    throw new ApiError('Session expired. Please log in again.', 401);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new ApiError(data.error || `Request failed (${res.status})`, res.status, data.code);
  }
  return data;
}

export const api = {
  async login(email, password) {
    if (!email || !password) throw new ApiError('Enter your email and password.', 400);
    const data = await request('/auth/login', { method: 'POST', body: { email, password } });
    if (data.user?.role !== 'BUS_MANAGER') throw new ApiError('This app is only for bus managers.', 403);
    await saveSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
    return data.user;
  },
  async resume() {
    if (!(await refresh())) return null;
    return loadSavedUser();
  },
  async logout() {
    const refreshToken = await SecureStore.getItemAsync('rbs_refresh');
    await request('/auth/logout', { method: 'POST', body: { refreshToken } }).catch(() => {});
    await clearSession();
  },
  me: () => request('/manager/me'),
  calendar: (from, days = 15) => request(`/manager/calendar?from=${from}&days=${days}`),
  tripsForDate: (date) => request(`/manager/trips?date=${date}`),
  history: (from, to) => request(`/manager/history?from=${from}&to=${to}`),
  trips: (scope) => request(`/manager/trips?scope=${scope}`),
  manifest: (tripId) => request(`/manager/trips/${tripId}/manifest`),
  verify: (tripId, payload) => request(`/manager/trips/${tripId}/verify`, { method: 'POST', body: payload }),
  action: (tripId, type, payload) => request(`/manager/trips/${tripId}/${type}`, { method: 'POST', body: payload })
};

export function wsUrl() {
  const u = apiBase.replace(/\/api\/v1$/, '');
  return `${u.replace(/^http/, 'ws')}/ws`;
}
