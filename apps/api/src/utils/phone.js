/**
 * Phone numbers for India (+91) and Nepal (+977).
 *
 * Stored form (digits only):
 *   India  → 10 digits, e.g. "9876543210"         (unchanged from before, so old data keeps working)
 *   Nepal  → "977" + 10 digits, e.g. "9779812345678"
 *
 * Both countries use 10-digit mobiles, and many numbers are valid in both (98XXXXXXXX), so the
 * country is never guessed from the national number: clients send "+977…" (or countryCode: 'NP').
 */

const COUNTRIES = {
  IN: { code: 'IN', dial: '91', name: 'India', pattern: /^[6-9]\d{9}$/, example: '98765 43210' },
  NP: { code: 'NP', dial: '977', name: 'Nepal', pattern: /^9[6-8]\d{8}$/, example: '981-2345678' }
};

const digitsOf = (v) => String(v ?? '').replace(/\D/g, '');

/** Splits any input into { country, national } (national = 10 digits) without validating. */
function splitPhone(input, countryCode) {
  const raw = String(input ?? '').trim();
  let d = digitsOf(raw);
  const hinted = String(countryCode || '').toUpperCase();
  const wantsNepal = hinted === 'NP' || hinted === '977' || hinted === '+977';

  if (d.startsWith('977') && d.length === 13) return { country: 'NP', national: d.slice(3) };
  if (d.startsWith('9770') && d.length === 14) return { country: 'NP', national: d.slice(4) };
  if (d.startsWith('00977') && d.length === 15) return { country: 'NP', national: d.slice(5) };
  if (wantsNepal) {
    if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
    return { country: 'NP', national: d };
  }
  if (d.startsWith('0091') && d.length === 14) d = d.slice(4);
  else if (d.startsWith('91') && d.length === 12) d = d.slice(2);
  else if (d.startsWith('0') && d.length === 11) d = d.slice(1);
  return { country: 'IN', national: d };
}

/**
 * Returns the stored form of a mobile number, or null when it is not a valid Indian / Nepali mobile.
 * @param {string} input  e.g. "9876543210", "+91 98765 43210", "+977 9812345678", "9779812345678"
 * @param {string} [countryCode] 'IN' | 'NP' (optional when the input carries the dial code)
 */
function normalisePhone(input, countryCode) {
  const { country, national } = splitPhone(input, countryCode);
  if (!COUNTRIES[country].pattern.test(national)) return null;
  return country === 'NP' ? `977${national}` : national;
}

function isValidPhone(input, countryCode) {
  return normalisePhone(input, countryCode) !== null;
}

/** Parses a stored number back into { country, dial, national }. */
function parseStoredPhone(stored) {
  const d = digitsOf(stored);
  if (d.startsWith('977') && d.length === 13) return { country: 'NP', dial: '977', national: d.slice(3) };
  const national = d.length > 10 ? d.slice(-10) : d;
  return { country: 'IN', dial: '91', national };
}

/** International digits for WhatsApp / SMS, e.g. "919876543210" or "9779812345678". */
function toInternational(stored) {
  const p = parseStoredPhone(stored);
  if (p.national.length !== 10) return null;
  return `${p.dial}${p.national}`;
}

/** Human form: "+91 98765 43210" / "+977 981-2345678". */
function formatPhone(stored) {
  const p = parseStoredPhone(stored);
  if (p.national.length !== 10) return String(stored || '');
  return p.country === 'NP'
    ? `+977 ${p.national.slice(0, 3)}-${p.national.slice(3)}`
    : `+91 ${p.national.slice(0, 5)} ${p.national.slice(5)}`;
}

/** Message used by validators. */
const PHONE_ERROR = 'Enter a valid mobile number: India +91 (10 digits starting 6-9) or Nepal +977 (10 digits starting 96/97/98).';

module.exports = { COUNTRIES, normalisePhone, isValidPhone, parseStoredPhone, toInternational, formatPhone, splitPhone, PHONE_ERROR };
