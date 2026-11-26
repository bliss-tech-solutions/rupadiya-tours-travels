const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middleware/auth.middleware');
const { authorizeRoles } = require('../../middleware/rbac.middleware');
const managerService = require('./manager.service');

// Bus manager mobile app API — only BUS_MANAGER accounts, only their assigned trips.
router.use(authenticateToken, authorizeRoles('BUS_MANAGER'));

const wrap = (fn) => async (req, res, next) => {
  try {
    res.json({ success: true, ...(await fn(req)) });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, error: err.message, code: err.code });
    next(err);
  }
};

router.get('/me', wrap(async (req) => managerService.me(req.user)));
router.get('/calendar', wrap(async (req) => ({ days: await managerService.calendar(req.user, req.query.from, req.query.days) })));
router.get('/history', wrap(async (req) => managerService.history(req.user, { from: req.query.from, to: req.query.to, limit: req.query.limit })));
router.get('/trips', wrap(async (req) => ({
  trips: await managerService.listTrips(req.user, String(req.query.scope || 'today'), req.query.date ? String(req.query.date) : null)
})));
router.get('/trips/:id/manifest', wrap(async (req) => managerService.manifest(req.user, req.params.id)));
router.post('/trips/:id/verify', wrap(async (req) => ({ ticket: await managerService.verify(req.user, req.params.id, req.body || {}) })));
router.post('/trips/:id/board', wrap(async (req) => managerService.board(req.user, req.params.id, req.body || {})));
router.post('/trips/:id/change-point', wrap(async (req) => managerService.changePoint(req.user, req.params.id, req.body || {})));
router.post('/trips/:id/no-show', wrap(async (req) => managerService.noShow(req.user, req.params.id, req.body || {})));
router.post('/trips/:id/drop', wrap(async (req) => managerService.drop(req.user, req.params.id, req.body || {})));
router.post('/trips/:id/start', wrap(async (req) => managerService.start(req.user, req.params.id, req.body || {})));
router.post('/trips/:id/complete', wrap(async (req) => managerService.complete(req.user, req.params.id, req.body || {})));

module.exports = router;
