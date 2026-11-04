/**
 * Tab-Isolated Guest Session & Token Helper for Rupadiya User Web
 * Strictly uses sessionStorage so each browser tab/window has its own
 * isolated guest identity, seat holds, and rate limit bucket.
 */

const TAB_ID_KEY = 'rupadiya_tab_id';
const GUEST_TOKEN_KEY = 'rupadiya_tab_guest_token';

function generateRandomTabId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `tab_${crypto.randomUUID()}`;
  }
  return `tab_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Synchronously get or create the current tab ID from sessionStorage
 */
export function getTabId() {
  if (typeof window === 'undefined') return 'server_tab';
  try {
    let tabId = sessionStorage.getItem(TAB_ID_KEY);
    if (!tabId) {
      tabId = generateRandomTabId();
      sessionStorage.setItem(TAB_ID_KEY, tabId);
    }
    return tabId;
  } catch {
    return 'fallback_tab';
  }
}

/**
 * Synchronously get active guest token from sessionStorage
 */
export function getTabGuestToken() {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(GUEST_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Ensure the tab has a signed guest token from the API backend
 */
export async function ensureTabGuestToken(apiBaseUrl) {
  if (typeof window === 'undefined') return null;

  const tabId = getTabId();
  let token = getTabGuestToken();
  if (token) return token;

  const url = `${apiBaseUrl || 'http://localhost:4500/api/v1'}/auth/guest-token`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-rupadiya-client': 'web-client',
        'x-tab-id': tabId
      },
      body: JSON.stringify({ tabId }),
      credentials: 'include'
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const newToken = data.guestToken || data.token;
      if (newToken) {
        sessionStorage.setItem(GUEST_TOKEN_KEY, newToken);
        return newToken;
      }
    }
  } catch (err) {
    console.warn('[GuestTab] Could not establish signed tab guest token:', err.message);
  }
  return null;
}

/**
 * Returns request headers to attach to every outgoing API call
 */
export function getGuestTabHeaders() {
  if (typeof window === 'undefined') return {};
  const tabId = getTabId();
  const token = getTabGuestToken();

  const headers = {
    'x-tab-id': tabId
  };
  if (token) {
    headers['x-guest-token'] = token;
  }
  return headers;
}

