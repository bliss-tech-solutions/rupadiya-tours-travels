/**
 * Bikram Sambat (Nepali calendar) <-> Gregorian (AD) conversion, no dependencies.
 *
 * Month lengths per BS year come from the published Nepali calendar, as kept in the
 * `nepali-date-converter` package (MIT, v3.4.2). Checked against Nepali New Year:
 * 2080/01/01 = 2023-04-14, 2081/01/01 = 2024-04-13, 2082/01/01 = 2025-04-14, 2083/01/01 = 2026-04-14.
 * Covers BS 2070 – 2090 (AD 2013-04-14 – 2034-04). Add a year row when the government publishes it.
 *
 * All AD dates are 'YYYY-MM-DD' strings handled in UTC, so the browser time zone never shifts a day.
 */

const BS_MONTH_DAYS = {
  2070: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  2071: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2072: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2073: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2074: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2075: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2076: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2077: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2078: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2079: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2080: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2081: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2082: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2083: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2084: [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30],
  2085: [31, 32, 31, 32, 30, 31, 30, 30, 29, 30, 30, 30],
  2086: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  2087: [31, 31, 32, 31, 31, 31, 30, 30, 29, 30, 30, 30],
  2088: [30, 31, 32, 32, 30, 31, 30, 30, 29, 30, 30, 30],
  2089: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  2090: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30]
};

const FIRST_YEAR = 2070;
const LAST_YEAR = 2090;
const ANCHOR_AD = Date.UTC(2013, 3, 14); // BS 2070/01/01
const DAY = 86400000;

export const BS_MONTHS_NE = ['बैशाख', 'जेठ', 'असार', 'साउन', 'भदौ', 'असोज', 'कात्तिक', 'मंसिर', 'पुस', 'माघ', 'फागुन', 'चैत'];
export const BS_MONTHS_EN = ['Baisakh', 'Jestha', 'Asar', 'Shrawan', 'Bhadra', 'Asoj', 'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'];
export const WEEKDAYS_NE = ['आइत', 'सोम', 'मंगल', 'बुध', 'बिहि', 'शुक्र', 'शनि'];
export const WEEKDAYS_NE_LONG = ['आइतबार', 'सोमबार', 'मंगलबार', 'बुधबार', 'बिहिबार', 'शुक्रबार', 'शनिबार'];

const NE_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
export const toNepaliDigits = (v) => String(v).replace(/\d/g, (d) => NE_DIGITS[d]);

const isoToUtc = (iso) => {
  const [y, m, d] = String(iso).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const utcToIso = (t) => new Date(t).toISOString().slice(0, 10);

export const isBsYearSupported = (y) => y >= FIRST_YEAR && y <= LAST_YEAR;
export const bsMonthDays = (y, m) => (BS_MONTH_DAYS[y] ? BS_MONTH_DAYS[y][m] : 30);

/** 'YYYY-MM-DD' (AD) -> { year, month (0-11), day } in BS, or null when out of range. */
export function adToBs(iso) {
  let days = Math.round((isoToUtc(iso) - ANCHOR_AD) / DAY);
  if (!Number.isFinite(days) || days < 0) return null;
  for (let y = FIRST_YEAR; y <= LAST_YEAR; y++) {
    const months = BS_MONTH_DAYS[y];
    for (let m = 0; m < 12; m++) {
      if (days < months[m]) return { year: y, month: m, day: days + 1 };
      days -= months[m];
    }
  }
  return null;
}

/** BS { year, month (0-11), day } -> 'YYYY-MM-DD' (AD), or null when out of range. */
export function bsToAd(year, month, day) {
  if (!isBsYearSupported(year)) return null;
  let days = 0;
  for (let y = FIRST_YEAR; y < year; y++) days += BS_MONTH_DAYS[y].reduce((a, b) => a + b, 0);
  for (let m = 0; m < month; m++) days += BS_MONTH_DAYS[year][m];
  days += day - 1;
  return utcToIso(ANCHOR_AD + days * DAY);
}

/** "शुक्रबार, ११ मंसिर २०८३" (or English month names when lang is not 'ne'). */
export function formatBs(iso, { lang = 'ne', weekday = true } = {}) {
  const bs = adToBs(iso);
  if (!bs) return '';
  const wd = new Date(isoToUtc(iso)).getUTCDay();
  if (lang === 'ne') {
    return `${weekday ? `${WEEKDAYS_NE_LONG[wd]}, ` : ''}${toNepaliDigits(bs.day)} ${BS_MONTHS_NE[bs.month]} ${toNepaliDigits(bs.year)}`;
  }
  return `${bs.day} ${BS_MONTHS_EN[bs.month]} ${bs.year} BS`;
}

export const addDaysIso = (iso, n) => utcToIso(isoToUtc(iso) + n * DAY);
export const weekdayOfIso = (iso) => new Date(isoToUtc(iso)).getUTCDay();
