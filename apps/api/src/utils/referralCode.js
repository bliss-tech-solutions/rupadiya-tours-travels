const crypto = require('crypto');
const mongoose = require('mongoose');

const UNAMBIGUOUS_CHARSET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Generate a cryptographically random, unconfusable string of specified length
 */
function generateRandomAlphanumeric(length = 9) {
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += UNAMBIGUOUS_CHARSET[bytes[i] % UNAMBIGUOUS_CHARSET.length];
  }
  return result;
}

/**
 * Generate a unique 12-character referral code
 * Format: 3-character prefix (e.g. 'AGT') + 9 alphanumeric characters = exactly 12 characters.
 * Checks for collisions against both active referralCode and previousReferralCodes in User collection.
 */
async function generateUniqueReferralCode(prefix = 'AGT') {
  let User;
  try {
    User = mongoose.model('User');
  } catch (e) {
    try {
      User = require('../modules/users/user.model');
    } catch {
      // Fallback
    }
  }

  const cleanPrefix = String(prefix).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3).padEnd(3, 'A');
  const suffixLen = 12 - cleanPrefix.length; // Exactly 9 chars

  let attempts = 0;
  const MAX_ATTEMPTS = 50;

  while (attempts < MAX_ATTEMPTS) {
    attempts++;
    const candidate = `${cleanPrefix}${generateRandomAlphanumeric(suffixLen)}`;

    // Verify exactly 12 characters
    if (candidate.length !== 12) continue;

    // Check collision against active codes and retired past codes if DB connected
    if (User && mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        const existing = await User.findOne({
          $or: [
            { referralCode: candidate },
            { previousReferralCodes: candidate }
          ]
        }).select('_id').lean().exec();

        if (!existing) {
          return candidate;
        }
      } catch {
        return candidate;
      }
    } else {
      return candidate;
    }
  }

  // Fallback timestamp-seeded 12-char code if multiple collisions occur
  const timestampSuffix = Date.now().toString(36).toUpperCase().slice(-suffixLen).padStart(suffixLen, 'X');
  return `${cleanPrefix}${timestampSuffix}`;
}

module.exports = {
  generateRandomAlphanumeric,
  generateUniqueReferralCode
};
