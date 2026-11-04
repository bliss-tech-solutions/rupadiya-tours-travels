const express = require('express');
const router = express.Router();
const bookingController = require('./booking.controller');
const { authenticateToken, optionalAuth } = require('../../middleware/auth.middleware');
const { holdLimiter, confirmLimiter } = require('../../middleware/rateLimit.middleware');

router.post('/quote', optionalAuth, (req, res, next) => bookingController.quote(req, res, next));
router.post('/hold', holdLimiter, optionalAuth, (req, res, next) => bookingController.hold(req, res, next));
router.post('/hold/release', optionalAuth, (req, res, next) => bookingController.releaseHold(req, res, next));
router.get('/hold/:holdToken', (req, res, next) => bookingController.getHoldStatus(req, res, next));
router.post('/confirm', confirmLimiter, optionalAuth, (req, res, next) => bookingController.confirm(req, res, next));
router.get('/mine', authenticateToken, (req, res, next) => bookingController.getMine(req, res, next));
router.get('/my-bookings', authenticateToken, (req, res, next) => bookingController.getMine(req, res, next));
router.get('/:bookingId', optionalAuth, (req, res, next) => bookingController.getById(req, res, next));
router.post('/:bookingId/cancel', optionalAuth, (req, res, next) => bookingController.cancel(req, res, next));

module.exports = router;
