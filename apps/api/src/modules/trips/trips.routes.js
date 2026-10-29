const express = require('express');
const router = express.Router();
const ownInventory = require('../../providers/inventory/OwnInventoryProvider');
const Trip = require('./trip.model');
const Bus = require('../fleet/bus.model');
const Booking = require('../bookings/booking.model');
const { isValidCorridor } = require('../../config/constants');

// Search trips
const handleSearch = async (req, res, next) => {
  try {
    const { from, to, date } = req.query;

    if (from && to && !isValidCorridor(from, to)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid route. Journeys are strictly between Rupadiya and approved destination cities (Ahmedabad, Vadodara, Surat, Bangalore, Hyderabad, Mumbai).'
      });
    }

    const trips = await ownInventory.searchTrips({
      fromCityId: from,
      toCityId: to,
      travelDate: date
    });

    let upcomingTrips = [];
    if (trips.length === 0 && date) {
      const allUpcoming = await ownInventory.searchTrips({
        fromCityId: from,
        toCityId: to
      });
      const now = new Date();
      upcomingTrips = allUpcoming.filter(t => new Date(t.departureTime) >= now).slice(0, 6);
    }

    res.json({
      success: true,
      count: trips.length,
      trips,
      data: trips,
      upcomingTrips
    });
  } catch (err) {
    next(err);
  }
};

router.get('/', handleSearch);
router.get('/search', handleSearch);

// Get single trip details
router.get('/:tripId', async (req, res, next) => {
  try {
    const trip = await Trip.findById(req.params.tripId)
      .populate('routeId')
      .populate('busId');

    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    const obj = trip.toObject();
    const fromName = obj.routeId?.fromCity?.name || 'Rupadiya';
    const toName = obj.routeId?.toCity?.name || 'Ahmedabad';

    const formatted = { 
      ...obj, 
      bus: obj.busId, 
      route: obj.routeId,
      sourceCity: fromName,
      destinationCity: toName,
      basePrice: obj.baseFare || 750,
      boardingPoints: obj.routeId?.boardingPoints || [],
      droppingPoints: obj.routeId?.droppingPoints || []
    };
    res.json({ success: true, trip: formatted, data: formatted });
  } catch (err) {
    next(err);
  }
});

// Get 40-seat layout with live dynamic holds
router.get('/:tripId/seats', async (req, res, next) => {
  try {
    const layout = await ownInventory.getSeatLayout(req.params.tripId);
    res.json({ success: true, layout });
  } catch (err) {
    next(err);
  }
});

// Schedule Trip (Supports 36-Seat Sleeper 2+1 and 40-Seat Seater 2+2)
router.post('/', async (req, res, next) => {
  try {
    const { routeId, busId, departureTime, arrivalTime, baseFare } = req.body;
    const bus = await Bus.findById(busId);
    if (!bus) return res.status(404).json({ error: 'Bus not found' });

    const isSleeper = bus.layoutType === '2+1' || bus.busType.toLowerCase().includes('sleeper');
    const seats = isSleeper ? Trip.generateSleeper36Seats(baseFare) : Trip.generateSeater40Seats(baseFare);

    const trip = new Trip({
      routeId,
      busId,
      companyCode: bus.companyCode || 1,
      departureTime: new Date(departureTime),
      arrivalTime: new Date(arrivalTime),
      baseFare,
      seats,
      status: 'SCHEDULED'
    });
    await trip.save();

    res.status(201).json({ success: true, trip });
  } catch (err) {
    next(err);
  }
});

// Prepare Seat Chart Manifest & Lock Trip for Boarding
router.post('/:tripId/prepare-chart', async (req, res, next) => {
  try {
    const trip = await Trip.findById(req.params.tripId)
      .populate('routeId')
      .populate('busId');
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    trip.chartPrepared = true;
    trip.chartPreparedAt = new Date();
    if (trip.status === 'SCHEDULED') {
      trip.status = 'BOARDING';
    }
    await trip.save();

    res.json({
      success: true,
      message: `Seat sheet chart generated and locked at ${new Date().toLocaleTimeString()}. Boarding status active.`,
      trip
    });
  } catch (err) {
    next(err);
  }
});

// Fetch Formatted Passenger Seat Sheet Manifest
router.get('/:tripId/seat-chart', async (req, res, next) => {
  try {
    const trip = await Trip.findById(req.params.tripId)
      .populate('routeId')
      .populate('busId');
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const bookings = await Booking.find({
      tripId: trip._id,
      status: 'CONFIRMED'
    }).populate('passengerId', 'name phone email');

    const manifest = [];
    const seatMap = {};

    bookings.forEach((b) => {
      (b.passengers || []).forEach((p) => {
        seatMap[p.seatNumber] = {
          seatNumber: p.seatNumber,
          passengerName: p.name,
          age: p.age,
          gender: p.gender,
          fare: p.fare,
          pnr: b.pnr,
          bookingId: b.bookingId,
          contactPhone: b.contactDetails?.phone || b.passengerId?.phone || 'N/A',
          boardingPoint: b.boardingPoint?.name || 'Main Stand',
          droppingPoint: b.droppingPoint?.name || 'Bus Stand',
          status: 'CONFIRMED'
        };
      });
    });

    const isSleeper = trip.busId?.layoutType === '2+1' || trip.busId?.busType?.toLowerCase().includes('sleeper');
    const allSeats = trip.seats && trip.seats.length > 0 ? trip.seats : [];

    allSeats.forEach((s) => {
      if (seatMap[s.seatNumber]) {
        manifest.push({
          ...seatMap[s.seatNumber],
          deck: s.deck || 'LOWER',
          category: s.category
        });
      } else {
        manifest.push({
          seatNumber: s.seatNumber,
          passengerName: '— VACANT —',
          age: null,
          gender: null,
          fare: s.fare,
          pnr: '—',
          bookingId: '—',
          contactPhone: '—',
          boardingPoint: '—',
          droppingPoint: '—',
          status: 'VACANT',
          deck: s.deck || 'LOWER',
          category: s.category
        });
      }
    });

    manifest.sort((a, b) => a.seatNumber.localeCompare(b.seatNumber, undefined, { numeric: true }));

    const bookedCount = Object.keys(seatMap).length;
    const totalCapacity = allSeats.length || (isSleeper ? 36 : 40);

    res.json({
      success: true,
      trip: {
        _id: trip._id,
        departureTime: trip.departureTime,
        arrivalTime: trip.arrivalTime,
        status: trip.status,
        chartPrepared: trip.chartPrepared,
        chartPreparedAt: trip.chartPreparedAt,
        route: trip.routeId,
        bus: trip.busId,
        companyCode: trip.companyCode
      },
      summary: {
        totalSeats: totalCapacity,
        bookedSeats: bookedCount,
        vacantSeats: totalCapacity - bookedCount,
        occupancyRate: Math.round((bookedCount / totalCapacity) * 100)
      },
      manifest
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

