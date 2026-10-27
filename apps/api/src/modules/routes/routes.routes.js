const express = require('express');
const router = express.Router();
const Route = require('./route.model');
const { CITIES } = require('../../config/constants');

router.get('/cities', (req, res) => {
  res.json({ success: true, cities: CITIES });
});

router.get('/', async (req, res, next) => {
  try {
    const routes = await Route.find({ isActive: true }).sort({ 'fromCity.name': 1 });
    res.json({ success: true, routes });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const route = await Route.findById(req.params.id);
    if (!route) return res.status(404).json({ error: 'Route not found' });
    res.json({ success: true, route });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
