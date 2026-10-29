/**
 * Production Date & Time Formatting Utilities for Rupadiya User Web
 * Eliminates timezone conversion shifts (+5:30 IST / +5:45 NPT) and provides clean, human-readable displays.
 */

/**
 * Returns a strict YYYY-MM-DD string in the user's LOCAL timezone.
 * Unlike date.toISOString().split('T')[0] which shifts to UTC, this respects local midnight.
 */
export function getLocalDateString(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses date inputs safely avoiding UTC midnight boundary roll-backs.
 */
export function parseLocalDate(input) {
  if (!input) return new Date();
  if (input instanceof Date) return input;
  
  const str = String(input).trim();
  // If format is YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    // Setting 12:00 (Noon) prevents any midnight edge roll-over in any timezone
    return new Date(y, m - 1, d, 12, 0, 0);
  }

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Formats a date value into human-readable text.
 * @param {Date|string|number} value
 * @param {'medium'|'full'|'short'|'dayMonth'|'weekday'} format
 */
export function formatDate(value, format = 'medium') {
  if (!value) return '';
  const d = parseLocalDate(value);
  if (isNaN(d.getTime())) return '';

  switch (format) {
    case 'full':
      return d.toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    case 'short':
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short'
      });
    case 'dayMonth':
      return `${d.getDate()} ${d.toLocaleDateString('en-IN', { month: 'short' })}`;
    case 'weekday':
      return d.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase();
    case 'medium':
    default:
      return d.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
  }
}

/**
 * Formats a time value (ISO string, 24-hr time, or timestamp) into clean 12-hour AM/PM format.
 * E.g., '2026-10-28T15:15:00.000Z' -> '08:45 PM' (in IST)
 * E.g., '15:15' -> '03:15 PM'
 * E.g., '08:45 PM' -> '08:45 PM'
 */
export function formatTime(value, fallback = '05:30 PM') {
  if (!value || value === 'Scheduled Time') return fallback;

  const str = String(value).trim();

  // If already formatted like '08:45 PM' or '8:45 pm'
  if (/^\d{1,2}:\d{2}\s*(am|pm)$/i.test(str)) {
    return str.toUpperCase();
  }

  // If 24-hour time like '15:15' or '09:30'
  if (/^\d{1,2}:\d{2}$/.test(str)) {
    const [h, m] = str.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hours12 = h % 12 || 12;
    return `${String(hours12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
  }

  // If ISO date string or full date representation (e.g. 2026-10-28T15:15:00.000Z)
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).toUpperCase();
  }

  return fallback;
}

/**
 * Combines date and time into a clean string.
 * E.g., 'Thu, 29 Oct 2026 · 08:45 PM'
 */
export function formatDateTime(value) {
  if (!value) return '';
  const dateStr = formatDate(value, 'medium');
  const timeStr = formatTime(value);
  return `${dateStr} · ${timeStr}`;
}

/**
 * Generates an array of future dates for the horizontal calendar strip using local dates.
 */
export function generateDateStrip(startDate = new Date(), count = 7) {
  const dates = [];
  const base = new Date(startDate);
  base.setHours(12, 0, 0, 0); // Noon anchor prevents midnight roll-over

  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);

    const iso = getLocalDateString(d);
    const dayNum = d.getDate();
    const dayName = d.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase();
    const monthName = d.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase();

    dates.push({
      iso,
      dayNum,
      dayName,
      monthName,
      fullDate: d
    });
  }

  return dates;
}

