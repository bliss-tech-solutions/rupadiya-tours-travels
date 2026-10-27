/**
 * Rupadiya Bus Booking Platform - Shared Validation Helpers
 */

function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim().toLowerCase());
}

function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  // Indian 10-digit mobile number starting with 6-9
  const phoneClean = phone.replace(/[\s+-]/g, '');
  return /^[6-9]\d{9}$/.test(phoneClean);
}

function validateSeatHoldRequest(body) {
  const errors = [];
  if (!body.tripId) errors.push('tripId is required');
  if (!Array.isArray(body.seatNumbers) || body.seatNumbers.length === 0) {
    errors.push('At least one seatNumber must be provided');
  } else if (body.seatNumbers.length > 6) {
    errors.push('Maximum 6 seats can be held in a single booking');
  }

  if (body.passengers && Array.isArray(body.passengers)) {
    if (body.passengers.length !== (body.seatNumbers || []).length) {
      errors.push('Passenger count must equal number of selected seats');
    }
    body.passengers.forEach((p, idx) => {
      if (!p.name || p.name.trim().length < 2) errors.push(`Passenger #${idx + 1} name must be at least 2 characters`);
      if (!p.age || isNaN(p.age) || p.age < 1 || p.age > 120) errors.push(`Passenger #${idx + 1} age must be between 1 and 120`);
      if (!['male', 'female', 'other'].includes((p.gender || '').toLowerCase())) {
        errors.push(`Passenger #${idx + 1} gender must be male, female, or other`);
      }
    });
  }

  return { isValid: errors.length === 0, errors };
}

function validateWithdrawalRequest(amount, minAmount = 500) {
  const errors = [];
  const num = Number(amount);
  if (isNaN(num) || num <= 0) {
    errors.push('Withdrawal amount must be a positive number');
  } else if (num < minAmount) {
    errors.push(`Minimum withdrawal amount is ₹${minAmount}`);
  }
  return { isValid: errors.length === 0, errors };
}

module.exports = {
  isValidEmail,
  isValidPhone,
  validateSeatHoldRequest,
  validateWithdrawalRequest
};

