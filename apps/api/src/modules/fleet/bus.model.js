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
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null,
    index: true
  },
  companyCode: {
    type: Number,
    required: true,
    min: 1,
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
  // Bus manager assigned by default to new trips of this bus
  defaultManagerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  driverDetails: {
    name: { type: String, default: '' },
    phone: { type: String, default: '' },
    licenseNumber: { type: String, default: '' },
    alternatePhone: { type: String, default: '' }
  },
  managerContact: {
    name: { type: String, default: '' },
    phone: { type: String, default: '' }
  },
  images: {
    type: [String],
    default: () => DEFAULT_BUS_IMAGES
  },
  documents: {
    rcNumber: { type: String, default: '' },
    rcExpiry: { type: Date, default: null },
    rcFileUrl: { type: String, default: '' },
    insurancePolicy: { type: String, default: '' },
    insuranceExpiry: { type: Date, default: null },
    insuranceFileUrl: { type: String, default: '' },
    fitnessCert: { type: Date, default: null },
    fitnessFileUrl: { type: String, default: '' },
    permitExpiry: { type: Date, default: null },
    permitFileUrl: { type: String, default: '' },
    pucExpiry: { type: Date, default: null },
    pucFileUrl: { type: String, default: '' },
    roadTaxExpiry: { type: Date, default: null },
    roadTaxFileUrl: { type: String, default: '' },
    driverLicenseExpiry: { type: Date, default: null },
    driverLicenseFileUrl: { type: String, default: '' }
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
  const isSleeper = typeLower.includes('sleeper');
  const isSeater = typeLower.includes('seater');

  if (isSleeper) {
    this.category = 'SLEEPER';
    this.totalSeats = 36;
    this.layoutType = '2+1';
  } else if (isSeater) {
    this.category = 'SEATER';
    this.totalSeats = 40;
    this.layoutType = '2+2';
  } else if (this.category === 'SEATER' || this.totalSeats === 40) {
    this.category = 'SEATER';
    this.totalSeats = 40;
    this.layoutType = '2+2';
  } else {
    this.category = 'SLEEPER';
    this.totalSeats = 36;
    this.layoutType = '2+1';
  }
  
  this.isAc = !typeLower.includes('non-ac');
  if (!this.images || this.images.length === 0) {
    this.images = DEFAULT_BUS_IMAGES;
  }
  next();
});

busSchema.index({ companyCode: 1 });
busSchema.index({ status: 1 });

busSchema.methods.checkCompliance = function() {
  const now = new Date();
  const docs = this.documents || {};
  const expiredDocs = [];
  if (docs.rcExpiry && new Date(docs.rcExpiry) < now) expiredDocs.push('RC');
  if (docs.insuranceExpiry && new Date(docs.insuranceExpiry) < now) expiredDocs.push('Insurance');
  if (docs.fitnessCert && new Date(docs.fitnessCert) < now) expiredDocs.push('Fitness Certificate');
  if (docs.permitExpiry && new Date(docs.permitExpiry) < now) expiredDocs.push('Route Permit');
  if (docs.pucExpiry && new Date(docs.pucExpiry) < now) expiredDocs.push('PUC');
  if (docs.roadTaxExpiry && new Date(docs.roadTaxExpiry) < now) expiredDocs.push('Road Tax');
  if (docs.driverLicenseExpiry && new Date(docs.driverLicenseExpiry) < now) expiredDocs.push('Driver License');
  return { isCompliant: expiredDocs.length === 0, expiredDocs };
};

module.exports = mongoose.model('Bus', busSchema);
