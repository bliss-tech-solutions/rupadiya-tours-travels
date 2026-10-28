const mongoose = require('mongoose');

const DEFAULT_BUS_IMAGES = [
  'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=800&auto=format&fit=crop&q=80'
];

const busSchema = new mongoose.Schema({
  busNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  name: { type: String, required: true, trim: true },
  operatorName: { type: String, default: 'Rupadiya Intercity Travels', trim: true },
  companyCode: {
    type: Number,
    required: true,
    min: 1,
    max: 33
  },
  busType: {
    type: String,
    enum: [
      'AC Sleeper (2+1)',
      'Non-AC Sleeper (2+1)',
      'AC Seater (2+2)',
      'Non-AC Seater (2+2)',
      'AC Seater 2+2',
      'AC Sleeper 2+2',
      'AC Sleeper',
      'Non-AC Sleeper',
      'Non-AC Seater',
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
  category: {
    type: String,
    enum: ['SLEEPER', 'SEATER'],
    default: 'SLEEPER'
  },
  isAc: {
    type: Boolean,
    default: true
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
  driverDetails: {
    name: { type: String, default: 'Dinesh Kumar' },
    phone: { type: String, default: '+91 9876543210' },
    licenseNumber: { type: String, default: 'DL-UP40-201800123' },
    alternatePhone: { type: String, default: '+91 9876543211' }
  },
  managerContact: {
    name: { type: String, default: 'Fleet Manager' },
    phone: { type: String, default: '+91 9876543210' }
  },
  images: {
    type: [String],
    default: () => DEFAULT_BUS_IMAGES
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

busSchema.pre('save', function(next) {
  const typeLower = (this.busType || '').toLowerCase();
  const isSleeper = typeLower.includes('sleeper') || this.category === 'SLEEPER';
  
  if (isSleeper) {
    this.category = 'SLEEPER';
    this.totalSeats = 36;
    this.layoutType = '2+1';
  } else {
    this.category = 'SEATER';
    this.totalSeats = 40;
    this.layoutType = '2+2';
  }
  
  this.isAc = !typeLower.includes('non-ac');
  if (!this.images || this.images.length === 0) {
    this.images = DEFAULT_BUS_IMAGES;
  }
  next();
});

busSchema.index({ companyCode: 1 });
busSchema.index({ status: 1 });

module.exports = mongoose.model('Bus', busSchema);
