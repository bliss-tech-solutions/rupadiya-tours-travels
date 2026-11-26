const crypto = require('crypto');
const env = require('../config/env');

/**
 * Signed ticket QR payload: "RBS1.<bookingId>.<tripId>.<signature>".
 * The bus manager app scans it; the server verifies the signature and that the ticket belongs
 * to the manager's trip. It identifies a ticket — the manager still checks the passenger's ID.
 */
const key = () => crypto
  .createHmac('sha256', process.env.TICKET_QR_SECRET || env.AUTH_ACCESS_SECRET)
  .update('rupadiya-ticket-qr-v1')
  .digest();

function sign(bookingId, tripId) {
  const body = `${bookingId}.${tripId}`;
  const sig = crypto.createHmac('sha256', key()).update(body).digest('base64url').slice(0, 22);
  return `RBS1.${body}.${sig}`;
}

/** Returns { bookingId, tripId } or null when the token is malformed or forged. */
function verify(token) {
  const parts = String(token || '').trim().split('.');
  if (parts.length !== 4 || parts[0] !== 'RBS1') return null;
  const [, bookingId, tripId, sig] = parts;
  const expected = sign(bookingId, tripId).split('.')[3];
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return { bookingId, tripId };
}

module.exports = { sign, verify };
