const mongoose = require('mongoose');

const busSchema = new mongoose.Schema({
  busNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  name: { type: String, required: true, trim: true },
  companyCode: {
    type: Number,
    required: true,
    min: 1,
    max: 33
  },
  busType: {
    type: String,
    enum: [
      'AC Seater 2+2',
      'AC Sleeper 2+2',
      'AC Sleeper (2+1)',
      'AC Sleeper',
      'Non-AC Sleeper (2+1)',
      'Non-AC Sleeper',
      'Non-AC Seater (2+2)',
      'Non-AC Deluxe',
      'BharatBenz AC Sleeper (2+1)',
      'BharatBenz Luxury AC',
      'Volvo 9600 AC Sleeper (2+1)',
      'Volvo 9600 Multi-Axle',
      'Setra Coach Bus (2+2 AC Seater)',
      'Setra s517 HD Luxury'
    ],
    default: 'AC Sleeper (2+1)'
  },
  totalSeats: {
    type: Number,
    default: 36
  },
  layoutType: {
    type: String,
    default: '2+1',
    enum: ['2+2', '2+1', '1+2', 'SLEEPER', 'SEATER']
  },
  amenities: [{ type: String }],
  managerContact: {
    name: { type: String, default: 'Fleet Manager' },
    phone: { type: String, default: '+91 9876543210' }
  },
  documents: {
    rcNumber: { type: String, default: 'RC-UP40-TEMP' },
    rcExpiry: { type: Date, default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) },
    insurancePolicy: { type: String, default: 'INS-ORIENTAL-2026' },
    insuranceExpiry: { type: Date, default: () => new Date(Date.now() + 180 * 24 * 60 * 60 * 1000) },
    fitnessCert: { type: Date, default: () => new Date(Date.now() + 240 * 24 * 60 * 60 * 1000) },
    permitExpiry: { type: Date, default: () => new Date(Date.now() + 300 * 24 * 60 * 60 * 1000) }
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'MAINTENANCE', 'INACTIVE'],
    default: 'ACTIVE'
  }
}, {
  timestamps: true
});

busSchema.index({ companyCode: 1 });
busSchema.index({ status: 1 });

module.exports = mongoose.model('Bus', busSchema);
