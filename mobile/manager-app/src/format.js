/**
 * Formatting helpers: India / Nepal phone numbers, dates and times.
 * Stored phone numbers: India = 10 digits, Nepal = "977" + 10 digits.
 */

export function parsePhone(value) {
  const raw = String(value ?? '').trim();
  const d = raw.replace(/\D/g, '');
  if (raw.startsWith('+977') || (d.startsWith('977') && d.length === 13)) return { dial: '977', national: d.slice(3, 13), country: 'NP' };
  if (d.startsWith('91') && d.length === 12) return { dial: '91', national: d.slice(2), country: 'IN' };
  return { dial: '91', national: d.slice(-10), country: 'IN' };
}

export function formatPhone(value) {
  if (!value) return '';
  const { national, country } = parsePhone(value);
  if (national.length !== 10) return String(value);
  return country === 'NP'
    ? `+977 ${national.slice(0, 3)}-${national.slice(3)}`
    : `+91 ${national.slice(0, 5)} ${national.slice(5)}`;
}

export function telUrl(value) {
  const { dial, national } = parsePhone(value);
  return national.length === 10 ? `tel:+${dial}${national}` : null;
}

export const countryFlag = (value) => (parsePhone(value).country === 'NP' ? '🇳🇵' : '🇮🇳');

const pad = (n) => String(n).padStart(2, '0');

/** Local date key "2026-11-25" */
export function dateKey(d = new Date()) {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function fromKey(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(y, m - 1, d);
}

const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const weekday = (d) => WEEK[new Date(d).getDay()];
export const monthShort = (d) => MONTHS[new Date(d).getMonth()];

export function time(d) {
  if (!d) return '';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return String(d);
  let h = x.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${pad(x.getMinutes())} ${ampm}`;
}

export function dayLabel(d) {
  const x = new Date(d);
  const today = dateKey();
  const k = dateKey(x);
  if (k === today) return 'Today';
  if (k === dateKey(addDays(new Date(), 1))) return 'Tomorrow';
  if (k === dateKey(addDays(new Date(), -1))) return 'Yesterday';
  return `${weekday(x)}, ${x.getDate()} ${monthShort(x)}`;
}

export function dateTime(d) {
  if (!d) return '';
  const x = new Date(d);
  return `${x.getDate()} ${monthShort(x)}, ${time(x)}`;
}

/** Point time: ISO date → "9:30 PM"; free text ("Scheduled Time", "09:30 PM") is shown as is. */
export function pointTime(t) {
  if (!t) return '';
  const x = new Date(t);
  return Number.isNaN(x.getTime()) || !/\d{4}-\d{2}-\d{2}T/.test(String(t)) ? String(t) : time(x);
}

export const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export function genderShort(g) {
  return g === 'female' ? 'F' : g === 'male' ? 'M' : 'O';
}
