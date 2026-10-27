const mongoose = require('mongoose');

const itineraryDaySchema = new mongoose.Schema({
  day: { type: Number, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  mealsIncluded: [{ type: String }]
}, { _id: false });

const tourSchema = new mongoose.Schema({
  tourId: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  category: { type: String, default: 'Popular' }, // Popular, Culture, Best seller, Adventure
  destination: { type: String, required: true }, // e.g. Gujarat, Rajasthan, Goa, Himachal
  state: { type: String, default: '' },
  durationDays: { type: Number, required: true },
  durationNights: { type: Number, required: true },
  basePrice: { type: Number, required: true },
  thumbnail: { type: String, required: true },
  images: [{ type: String }],
  itinerary: [itineraryDaySchema],
  inclusions: [{ type: String }],
  exclusions: [{ type: String }],
  departureDates: [{ type: Date }],
  maxGroupSize: { type: Number, default: 30 },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

tourSchema.index({ destination: 1, isActive: 1 });
tourSchema.index({ category: 1 });

module.exports = mongoose.model('Tour', tourSchema);

