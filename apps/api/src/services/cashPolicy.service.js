const Booking = require('../modules/bookings/booking.model');
const Company = require('../modules/companies/company.model');

const DEFAULTS = { enabled: true, cutoffHours: 2, agentCreditLimit: 25000 };

function policyError(message, statusCode, code) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

async function getPolicy(companyCode) {
  const company = await Company.findOne({ $or: [{ companyCode }, { code: companyCode }] }).select('cashPolicy').lean();
  return { ...DEFAULTS, ...(company?.cashPolicy || {}) };
}

/** Unpaid cash (amount the agent still has to hand over) across all their open cash tickets. */
async function outstandingFor(agentId) {
  const [row] = await Booking.aggregate([
    { $match: { bookedByAgentId: agentId, status: 'CONFIRMED', 'cashCollection.status': 'PENDING' } },
    { $group: { _id: null, total: { $sum: '$cashCollection.amountDue' }, count: { $sum: 1 } } }
  ]);
  return { total: row?.total || 0, count: row?.count || 0 };
}

/**
 * Cash (COD) bookings are allowed only when:
 *  - the company allows cash,
 *  - departure is at least `cutoffHours` away (time to hand cash to the office),
 *  - the agent's unpaid cash plus this ticket stays within the credit limit.
 */
async function assertCashAllowed({ agentId, trip, amount }) {
  const policy = await getPolicy(trip.companyCode);
  if (!policy.enabled) {
    throw policyError('Cash booking is disabled by your company. Please use wallet or online payment.', 403, 'CASH_DISABLED');
  }
  const hoursLeft = (new Date(trip.departureTime).getTime() - Date.now()) / 3600000;
  if (hoursLeft < policy.cutoffHours) {
    throw policyError(
      `Cash booking closes ${policy.cutoffHours} hour(s) before departure so the cash can reach the company office. Please use wallet or online payment.`,
      409,
      'CASH_CUTOFF'
    );
  }
  const { total } = await outstandingFor(agentId);
  if (total + Number(amount) > policy.agentCreditLimit) {
    throw policyError(
      `Cash limit reached: you have ₹${total.toLocaleString('en-IN')} cash not yet handed to the company office (limit ₹${policy.agentCreditLimit.toLocaleString('en-IN')}). Hand over the pending cash first.`,
      402,
      'CASH_LIMIT'
    );
  }
}

module.exports = { assertCashAllowed, outstandingFor, getPolicy, DEFAULTS };
