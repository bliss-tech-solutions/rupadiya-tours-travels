/**
 * India (+91) and Nepal (+977) mobile numbers.
 *
 * Value used by forms and sent to the API:
 *   India → plain digits, e.g. "9876543210"
 *   Nepal → "+977" followed by digits, e.g. "+9779812345678"
 * The API stores Nepal numbers as "9779812345678" (13 digits); parsePhone understands both.
 */
export const PHONE_COUNTRIES = [
  { code: 'IN', dial: '91', name: 'India', pattern: /^[6-9]\d{9}$/, placeholder: '98765 43210', hint: '10 digits, starts with 6, 7, 8 or 9' },
  { code: 'NP', dial: '977', name: 'Nepal', pattern: /^9[6-8]\d{8}$/, placeholder: '981 2345678', hint: '10 digits, starts with 96, 97 or 98' }
];

export const countryByCode = (code) => PHONE_COUNTRIES.find((c) => c.code === code) || PHONE_COUNTRIES[0];

const digitsOf = (v) => String(v ?? '').replace(/\D/g, '');

/** "+9779812345678" | "9779812345678" | "9876543210" | "+91 98765 43210" → { country, national } */
export function parsePhone(value) {
  const raw = String(value ?? '').trim();
  const d = digitsOf(raw);
  if (raw.startsWith('+977') || (d.startsWith('977') && d.length === 13)) {
    return { country: 'NP', national: d.slice(3, 13) };
  }
  if ((raw.startsWith('+91') || d.length === 12) && d.startsWith('91')) return { country: 'IN', national: d.slice(2, 12) };
  return { country: 'IN', national: d.slice(-10) };
}

/** Builds the form/API value from a country and the typed national number. */
export function buildPhone(country, national) {
  const n = digitsOf(national).slice(0, 10);
  return country === 'NP' ? `+977${n}` : n;
}

export function isValidPhone(value) {
  const { country, national } = parsePhone(value);
  return countryByCode(country).pattern.test(national);
}

/** "+91 98765 43210" / "+977 981-2345678" */
export function formatPhone(value) {
  const { country, national } = parsePhone(value);
  if (national.length !== 10) return String(value || '');
  return country === 'NP'
    ? `+977 ${national.slice(0, 3)}-${national.slice(3)}`
    : `+91 ${national.slice(0, 5)} ${national.slice(5)}`;
}

/** Link for calling: tel:+919876543210 */
export function telHref(value) {
  const { country, national } = parsePhone(value);
  return `tel:+${countryByCode(country).dial}${national}`;
}

export const PHONE_ERROR = 'Enter a valid mobile number: India +91 (10 digits starting 6-9) or Nepal +977 (10 digits starting 96/97/98).';
