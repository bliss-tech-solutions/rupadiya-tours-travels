/**
 * Production Date & Time Formatting Utilities for Rupadiya Portals
 * Eliminates timezone conversion shifts (+5:30 IST / +5:45 NPT) and prevents raw ISO strings (e.g. 2026-10-28T11:30:00.000Z).
 */

// Bus times are India time for everyone (company staff in Nepal see the same times as the ticket).
const IST = 'Asia/Kolkata';

export function parseLocalDate(input) {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  
  const str = String(input).trim();
  if (!str) return null;

  // Format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(value, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!value) return '—';
  const d = parseLocalDate(value);
  if (!d) return String(value);
  return d.toLocaleDateString('en-IN', options);
}

export function formatTime(value) {
  if (!value) return '—';
  // If value is a simple "17:30" string
  if (/^\d{1,2}:\d{2}(\s*(AM|PM))?$/i.test(String(value).trim())) {
    const trimmed = String(value).trim();
    if (/AM|PM/i.test(trimmed)) return trimmed;
    const [h, m] = trimmed.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
  }

  const d = parseLocalDate(value);
  if (!d) return String(value);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: IST });
}

export function formatDateTime(value) {
  if (!value) return '—';
  const d = parseLocalDate(value);
  if (!d) return String(value);
  const datePart = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: IST });
  const timePart = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: IST });
  return `${datePart}, ${timePart}`;
}

export function formatDeparture(value) {
  if (!value) return 'Scheduled';
  const str = String(value).trim();

  // If already user-friendly like "17:30 Daily" or "18:00 Express"
  if (str.includes('Daily') || str.includes('Alternate') || str.includes('Weekly')) {
    return str;
  }

  // If raw ISO format like 2026-10-28T11:30:00.000Z
  if (str.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(str)) {
    const d = parseLocalDate(str);
    if (d) {
      const datePart = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: IST });
      const timePart = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: IST });
      return `${datePart} · ${timePart}`;
    }
  }

  return str;
}

