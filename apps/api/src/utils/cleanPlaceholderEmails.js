/**
 * One-time, idempotent clean-up of made-up email addresses.
 *
 * Phone-only (OTP / guest) accounts used to get a fake email such as
 * "9876543210@rupadiya.com" or "9876543210@guest.rupadiya.in". Those are not
 * real addresses, so they are removed: users keep only their phone number and
 * bookings keep an empty contact email.
 *
 * It also makes sure the users.email unique index is sparse, so many users can
 * exist without an email.
 */
const mongoose = require('mongoose');

// Only digit-only local parts on rupadiya.com are placeholders (support@rupadiya.com etc. are real).
const USER_PLACEHOLDER = /^\+?\d{6,15}@(rupadiya\.com|guest\.rupadiya\.in)$/i;
const BOOKING_PLACEHOLDER = /^\+?\d{6,15}@guest\.rupadiya\.in$/i;

async function ensureSparseEmailIndex(users) {
  const indexes = await users.indexes();
  const emailIdx = indexes.find((i) => i.key && Object.keys(i.key).length === 1 && i.key.email === 1);
  if (emailIdx && emailIdx.unique && (emailIdx.sparse || emailIdx.partialFilterExpression)) return false;
  if (emailIdx) await users.dropIndex(emailIdx.name);
  await users.createIndex({ email: 1 }, { unique: true, sparse: true, name: 'email_1' });
  return true;
}

async function cleanPlaceholderEmails({ log = console } = {}) {
  const db = mongoose.connection?.db;
  if (!db) return null;
  const users = db.collection('users');
  const bookings = db.collection('bookings');

  // Make the index sparse first: the old non-sparse unique index allows only one user without email.
  const indexChanged = await ensureSparseEmailIndex(users);
  const u = await users.updateMany({ email: { $regex: USER_PLACEHOLDER } }, { $unset: { email: '' } });
  const blank = await users.updateMany({ email: { $in: ['', null] } }, { $unset: { email: '' } });
  const b = await bookings.updateMany(
    { 'contactDetails.email': { $regex: BOOKING_PLACEHOLDER } },
    { $set: { 'contactDetails.email': '' } }
  );

  const result = {
    usersCleaned: (u.modifiedCount || 0) + (blank.modifiedCount || 0),
    bookingsCleaned: b.modifiedCount || 0,
    indexChanged
  };
  if (result.usersCleaned || result.bookingsCleaned || result.indexChanged) {
    log.log(`[DB] Placeholder emails removed: ${result.usersCleaned} users, ${result.bookingsCleaned} bookings${indexChanged ? '; users.email index is now sparse' : ''}.`);
  }
  return result;
}

module.exports = { cleanPlaceholderEmails, USER_PLACEHOLDER };
