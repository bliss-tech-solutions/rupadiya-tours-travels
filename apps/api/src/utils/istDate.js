/**
 * India-time (IST, UTC+05:30) calendar days. The server runs in UTC (Render), so a plain
 * `new Date('2026-11-27').setHours(0)` would cut days at 05:30 IST and put early-morning buses
 * on the previous date. Use these helpers for every "trips on this date" query.
 */
const IST_OFFSET_MS = 330 * 60000;

/** "2026-11-27" → [start, end) of that day in India time, or null for a bad value. */
function istDayRange(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr || ''));
  if (!m) return null;
  const start = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]) - IST_OFFSET_MS);
  return [start, new Date(start.getTime() + 24 * 3600000)];
}

/** Date → "YYYY-MM-DD" in India time. */
function istDateKey(d = new Date()) {
  return new Date(new Date(d).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

module.exports = { IST_OFFSET_MS, istDayRange, istDateKey };
