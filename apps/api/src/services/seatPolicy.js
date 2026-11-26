const Trip = require('../modules/trips/trip.model');
const { SEAT_STATUS } = require('../config/constants');

/**
 * Seat safety policy (RedBus-style "Ladies seat" rule).
 *
 * When one berth/seat of a side-by-side pair is already BOOKED by a female passenger,
 * the other seat of that pair may only be booked for a female passenger.
 * The rule applies to every sales channel (user website, agent portal, company desk),
 * so an agent can still sell that seat — but only to a female traveller.
 */

const norm = (s) => String(s ?? '').trim().toLowerCase();

function femaleBookedSeatSet(trip) {
  const set = new Set();
  (trip?.seats || []).forEach((s) => {
    if (s.status === SEAT_STATUS.BOOKED && s.passenger?.gender === 'female') {
      set.add(norm(s.seatNumber));
    }
  });
  return set;
}

/**
 * Returns the set of (lower-cased) seat numbers that are currently "ladies only".
 */
function ladiesOnlySeatSet(trip) {
  const female = femaleBookedSeatSet(trip);
  const result = new Set();
  (trip?.seats || []).forEach((s) => {
    if (s.status !== SEAT_STATUS.AVAILABLE) return;
    const adj = Trip.getAdjacentSeatNumber(s.seatNumber);
    if (adj && female.has(norm(adj))) result.add(norm(s.seatNumber));
  });
  return result;
}

function policyError(message, seats) {
  const err = new Error(message);
  err.statusCode = 422;
  err.code = 'LADIES_SEAT_POLICY';
  err.restrictedSeats = seats;
  return err;
}

/**
 * Throws a 422 error when a non-female passenger is assigned to a ladies-only seat.
 * `passengers` must carry { seatNumber, gender }.
 */
function assertGenderPolicy(trip, passengers) {
  if (!Array.isArray(passengers) || passengers.length === 0) return;
  const ladiesOnly = ladiesOnlySeatSet(trip);
  const violations = passengers
    .filter((p) => ladiesOnly.has(norm(p.seatNumber)) && String(p.gender || '').toLowerCase() !== 'female')
    .map((p) => String(p.seatNumber));

  if (violations.length > 0) {
    throw policyError(
      `Seat${violations.length > 1 ? 's' : ''} ${violations.join(', ')} ${violations.length > 1 ? 'are' : 'is'} next to a seat booked by a female passenger, ` +
      `so ${violations.length > 1 ? 'they' : 'it'} can only be booked for a female passenger. ` +
      `Please change the passenger gender or choose another seat.`,
      violations
    );
  }
}

/**
 * Remove passenger PII from a seat map before sending it to any client.
 * Only the gender of a booked seat is exposed (needed for the ladies-seat indicator).
 */
function toPublicSeats(trip, seats) {
  const ladiesOnly = ladiesOnlySeatSet({ seats: trip.seats });
  return (seats || []).map((s) => {
    const out = { ...s };
    const gender = s.passenger?.gender || null;
    delete out.passenger;
    if (s.status === SEAT_STATUS.BOOKED && gender) {
      out.bookedGender = gender;
      out.passenger = { gender }; // backward compatible shape for existing clients
    }
    out.ladiesOnly = ladiesOnly.has(norm(s.seatNumber));
    return out;
  });
}

module.exports = {
  ladiesOnlySeatSet,
  assertGenderPolicy,
  toPublicSeats
};
