const express = require('express');
const router = express.Router();
const taxService = require('../tax/tax.service');
const Booking = require('../bookings/booking.model');
const Company = require('../companies/company.model');
const { authenticateToken } = require('../../middleware/auth.middleware');
const { authorizeRoles } = require('../../middleware/rbac.middleware');
const { ROLES } = require('../../config/constants');

// Guard all reports routes for Super Admin or Company Owner
router.use(authenticateToken);
router.use(authorizeRoles(ROLES.SUPER_ADMIN, ROLES.COMPANY_OWNER));

/**
 * GET /reports/gst
 * GST 5% collection breakdown per PDF specifications
 */
router.get('/gst', async (req, res, next) => {
  try {
    const { period, status } = req.query;
    const companyCode = req.user.role === ROLES.COMPANY_OWNER ? req.user.companyCode : req.query.companyCode;

    const report = await taxService.getGstReport({ period, companyCode, status });
    res.json(report);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /reports/tcs
 * TCS 1% deduction breakdown per PDF specifications
 */
router.get('/tcs', async (req, res, next) => {
  try {
    const { period, agentId, status } = req.query;
    const companyCode = req.user.role === ROLES.COMPANY_OWNER ? req.user.companyCode : req.query.companyCode;

    const report = await taxService.getTcsReport({ period, companyCode, agentId, status });
    res.json(report);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /reports/targets
 * Annual targets vs actual passengers booked per company code (Codes 1 to 33)
 */
router.get('/targets', async (req, res, next) => {
  try {
    const companies = await Company.find().sort({ companyCode: 1 });
    const confirmedBookings = await Booking.find({ status: 'CONFIRMED' });

    // Aggregate passenger count by companyCode
    const passengersByCode = {};
    confirmedBookings.forEach(b => {
      const code = b.companyCode;
      if (code) {
        passengersByCode[code] = (passengersByCode[code] || 0) + (b.seatNumbers?.length || 1);
      }
    });

    const targetList = Array.from({ length: 33 }, (_, idx) => {
      const code = idx + 1;
      const comp = companies.find(c => c.companyCode === code);
      const target = comp?.annualTarget?.targetPassengers || 2000; // Default 2,000 per PDF rule 9
      const actual = passengersByCode[code] || 0;
      const progressPercent = Math.min(100, Math.round((actual / target) * 100));

      return {
        companyCode: code,
        companyName: comp?.name || `Rupadiya Transporters Co. #${code.toString().padStart(2, '0')}`,
        targetPassengers: target,
        actualPassengers: actual,
        remainingPassengers: Math.max(0, target - actual),
        progressPercent,
        status: actual >= target ? 'TARGET_ACHIEVED' : 'IN_PROGRESS'
      };
    });

    res.json({
      success: true,
      count: targetList.length,
      targets: targetList,
      summary: {
        totalTargetPassengers: targetList.reduce((s, t) => s + t.targetPassengers, 0),
        totalActualPassengers: targetList.reduce((s, t) => s + t.actualPassengers, 0),
        overallProgressPercent: Math.round(
          (targetList.reduce((s, t) => s + t.actualPassengers, 0) /
           targetList.reduce((s, t) => s + t.targetPassengers, 0)) * 100
        )
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

