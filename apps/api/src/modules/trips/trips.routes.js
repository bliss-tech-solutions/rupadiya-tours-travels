const express = require('express');
const router = express.Router();
const ownInventory = require('../../providers/inventory/OwnInventoryProvider');
const Trip = require('./trip.model');
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

    res.json({ success: true, count: trips.length, trips, data: trips });
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
    const formatted = { 
      ...obj, 
      bus: obj.busId, 
      route: obj.routeId,
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

module.exports = router;

