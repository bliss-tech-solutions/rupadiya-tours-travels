const mongoose = require('mongoose');

const seatReservationSchema = new mongoose.Schema({
  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    required: true,
    index: true
  },
  seatNumber: {
    type: String,
    required: true,
    trim: true
  },
  bookingId: {
    type: String,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['BOOKED'],
    default: 'BOOKED'
  }
}, {
  timestamps: true
});

// HARD PHYSICAL GUARANTEE: Never allow two records with the same tripId and seatNumber
seatReservationSchema.index({ tripId: 1, seatNumber: 1 }, { unique: true });

module.exports = mongoose.model('SeatReservation', seatReservationSchema);
