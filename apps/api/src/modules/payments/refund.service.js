const Refund = require('./refund.model');
const Booking = require('../bookings/booking.model');
const paymentService = require('./payment.service');
const { REFUND_STATUS, PAYMENT_STATUS } = require('../../config/constants');

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/**
 * Processes a queued refund exactly once.
 *
 * The PENDING/FAILED → PROCESSING transition is atomic, so a double click in the admin
 * panel or a retry racing the automatic refund can never send money twice. If the
 * gateway call fails the record moves to FAILED and can be retried safely.
 */
async function processRefundRecord(refundIdOrDocId, { mode = 'GATEWAY', actorId = null, utrNumber = null, notes = null } = {}) {
  const idFilter = /^[0-9a-fA-F]{24}$/.test(String(refundIdOrDocId))
    ? { _id: refundIdOrDocId }
    : { refundId: String(refundIdOrDocId) };

  const finalUtr = utrNumber ? String(utrNumber).trim().toUpperCase() : null;
  if (mode !== 'GATEWAY' && !finalUtr) {
    throw httpError('UTR / bank transaction reference is required for manual settlement.', 400);
  }

  const claimed = await Refund.findOneAndUpdate(
    { ...idFilter, status: { $in: [REFUND_STATUS.PENDING, REFUND_STATUS.FAILED] } },
    { $set: { status: REFUND_STATUS.PROCESSING, processedBy: actorId || null } },
    { new: true }
  );

  if (!claimed) {
    const current = await Refund.findOne(idFilter);
    if (!current) throw httpError('Refund record not found.', 404);
    throw httpError(`Refund is already ${current.status.toLowerCase()}.`, 409);
  }

  try {
    let gatewayRefundId = null;
    if (mode === 'GATEWAY') {
      if (!claimed.paymentId) {
        throw httpError('No gateway payment reference is stored for this booking. Use manual bank transfer.', 400);
      }
      const result = await paymentService.processRefund({
        paymentId: claimed.paymentId,
        amount: claimed.refundAmount,
        notes: { pnr: claimed.pnr, refundId: claimed.refundId }
      });
      gatewayRefundId = result.refundId;
    }

    claimed.status = REFUND_STATUS.PROCESSED;
    claimed.refundMode = mode === 'GATEWAY' ? 'GATEWAY' : 'MANUAL_BANK_TRANSFER';
    claimed.processedAt = new Date();
    if (gatewayRefundId) claimed.gatewayRefundId = gatewayRefundId;
    if (finalUtr) claimed.utrNumber = finalUtr;
    if (notes) claimed.notes = String(notes).slice(0, 500);
    await claimed.save();

    await Booking.updateOne({ _id: claimed.bookingId }, { $set: { paymentStatus: PAYMENT_STATUS.REFUNDED } }).catch(() => {});
    require('../notifications/notification.service').fire('refundProcessed', claimed.toObject ? claimed.toObject() : claimed);
    return claimed;
  } catch (err) {
    await Refund.updateOne(
      { _id: claimed._id, status: REFUND_STATUS.PROCESSING },
      { $set: { status: REFUND_STATUS.FAILED, notes: `${claimed.notes || ''}\n[${new Date().toISOString()}] Refund attempt failed: ${err.message}`.trim() } }
    );
    throw err;
  }
}

module.exports = { processRefundRecord };
