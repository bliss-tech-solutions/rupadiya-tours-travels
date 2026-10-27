const express = require('express');
const router = express.Router();
const toursService = require('./tours.service');
const TourBooking = require('./tourBooking.model');
const { authenticateToken } = require('../../middleware/auth.middleware');
const { authorizeRoles } = require('../../middleware/rbac.middleware');
const { ROLES } = require('../../config/constants');

// Public: List tours
router.get('/', async (req, res, next) => {
  try {
    const tours = await toursService.listTours(req.query);
    res.json({ success: true, count: tours.length, tours, data: tours });
  } catch (err) {
    next(err);
  }
});

// User: Get my tour bookings
const handleMyTourBookings = async (req, res, next) => {
  try {
    const query = req.user.role === ROLES.AGENT
      ? { bookedByAgentId: req.user._id }
      : { userId: req.user._id };

    const bookings = await TourBooking.find(query)
      .populate('tourId')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: bookings.length, bookings, data: bookings });
  } catch (err) {
    next(err);
  }
};

router.get('/bookings/my', authenticateToken, handleMyTourBookings);
router.get('/my-bookings', authenticateToken, handleMyTourBookings);

// Public: Get single tour
router.get('/:id', async (req, res, next) => {
  try {
    const tour = await toursService.getTourById(req.params.id);
    if (!tour) return res.status(404).json({ error: 'Tour package not found' });
    res.json({ success: true, tour, data: tour });
  } catch (err) {
    next(err);
  }
});

// Book tour (User or Agent)
router.post('/book', async (req, res, next) => {
  try {
    // Optional auth token checking for logged in user or agent
    let userId = null;
    let agentId = null;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const env = require('../../config/env');
        const User = require('../users/user.model');
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (user) {
          if (user.role === ROLES.AGENT) {
            agentId = user._id;
          } else {
            userId = user._id;
          }
        }
      } catch (e) {
        // Continue as guest if token invalid
      }
    }

    const result = await toursService.bookTour({
      ...req.body,
      agentId,
      userId
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// Admin: Create Tour
router.post('/', authenticateToken, authorizeRoles(ROLES.SUPER_ADMIN), async (req, res, next) => {
  try {
    const tour = await toursService.createTour(req.body);
    res.status(201).json({ success: true, tour, data: tour });
  } catch (err) {
    next(err);
  }
});

// Admin: Update Tour
router.put('/:id', authenticateToken, authorizeRoles(ROLES.SUPER_ADMIN), async (req, res, next) => {
  try {
    const tour = await toursService.updateTour(req.params.id, req.body);
    res.json({ success: true, tour, data: tour });
  } catch (err) {
    next(err);
  }
});

// Admin: Delete / Deactivate Tour
router.delete('/:id', authenticateToken, authorizeRoles(ROLES.SUPER_ADMIN), async (req, res, next) => {
  try {
    await toursService.deleteTour(req.params.id);
    res.json({ success: true, message: 'Tour deactivated' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

