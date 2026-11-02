const mongoose = require('mongoose');

const boardingPointSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  landmark: { type: String, default: '' },
  timeOffsetMinutes: { type: Number, default: 0 }
}, { _id: false });

const droppingPointSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  landmark: { type: String, default: '' },
  timeOffsetMinutes: { type: Number, default: 0 }
}, { _id: false });

const routeSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null,
    index: true
  },
  companyCode: {
    type: Number,
    min: 1,
    default: null,
    index: true
  },
  fromCity: {
    id: { type: String, required: true },
    name: { type: String, required: true },
    state: { type: String, required: true }
  },
  toCity: {
    id: { type: String, required: true },
    name: { type: String, required: true },
    state: { type: String, required: true }
  },
  distanceKm: { type: Number, required: true },
  estimatedDurationHours: { type: Number, required: true },
  baseFare: { type: Number, required: true },
  boardingPoints: [boardingPointSchema],
  droppingPoints: [droppingPointSchema],
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

routeSchema.index({ 'fromCity.id': 1, 'toCity.id': 1 });
routeSchema.index({ isActive: 1 });

module.exports = mongoose.model('Route', routeSchema);

