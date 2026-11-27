const InventoryProvider = require('./InventoryProvider');
const Trip = require('../../modules/trips/trip.model');
const { toPublicSeats } = require('../../services/seatPolicy');
const holdStore = require('../../config/holdStore');
const Company = require('../../modules/companies/company.model');
const { SEAT_STATUS, SEAT_CATEGORY, normalizeCityId } = require('../../config/constants');
const { istDayRange, istDateKey } = require('../../utils/istDate');

class OwnInventoryProvider extends InventoryProvider {
  constructor() {
    super();
    this.name = 'own-fleet';
  }

  async searchTrips({ fromCityId, toCityId, travelDate, companyCode = null }) {
    const normFrom = fromCityId ? normalizeCityId(fromCityId) : null;
    const normTo = toCityId ? normalizeCityId(toCityId) : null;

    // Show every bus still open for booking that day — scheduled and already boarding alike.
    // A trip flips to BOARDING when the seat chart is generated or the first passenger boards, but it
    // is still bookable until it departs, so it must keep appearing in search (all buses on the route).
    const query = { status: { $in: ['SCHEDULED', 'BOARDING'] } };
    // Agents only see their own company's buses; customers see every company.
    if (companyCode != null) query.companyCode = Number(companyCode);
    // Buses that have already departed are never listed (they can't be booked any more).
    const now = new Date();
    const dayKey = travelDate instanceof Date ? istDateKey(travelDate) : travelDate;
    const range = dayKey ? istDayRange(dayKey) : null;
    if (range) {
      // The travel date is an India-time calendar day (not the server's UTC day).
      query.departureTime = { $gte: range[0] > now ? range[0] : now, $lt: range[1] };
    } else {
      query.departureTime = { $gt: now };
    }

    const trips = await Trip.find(query)
      .populate('routeId')
      .populate('busId')
      .sort({ departureTime: 1 });

    const filtered = trips.filter(trip => {
      if (!trip.routeId) return false;
      const tripFrom = normalizeCityId(trip.routeId.fromCity?.id || trip.routeId.fromCity?.name);
      const tripTo = normalizeCityId(trip.routeId.toCity?.id || trip.routeId.toCity?.name);
      const matchesFrom = !normFrom || tripFrom === normFrom;
      const matchesTo = !normTo || tripTo === normTo;
      return matchesFrom && matchesTo;
    });

    // Operator names for the bus cards (one query for all companies in the result).
    const codes = [...new Set(filtered.map(t => t.companyCode).filter(Boolean))];
    const companies = codes.length
      ? await Company.find({ companyCode: { $in: codes } }).select('companyCode name').lean()
      : [];
    const companyName = new Map(companies.map(c => [c.companyCode, c.name]));

    return filtered.map(t => {
      const heldLower = new Set(holdStore.getHeldSeatsForTrip(t._id.toString()).map(h => String(h).trim().toLowerCase()));
      const seatsArr = t.seats || [];
      const availableSeats = seatsArr.filter(s =>
        s.status === SEAT_STATUS.AVAILABLE && !heldLower.has(String(s.seatNumber).trim().toLowerCase())
      ).length;

      const obj = t.toObject ? t.toObject() : t;
      obj.seats = toPublicSeats(obj, (obj.seats || []).map(s => (
        s.status === SEAT_STATUS.AVAILABLE && heldLower.has(String(s.seatNumber).trim().toLowerCase())
          ? { ...s, status: SEAT_STATUS.HELD }
          : s
      )));
      const fromName = (obj.routeId?.fromCity?.name === 'Rupadiya' ? 'Rupaidiha' : (obj.routeId?.fromCity?.name || 'Rupaidiha'));
      const toName = (obj.routeId?.toCity?.name === 'Rupadiya' ? 'Rupaidiha' : (obj.routeId?.toCity?.name || 'Ahmedabad'));

      return {
        ...obj,
        bus: obj.busId,
        route: obj.routeId,
        sourceCity: fromName,
        destinationCity: toName,
        basePrice: obj.baseFare || 750,
        boardingPoints: obj.routeId?.boardingPoints || [],
        droppingPoints: obj.routeId?.droppingPoints || [],
        availableSeats,
        availableSeatsCount: availableSeats,
        companyName: companyName.get(obj.companyCode) || null,
        // "From ₹X": cheapest seat still on sale (company can price seats individually)
        minFare: (() => {
          const open = seatsArr.filter(s => s.status === SEAT_STATUS.AVAILABLE).map(s => s.fare || obj.baseFare);
          return open.length ? Math.min(...open) : obj.baseFare;
        })(),
        maxFare: seatsArr.length ? Math.max(...seatsArr.map(s => s.fare || obj.baseFare)) : obj.baseFare,
        isFull: availableSeats === 0
      };
    });
  }

  async getSeatLayout(tripId) {
    const trip = await Trip.findById(tripId).populate('routeId').populate('busId');
    if (!trip) throw new Error('Trip not found');

    const heldSeats = holdStore.getHeldSeatsForTrip(tripId.toString());

    // 1. Identify which booked seats belong to female passengers
    const femaleBookedSeats = new Set();
    trip.seats.forEach(s => {
      if (s.status === SEAT_STATUS.BOOKED && s.passenger && s.passenger.gender === 'female') {
        femaleBookedSeats.add(s.seatNumber);
      }
    });

    // 2. Merge database state with active 10-minute hold state and dynamic adjacent female rule
    const heldSeatsLower = (heldSeats || []).map(h => String(h).trim().toLowerCase());
    const dynamicSeats = trip.seats.map(s => {
      const sNum = String(s.seatNumber || '').trim().toLowerCase();
      const isCurrentlyHeld = heldSeatsLower.includes(sNum);
      const adjacentNum = Trip.getAdjacentSeatNumber(s.seatNumber);
      const isAdjacentToFemale = Boolean(adjacentNum && femaleBookedSeats.has(adjacentNum));

      return {
        seatNumber: s.seatNumber,
        row: s.row,
        column: s.column,
        deck: s.deck,
        category: (isAdjacentToFemale && s.status === SEAT_STATUS.AVAILABLE) ? 'FEMALE_PREFERRED' : s.category,
        isAdjacentToFemale,
        status: isCurrentlyHeld ? SEAT_STATUS.HELD : s.status,
        fare: s.fare,
        ladiesOnly: isAdjacentToFemale && s.status === SEAT_STATUS.AVAILABLE,
        // Only the gender of a booked seat is public; names/ages stay private.
        passenger: s.status === SEAT_STATUS.BOOKED && s.passenger?.gender ? { gender: s.passenger.gender } : null
      };
    });

    return {
      tripId: trip._id,
      bus: trip.busId,
      route: trip.routeId,
      companyCode: trip.companyCode,
      departureTime: trip.departureTime,
      arrivalTime: trip.arrivalTime,
      baseFare: trip.baseFare,
      totalSeats: 40,
      seats: dynamicSeats
    };
  }
}

module.exports = new OwnInventoryProvider();
