const InventoryProvider = require('./InventoryProvider');
const Trip = require('../../modules/trips/trip.model');
const holdStore = require('../../config/holdStore');
const { SEAT_STATUS, SEAT_CATEGORY } = require('../../config/constants');

class OwnInventoryProvider extends InventoryProvider {
  constructor() {
    super();
    this.name = 'own-fleet';
  }

  async searchTrips({ fromCityId, toCityId, travelDate }) {
    const query = { status: 'SCHEDULED' };
    if (travelDate) {
      const start = new Date(travelDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(travelDate);
      end.setHours(23, 59, 59, 999);
      query.departureTime = { $gte: start, $lte: end };
    }

    const trips = await Trip.find(query)
      .populate('routeId')
      .populate('busId')
      .sort({ departureTime: 1 });

    const filtered = trips.filter(trip => {
      if (!trip.routeId) return false;
      const matchesFrom = !fromCityId || trip.routeId.fromCity.id === fromCityId;
      const matchesTo = !toCityId || trip.routeId.toCity.id === toCityId;
      return matchesFrom && matchesTo;
    });

    return filtered.map(t => {
      const heldSeats = holdStore.getHeldSeatsForTrip(t._id.toString());
      const bookedCount = t.seats.filter(s => s.status === SEAT_STATUS.BOOKED || s.status === SEAT_STATUS.BLOCKED).length;
      const effectiveHeldCount = heldSeats.length;
      const availableSeats = Math.max(0, 40 - bookedCount - effectiveHeldCount);

      const obj = t.toObject();
      return {
        ...obj,
        bus: obj.busId,
        route: obj.routeId,
        boardingPoints: obj.routeId?.boardingPoints || [],
        droppingPoints: obj.routeId?.droppingPoints || [],
        availableSeats,
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
    const dynamicSeats = trip.seats.map(s => {
      const isCurrentlyHeld = heldSeats.includes(s.seatNumber);
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
        passenger: s.passenger
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
