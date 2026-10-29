const mongoose = require('mongoose');
const { SEAT_STATUS, SEAT_CATEGORY } = require('../../config/constants');

const seatSchema = new mongoose.Schema({
  seatNumber: { type: String, required: true },
  row: { type: Number, required: true },
  column: { type: String, enum: ['A', 'B', 'C', 'D'], required: true },
  deck: { type: String, enum: ['LOWER', 'UPPER'], default: 'LOWER' },
  category: {
    type: String,
    enum: [...Object.values(SEAT_CATEGORY), 'FEMALE_PREFERRED'],
    default: SEAT_CATEGORY.STANDARD
  },
  status: {
    type: String,
    enum: Object.values(SEAT_STATUS),
    default: SEAT_STATUS.AVAILABLE
  },
  fare: { type: Number, required: true },
  passenger: {
    name: { type: String, default: null },
    age: { type: Number, default: null },
    gender: { type: String, enum: ['male', 'female', 'other', null], default: null }
  }
}, { _id: false });

const tripSchema = new mongoose.Schema({
  routeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route',
    required: true
  },
  busId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus',
    required: true
  },
  companyCode: {
    type: Number,
    required: true,
    min: 1,
    max: 33
  },
  departureTime: { type: Date, required: true },
  arrivalTime: { type: Date, required: true },
  baseFare: { type: Number, required: true },
  status: {
    type: String,
    enum: ['SCHEDULED', 'BOARDING', 'DEPARTED', 'COMPLETED', 'CANCELLED'],
    default: 'SCHEDULED'
  },
  seats: {
    type: [seatSchema],
    validate: [
      val => val && val.length >= 20 && val.length <= 60,
      `Every bus trip must have between 20 and 60 seats/berths.`
    ]
  },
  isOverflowBus: {
    type: Boolean,
    default: false
  },
  parentTripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    default: null
  },
  chartPrepared: {
    type: Boolean,
    default: false
  },
  chartPreparedAt: {
    type: Date,
    default: null
  },
  chartPreparedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

tripSchema.index({ routeId: 1, departureTime: 1 });
tripSchema.index({ companyCode: 1 });
tripSchema.index({ status: 1 });

/**
 * Utility helper to build 36 sleeper berths (18 Lower + 18 Upper) for 2+1 layout
 * Lower: L1..L18 (6 rows of 1+2)
 * Upper: U1..U18 (6 rows of 1+2)
 */
tripSchema.statics.generateSleeper36Seats = function(fare) {
  const seats = [];

  // 1. Lower Deck (Rows 1 to 6)
  for (let row = 1; row <= 6; row++) {
    const leftNum = (row - 1) * 3 + 1; // 1, 4, 7, 10, 13, 16
    const right1Num = (row - 1) * 3 + 2; // 2, 5, 8, 11, 14, 17
    const right2Num = (row - 1) * 3 + 3; // 3, 6, 9, 12, 15, 18

    // Left single berth
    seats.push({
      seatNumber: `L${leftNum}`,
      row,
      column: 'A',
      deck: 'LOWER',
      category: SEAT_CATEGORY.SLEEPER,
      status: SEAT_STATUS.AVAILABLE,
      fare,
      passenger: null
    });

    // Right double berths (C & D)
    seats.push({
      seatNumber: `L${right1Num}`,
      row,
      column: 'C',
      deck: 'LOWER',
      category: SEAT_CATEGORY.SLEEPER,
      status: SEAT_STATUS.AVAILABLE,
      fare,
      passenger: null
    });

    seats.push({
      seatNumber: `L${right2Num}`,
      row,
      column: 'D',
      deck: 'LOWER',
      category: SEAT_CATEGORY.SLEEPER,
      status: SEAT_STATUS.AVAILABLE,
      fare,
      passenger: null
    });
  }

  // 2. Upper Deck (Rows 1 to 6)
  for (let row = 1; row <= 6; row++) {
    const leftNum = (row - 1) * 3 + 1; // 1, 4, 7, 10, 13, 16
    const right1Num = (row - 1) * 3 + 2; // 2, 5, 8, 11, 14, 17
    const right2Num = (row - 1) * 3 + 3; // 3, 6, 9, 12, 15, 18

    // Left single berth
    seats.push({
      seatNumber: `U${leftNum}`,
      row,
      column: 'A',
      deck: 'UPPER',
      category: SEAT_CATEGORY.SLEEPER,
      status: SEAT_STATUS.AVAILABLE,
      fare,
      passenger: null
    });

    // Right double berths (C & D)
    seats.push({
      seatNumber: `U${right1Num}`,
      row,
      column: 'C',
      deck: 'UPPER',
      category: SEAT_CATEGORY.SLEEPER,
      status: SEAT_STATUS.AVAILABLE,
      fare,
      passenger: null
    });

    seats.push({
      seatNumber: `U${right2Num}`,
      row,
      column: 'D',
      deck: 'UPPER',
      category: SEAT_CATEGORY.SLEEPER,
      status: SEAT_STATUS.AVAILABLE,
      fare,
      passenger: null
    });
  }

  return seats;
};

/**
 * Utility helper to build 40 default seats for a 2+2 Seater coach.
 */
tripSchema.statics.generateSeater40Seats = function(fare) {
  const seats = [];
  const columns = ['A', 'B', 'C', 'D'];

  for (let row = 1; row <= 10; row++) {
    for (let colIdx = 0; colIdx < 4; colIdx++) {
      const seatNum = ((row - 1) * 4 + colIdx + 1).toString();
      const col = columns[colIdx];

      seats.push({
        seatNumber: seatNum,
        row,
        column: col,
        deck: 'LOWER',
        category: SEAT_CATEGORY.STANDARD,
        status: SEAT_STATUS.AVAILABLE,
        fare,
        passenger: null
      });
    }
  }
  return seats;
};

// Backwards compatibility alias
tripSchema.statics.generateDefault40Seats = function(fare) {
  return tripSchema.statics.generateSeater40Seats(fare);
};

/**
 * Returns adjacent seat/berth number for female safety policy
 */
tripSchema.statics.getAdjacentSeatNumber = function(seatNumStr) {
  if (!seatNumStr) return null;
  const str = seatNumStr.toString();

  // Sleeper 2+1 layout
  if (str.startsWith('L') || str.startsWith('U')) {
    const deck = str[0];
    const num = parseInt(str.slice(1), 10);
    // In 1+2 layout: Left berth (1, 4, 7, 10, 13, 16) is single
    // Right berths: 2<->3, 5<->6, 8<->9, 11<->12, 14<->15, 17<->18
    const pairs = {
      2: 3, 3: 2,
      5: 6, 6: 5,
      8: 9, 9: 8,
      11: 12, 12: 11,
      14: 15, 15: 14,
      17: 18, 18: 17
    };
    if (pairs[num]) {
      return `${deck}${pairs[num]}`;
    }
    return null;
  }

  // Seater 2+2 layout
  const num = parseInt(str, 10);
  if (isNaN(num) || num < 1 || num > 50) return null;
  const rem = (num - 1) % 4;
  if (rem === 0) return (num + 1).toString(); // A -> B
  if (rem === 1) return (num - 1).toString(); // B -> A
  if (rem === 2) return (num + 1).toString(); // C -> D
  if (rem === 3) return (num - 1).toString(); // D -> C
  return null;
};

module.exports = mongoose.model('Trip', tripSchema);
