const MAX_FARE_MULTIPLIER = 5;

/**
 * Plans seat fare adjustments for a trip based on selector and pricing rules.
 * Clamps result between ₹1 and 5x baseFare. BOOKED seats are never modified.
 *
 * @param {Object} trip - MongoDB Trip document or lean object
 * @param {Object} change - { mode: 'SET'|'INCREASE'|'DECREASE', value: Number, valueType: 'AMOUNT'|'PERCENT' }
 * @param {Object} selection - { seatNumbers?: string[], selector?: 'ALL'|'UPPER'|'LOWER' }
 * @returns {{ changes: Array<{ seatNumber: string, before: number, after: number }>, skippedBooked: string[] }}
 */
function planFareChanges(trip, change = {}, selection = {}) {
  const { mode = 'SET', value, valueType = 'AMOUNT' } = change;
  const { seatNumbers, selector } = selection;

  const numValue = Number(value);
  if (isNaN(numValue) || numValue < 0) {
    const err = new Error('Price adjustment value must be a non-negative number.');
    err.statusCode = 400;
    throw err;
  }

  const validModes = ['SET', 'INCREASE', 'DECREASE'];
  if (!validModes.includes(mode)) {
    const err = new Error(`Invalid pricing mode "${mode}". Supported modes: ${validModes.join(', ')}.`);
    err.statusCode = 400;
    throw err;
  }

  const validValueTypes = ['AMOUNT', 'PERCENT'];
  if (!validValueTypes.includes(valueType)) {
    const err = new Error(`Invalid value type "${valueType}". Supported types: ${validValueTypes.join(', ')}.`);
    err.statusCode = 400;
    throw err;
  }

  if (mode === 'SET' && numValue < 1) {
    const err = new Error('Minimum seat fare is ₹1.');
    err.statusCode = 400;
    throw err;
  }

  const seats = trip?.seats || [];
  if (!seats.length) {
    return { changes: [], skippedBooked: [] };
  }

  const baseFare = Number(trip.baseFare) || 1650;
  const maxAllowedFare = Math.round(baseFare * MAX_FARE_MULTIPLIER);

  // Normalize target seat numbers if explicit array passed
  const targetNumSet = Array.isArray(seatNumbers) && seatNumbers.length > 0
    ? new Set(seatNumbers.map(s => String(s).trim().toUpperCase()))
    : null;

  const isUpper = (s) => (s.deck === 'UPPER' || String(s.seatNumber || '').toUpperCase().startsWith('U'));

  const changes = [];
  const skippedBooked = [];

  for (const s of seats) {
    const sNum = String(s.seatNumber || '').trim().toUpperCase();

    // Check if seat matches the selection filter
    let matches = false;
    if (targetNumSet) {
      matches = targetNumSet.has(sNum);
    } else if (selector === 'UPPER') {
      matches = isUpper(s);
    } else if (selector === 'LOWER') {
      matches = !isUpper(s);
    } else {
      // 'ALL' or default
      matches = true;
    }

    if (!matches) continue;

    // BOOKED seats are protected and never changed
    if (s.status === 'BOOKED') {
      skippedBooked.push(s.seatNumber);
      continue;
    }

    const currentFare = Number(s.fare) || baseFare;
    let nextFare = currentFare;

    if (mode === 'SET') {
      nextFare = Math.round(numValue);
    } else if (mode === 'INCREASE') {
      if (valueType === 'PERCENT') {
        nextFare = Math.round(currentFare * (1 + (numValue / 100)));
      } else {
        nextFare = Math.round(currentFare + numValue);
      }
    } else if (mode === 'DECREASE') {
      if (valueType === 'PERCENT') {
        nextFare = Math.round(currentFare * (1 - (numValue / 100)));
      } else {
        nextFare = Math.round(currentFare - numValue);
      }
    }

    // Safety clamps: between ₹1 and maxAllowedFare
    nextFare = Math.max(1, Math.min(maxAllowedFare, nextFare));

    if (nextFare !== currentFare) {
      changes.push({
        seatNumber: s.seatNumber,
        before: currentFare,
        after: nextFare
      });
    }
  }

  return {
    changes,
    skippedBooked
  };
}

module.exports = {
  planFareChanges,
  MAX_FARE_MULTIPLIER
};
