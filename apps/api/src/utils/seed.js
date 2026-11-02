const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const env = require('../config/env');
const { connectDB } = require('../config/db');

const User = require('../modules/users/user.model');
const Company = require('../modules/companies/company.model');
const Bus = require('../modules/fleet/bus.model');
const Route = require('../modules/routes/route.model');
const Trip = require('../modules/trips/trip.model');
const Booking = require('../modules/bookings/booking.model');
const { Wallet, WalletLedger } = require('../modules/wallets/wallet.model');
const { CommissionTier, CommissionRecord } = require('../modules/commissions/commission.model');
const WithdrawalRequest = require('../modules/withdrawals/withdrawal.model');
const KycDocument = require('../modules/kyc/kyc.model');
const Offer = require('../modules/offers/offer.model');
const AuditLog = require('../modules/audit/audit.model');
const Tour = require('../modules/tours/tour.model');
const TourBooking = require('../modules/tours/tourBooking.model');

const {
  ROLES,
  KYC_STATUS,
  COMPANY_CODES,
  DEFAULT_COMMISSION_TIERS,
  SEAT_STATUS,
  TRANSACTION_TYPES
} = require('../config/constants');

async function seed() {
  console.log('[Seed] Connecting to database...');
  await connectDB();

  const isProduction = process.env.NODE_ENV === 'production';
  const isForceReset = process.argv.includes('--force-reset');

  if (isProduction) {
    throw new Error('[Safety Guard] Database drop is strictly forbidden in PRODUCTION.');
  }

  if (isForceReset) {
    console.log('[Seed] Dropping old database collections and indexes cleanly (--force-reset specified)...');
    try {
      await mongoose.connection.dropDatabase();
    } catch (dropErr) {
      console.warn('[Seed Warning] dropDatabase:', dropErr.message);
    }
  } else {
    console.log('[Seed] Safe mode: preserving database (pass --force-reset to clear).');
  }

  const defaultPassword = 'Password123!';
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(defaultPassword, salt);

  console.log('[Seed] Creating demo users for all 4 roles...');
  // 1. Super Admin
  const admin = await User.create({
    name: 'Super Admin Officer',
    email: 'admin@rupadiya.test',
    phone: '9876543210',
    passwordHash,
    role: ROLES.SUPER_ADMIN,
    isActive: true
  });

  // 2. Company Owner (Assigned to Company Code #01)
  const owner = await User.create({
    name: 'Vikram Singh (Owner)',
    email: 'owner@rupadiya.test',
    phone: '9876543211',
    passwordHash,
    role: ROLES.COMPANY_OWNER,
    companyCode: 1,
    isActive: true
  });

  // 3. Agent (Assigned to Company Code #01)
  const agent = await User.create({
    name: 'Rahul Sharma (Master Agent)',
    email: 'agent@rupadiya.test',
    phone: '9876543212',
    passwordHash,
    role: ROLES.AGENT,
    companyCode: 1,
    referralCode: 'RUP-MASTER',
    kycStatus: KYC_STATUS.VERIFIED,
    bankDetails: {
      accountName: 'Rahul Sharma',
      accountNumberMasked: 'XXXX-XXXX-8921',
      ifscCode: 'SBIN0002145',
      upiId: 'rahul.rupadiya@okaxis',
      bankName: 'State Bank of India'
    },
    isActive: true
  });

  // 3b. Tier 2 Agent (Referred by Rahul)
  const subAgent = await User.create({
    name: 'Amit Patel (Sub-Agent)',
    email: 'subagent@rupadiya.test',
    phone: '9876543214',
    passwordHash,
    role: ROLES.AGENT,
    companyCode: 1,
    referralCode: 'RUP-SUB01',
    referredBy: agent._id,
    kycStatus: KYC_STATUS.VERIFIED,
    isActive: true
  });

  // 4. Passenger
  const passenger = await User.create({
    name: 'Pooja Verma',
    email: 'passenger@rupadiya.test',
    phone: '9876543213',
    passwordHash,
    role: ROLES.PASSENGER,
    isActive: true
  });

  console.log('[Seed] Creating Wallets & Initial Balances...');
  const agentWallet = await Wallet.create({
    userId: agent._id,
    companyCode: 1,
    balance: 15000,
    availableBalance: 15000,
    reservedBalance: 500
  });

  const ownerWallet = await Wallet.create({
    userId: owner._id,
    companyCode: 1,
    balance: 85000,
    availableBalance: 85000,
    reservedBalance: 0
  });

  // Create seed ledger entries for Agent
  await WalletLedger.create({
    walletId: agentWallet._id,
    userId: agent._id,
    companyCode: 1,
    entryType: 'CREDIT',
    amount: 15000,
    balanceAfter: 15000,
    transactionType: TRANSACTION_TYPES.WALLET_DEPOSIT,
    referenceType: 'DEPOSIT',
    referenceId: 'DEPOSIT_INIT_001',
    description: 'Initial Working Capital for Customer Ticket Bookings',
    idempotencyKey: 'SEED_LEDGER_INIT'
  });

  // Create sample withdrawal request for Agent
  await WithdrawalRequest.create({
    agentId: agent._id,
    companyCode: 1,
    amount: 500,
    payoutDetails: {
      method: 'bank',
      accountName: 'Rahul Sharma',
      accountNumberMasked: 'XXXX-XXXX-8921',
      ifscCode: 'SBIN0002145',
      upiId: 'rahul.rupadiya@okaxis'
    },
    status: 'PENDING'
  });

  // Create verified KYC record for Agent
  await KycDocument.create({
    userId: agent._id,
    companyCode: 1,
    documentType: 'AADHAAR',
    documentNumberMasked: 'XXXXXXXX7894',
    fileUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=600&q=80',
    status: KYC_STATUS.VERIFIED,
    reviewedBy: admin._id,
    reviewedAt: new Date()
  });

  console.log('[Seed] Seeding 33 Company Codes...');
  for (const c of COMPANY_CODES) {
    await Company.create({
      companyCode: c.code,
      name: c.code === 1 ? 'Rupadiya Super Express Ltd.' : c.defaultName,
      slug: c.slug,
      ownerId: c.code === 1 ? owner._id : null,
      status: 'ACTIVE',
      contactPhone: '+91 9876543210',
      contactEmail: `contact@${c.slug}.rupadiya.test`,
      annualTarget: {
        targetPassengers: 12000,
        currentPassengers: c.code === 1 ? 1420 : 0,
        financialYear: '2026-2027'
      }
    });
  }

  console.log('[Seed] Seeding Strict Hub-and-Spoke Intercity Corridors (Rupadiya <-> 6 Spokes)...');
  const hubCity = { id: 'rupadiya', name: 'Rupadiya', state: 'Uttar Pradesh' };
  
  const spokeDefinitions = [
    {
      id: 'ahmedabad',
      name: 'Ahmedabad',
      state: 'Gujarat',
      distanceKm: 1250,
      durationHours: 21.0,
      fare: 1650,
      hubBoarding: [
        { id: 'bp-rup-main', name: 'Rupadiya Border Main Stand', landmark: 'Platform 1', timeOffsetMinutes: 0 },
        { id: 'bp-rup-bypass', name: 'Nanpara Road Bypass', landmark: 'HP Petrol Pump', timeOffsetMinutes: 25 }
      ],
      spokeDropping: [
        { id: 'dp-amd-geeta', name: 'Geeta Mandir Bus Stand', landmark: 'Terminal 2', timeOffsetMinutes: 0 },
        { id: 'dp-amd-satellite', name: 'Satellite Cross Road', landmark: 'BRTS Station', timeOffsetMinutes: 35 }
      ]
    },
    {
      id: 'vadodara',
      name: 'Vadodara',
      state: 'Gujarat',
      distanceKm: 1180,
      durationHours: 20.0,
      fare: 1550,
      hubBoarding: [
        { id: 'bp-rup-main', name: 'Rupadiya Border Main Stand', landmark: 'Platform 1', timeOffsetMinutes: 0 }
      ],
      spokeDropping: [
        { id: 'dp-bdq-central', name: 'Vadodara Central Bus Station', landmark: 'Opposite Railway Station', timeOffsetMinutes: 0 },
        { id: 'dp-bdq-amit', name: 'Amit Nagar Circle', landmark: 'Highway Cross', timeOffsetMinutes: 30 }
      ]
    },
    {
      id: 'surat',
      name: 'Surat',
      state: 'Gujarat',
      distanceKm: 1320,
      durationHours: 22.5,
      fare: 1750,
      hubBoarding: [
        { id: 'bp-rup-main', name: 'Rupadiya Border Main Stand', landmark: 'Platform 2', timeOffsetMinutes: 0 }
      ],
      spokeDropping: [
        { id: 'dp-sur-kamrej', name: 'Kamrej Char Rasta', landmark: 'Flyover Toll', timeOffsetMinutes: 0 },
        { id: 'dp-sur-central', name: 'Surat Central Bus Terminal', landmark: 'Station Road', timeOffsetMinutes: 40 }
      ]
    },
    {
      id: 'bangalore',
      name: 'Bengaluru',
      state: 'Karnataka',
      distanceKm: 1980,
      durationHours: 32.0,
      fare: 2400,
      hubBoarding: [
        { id: 'bp-rup-main', name: 'Rupadiya Border Main Stand', landmark: 'Platform 3', timeOffsetMinutes: 0 }
      ],
      spokeDropping: [
        { id: 'dp-blr-majestic', name: 'Majestic Bus Stand', landmark: 'KSRTC Platform 5', timeOffsetMinutes: 0 },
        { id: 'dp-blr-madiwala', name: 'Madiwala', landmark: 'Near Police Station', timeOffsetMinutes: 45 }
      ]
    },
    {
      id: 'hyderabad',
      name: 'Hyderabad',
      state: 'Telangana',
      distanceKm: 1380,
      durationHours: 24.5,
      fare: 1850,
      hubBoarding: [
        { id: 'bp-rup-main', name: 'Rupadiya Border Terminal', landmark: 'Platform 3', timeOffsetMinutes: 0 }
      ],
      spokeDropping: [
        { id: 'dp-hyd-mgbs', name: 'Mahatma Gandhi Bus Station (MGBS)', landmark: 'Bay 18', timeOffsetMinutes: 0 },
        { id: 'dp-hyd-ameerpet', name: 'Ameerpet Metro Station', landmark: 'Pillar 1042', timeOffsetMinutes: 40 }
      ]
    },
    {
      id: 'mumbai',
      name: 'Mumbai',
      state: 'Maharashtra',
      distanceKm: 1450,
      durationHours: 24.0,
      fare: 1950,
      hubBoarding: [
        { id: 'bp-rup-main', name: 'Rupadiya Border Main Stand', landmark: 'Platform 4', timeOffsetMinutes: 0 }
      ],
      spokeDropping: [
        { id: 'dp-bom-borivali', name: 'Borivali East', landmark: 'National Park Gate', timeOffsetMinutes: 0 },
        { id: 'dp-bom-dadar', name: 'Dadar TT Circle', landmark: 'Asiad Stand', timeOffsetMinutes: 50 }
      ]
    }
  ];

  const routesData = [];

  // Generate bidirectional pairs: Rupadiya -> Spoke & Spoke -> Rupadiya
  for (const s of spokeDefinitions) {
    // 1. Rupadiya -> Spoke
    routesData.push({
      fromCity: hubCity,
      toCity: { id: s.id, name: s.name, state: s.state },
      distanceKm: s.distanceKm,
      estimatedDurationHours: s.durationHours,
      baseFare: s.fare,
      boardingPoints: s.hubBoarding,
      droppingPoints: s.spokeDropping,
      isActive: true
    });

    // 2. Spoke -> Rupadiya
    routesData.push({
      fromCity: { id: s.id, name: s.name, state: s.state },
      toCity: hubCity,
      distanceKm: s.distanceKm,
      estimatedDurationHours: s.durationHours,
      baseFare: s.fare,
      boardingPoints: s.spokeDropping.map(dp => ({
        id: `bp-${dp.id.replace('dp-', '')}`,
        name: dp.name,
        landmark: dp.landmark,
        timeOffsetMinutes: dp.timeOffsetMinutes
      })),
      droppingPoints: s.hubBoarding.map(bp => ({
        id: `dp-${bp.id.replace('bp-', '')}`,
        name: bp.name,
        landmark: bp.landmark,
        timeOffsetMinutes: bp.timeOffsetMinutes
      })),
      isActive: true
    });
  }

  const createdRoutes = await Route.insertMany(routesData);

  console.log('[Seed] Seeding Fleet Buses (Company Code #01 - Standard Sleeper 36 & Seater 40 variants)...');
  const busesData = [
    {
      busNumber: 'UP-40-BT-1001',
      name: 'Rupadiya Royal AC Sleeper',
      operatorName: 'Rupadiya Intercity Travels',
      companyCode: 1,
      busType: 'AC Sleeper (2+1)',
      category: 'SLEEPER',
      isAc: true,
      layoutType: '2+1',
      totalSeats: 36,
      amenities: ['Charging Point', 'WiFi', 'Blanket', 'Reading Light', 'GPS Tracking', 'Water Bottle'],
      driverDetails: { name: 'Mohan Lal', phone: '+91 9876500001', licenseNumber: 'DL-UP40-2015001', alternatePhone: '+91 9876500011' },
      managerContact: { name: 'Mohan Lal', phone: '+91 9876500001' }
    },
    {
      busNumber: 'UP-40-BT-1002',
      name: 'Volvo 9600 AC Sleeper Express',
      operatorName: 'Rupadiya Intercity Travels',
      companyCode: 1,
      busType: 'AC Sleeper (2+1)',
      category: 'SLEEPER',
      isAc: true,
      layoutType: '2+1',
      totalSeats: 36,
      amenities: ['Charging Point', 'WiFi', 'Reading Light', 'GPS Tracking', 'Sanitised Beds'],
      driverDetails: { name: 'Ramesh Yadav', phone: '+91 9876500002', licenseNumber: 'DL-UP40-2016002', alternatePhone: '+91 9876500012' },
      managerContact: { name: 'Ramesh Yadav', phone: '+91 9876500002' }
    },
    {
      busNumber: 'UP-40-BT-1003',
      name: 'Rupadiya Non-AC Sleeper Deluxe',
      operatorName: 'Rupadiya Intercity Travels',
      companyCode: 1,
      busType: 'Non-AC Sleeper (2+1)',
      category: 'SLEEPER',
      isAc: false,
      layoutType: '2+1',
      totalSeats: 36,
      amenities: ['Charging Point', 'Reading Light', 'Emergency Hammer', 'Pillow'],
      driverDetails: { name: 'Dinesh Kumar', phone: '+91 9876500003', licenseNumber: 'DL-UP40-2017003', alternatePhone: '+91 9876500013' },
      managerContact: { name: 'Dinesh Kumar', phone: '+91 9876500003' }
    },
    {
      busNumber: 'UP-40-BT-1004',
      name: 'Setra Coach Luxury AC Seater',
      operatorName: 'Rupadiya Intercity Travels',
      companyCode: 1,
      busType: 'AC Seater (2+2)',
      category: 'SEATER',
      isAc: true,
      layoutType: '2+2',
      totalSeats: 40,
      amenities: ['AC', 'WiFi', 'USB Port', 'Pushback Seats', 'Water Bottle'],
      driverDetails: { name: 'Sunil Singh', phone: '+91 9876500004', licenseNumber: 'DL-UP40-2018004', alternatePhone: '+91 9876500014' },
      managerContact: { name: 'Sunil Singh', phone: '+91 9876500004' }
    },
    {
      busNumber: 'UP-40-BT-1005',
      name: 'Rupadiya Deluxe Non-AC Seater',
      operatorName: 'Rupadiya Intercity Travels',
      companyCode: 1,
      busType: 'Non-AC Seater (2+2)',
      category: 'SEATER',
      isAc: false,
      layoutType: '2+2',
      totalSeats: 40,
      amenities: ['Reading Light', 'First Aid Box', 'Emergency Exit'],
      driverDetails: { name: 'Anil Gupta', phone: '+91 9876500005', licenseNumber: 'DL-UP40-2019005', alternatePhone: '+91 9876500015' },
      managerContact: { name: 'Anil Gupta', phone: '+91 9876500005' }
    }
  ];

  const createdBuses = await Bus.insertMany(busesData);

  console.log('[Seed] Seeding Scheduled Trips for 14 Days across all 6 Corridors...');
  const baseDate = new Date();
  baseDate.setHours(17, 30, 0, 0);

  const sampleBookedSeatsForBus = (bus, baseFare) => {
    const isSleeper = bus.layoutType === '2+1' || bus.busType.toLowerCase().includes('sleeper');

    if (isSleeper) {
      const seats = Trip.generateSleeper36Seats(baseFare);
      // Pre-seed booked seats matching Image 1:
      // Row 2 Lower Deck: Left berth L4 is booked by male
      const sL4 = seats.find(s => s.seatNumber === 'L4');
      if (sL4) {
        sL4.status = SEAT_STATUS.BOOKED;
        sL4.passenger = { name: 'Karan Mehra', age: 31, gender: 'male' };
      }
      // Row 2 Lower Deck: Right double berths L5 & L6 are booked by female
      const sL5 = seats.find(s => s.seatNumber === 'L5');
      if (sL5) {
        sL5.status = SEAT_STATUS.BOOKED;
        sL5.passenger = { name: 'Neha Sharma', age: 26, gender: 'female' };
      }
      const sL6 = seats.find(s => s.seatNumber === 'L6');
      if (sL6) {
        sL6.status = SEAT_STATUS.BOOKED;
        sL6.passenger = { name: 'Pooja Verma', age: 24, gender: 'female' };
      }
      return seats;
    } else {
      const seats = Trip.generateSeater40Seats(baseFare);
      // Female traveler booked seat 1 (companion seat 2 gets female preference)
      const s1 = seats.find(s => s.seatNumber === '1');
      if (s1) {
        s1.status = SEAT_STATUS.BOOKED;
        s1.passenger = { name: 'Neha Sharma', age: 26, gender: 'female' };
      }
      // Male traveler booked seat 5
      const s5 = seats.find(s => s.seatNumber === '5');
      if (s5) {
        s5.status = SEAT_STATUS.BOOKED;
        s5.passenger = { name: 'Karan Mehra', age: 31, gender: 'male' };
      }
      return seats;
    }
  };

  // Seed trips across 14 consecutive days
  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    for (let rIdx = 0; rIdx < createdRoutes.length; rIdx++) {
      const route = createdRoutes[rIdx];
      const bus = createdBuses[rIdx % createdBuses.length];

      const depDate = new Date(baseDate.getTime() + dayOffset * 24 * 3600 * 1000);
      // Alternate departure hours: 17:00, 19:30, 21:00
      depDate.setHours(17 + (rIdx % 4), (rIdx * 15) % 60, 0, 0);

      const arrDate = new Date(depDate.getTime() + route.estimatedDurationHours * 3600 * 1000);

      await Trip.create({
        routeId: route._id,
        busId: bus._id,
        companyCode: 1,
        departureTime: depDate,
        arrivalTime: arrDate,
        baseFare: route.baseFare,
        seats: sampleBookedSeatsForBus(bus, route.baseFare),
        status: 'SCHEDULED'
      });
    }
  }

  console.log('[Seed] Seeding Sample Confirmed Passenger Booking...');
  const trip1 = await Trip.findOne({ companyCode: 1 }).populate('routeId').populate('busId');
  const isTrip1Sleeper = trip1.busId?.busType?.toLowerCase().includes('sleeper');
  const seatNumbers1 = isTrip1Sleeper ? ['L2', 'L3'] : ['3', '4'];
  const passengers1 = isTrip1Sleeper
    ? [
        { seatNumber: 'L2', name: 'Pooja Verma', age: 26, gender: 'female', fare: trip1.baseFare },
        { seatNumber: 'L3', name: 'Rajesh Verma', age: 30, gender: 'male', fare: trip1.baseFare }
      ]
    : [
        { seatNumber: '3', name: 'Pooja Verma', age: 26, gender: 'female', fare: trip1.baseFare },
        { seatNumber: '4', name: 'Rajesh Verma', age: 30, gender: 'male', fare: trip1.baseFare }
      ];

  const booking1 = await Booking.create({
    bookingId: 'BK_RUP_10001',
    pnr: 'RUP-849204',
    passengerId: passenger._id,
    contactDetails: {
      email: passenger.email,
      phone: passenger.phone
    },
    tripId: trip1._id,
    routeId: trip1.routeId._id,
    busId: trip1.busId._id,
    companyCode: 1,
    referralAgentId: agent._id,
    seatNumbers: seatNumbers1,
    passengers: passengers1,
    boardingPoint: {
      name: 'Rupadiya Border Main Stand',
      time: '05:30 PM'
    },
    droppingPoint: {
      name: 'Central Terminal',
      time: '02:30 PM'
    },
    fareBreakdown: {
      baseFare: trip1.baseFare,
      seatCount: 2,
      subtotal: trip1.baseFare * 2,
      gstAmount: Math.round(trip1.baseFare * 2 * 0.05),
      discountAmount: 0,
      totalPayable: Math.round(trip1.baseFare * 2 * 1.05)
    },
    status: 'CONFIRMED',
    paymentStatus: 'SUCCESS',
    paymentProvider: 'dummy',
    paymentReference: 'DUMMY_TXN_SEED_01'
  });

  console.log('[Seed] Seeding Commission Tiers (1 to 5)...');
  for (const t of DEFAULT_COMMISSION_TIERS) {
    await CommissionTier.create({
      level: t.level,
      name: t.name,
      ratePerSeat: t.ratePerSeat,
      bonusPerSeat: 20,
      isActive: true
    });
  }

  console.log('[Seed] Seeding Handpicked Tour Packages (Matching Rupadiya Design)...');
  const toursData = [
    {
      tourId: 'rann-of-kutch-escape',
      title: 'Rann of Kutch Escape',
      subtitle: 'White desert safari, traditional handicraft villages & cultural folk nights',
      category: 'Popular',
      destination: 'Gujarat',
      state: 'Gujarat',
      durationDays: 3,
      durationNights: 2,
      basePrice: 4999,
      thumbnail: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=80',
      images: [
        'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80'
      ],
      itinerary: [
        {
          day: 1,
          title: 'Arrival in Bhuj & Tent City Check-in',
          description: 'Departure from Ahmedabad by luxury coach, welcome drink at Dhordo Tent City, sunset camel safari at the Great White Rann.',
          mealsIncluded: ['Dinner']
        },
        {
          day: 2,
          title: 'Kala Dungar & Artisan Village Exploration',
          description: 'Panoramic view from highest point in Kutch, Nirona village Rogan art live demo, cultural music under starlight.',
          mealsIncluded: ['Breakfast', 'Dinner']
        },
        {
          day: 3,
          title: 'Aina Mahal Heritage & Return Coach Journey',
          description: 'Visit historic Prag Mahal & Aina Mahal in Bhuj, lunch at local Kathiyawadi diner, return express coach.',
          mealsIncluded: ['Breakfast', 'Lunch']
        }
      ],
      inclusions: [
        'AC Luxury Coach Travel (Return)',
        '2 Nights Deluxe Tent / Resort Accommodation',
        'Daily Gourmet Meals as per itinerary',
        'White Rann Permit & Guided Tours',
        'Evening Cultural Folk Dance Shows'
      ],
      exclusions: ['Personal Shopping', 'Camel Ride Upgrades'],
      departureDates: [
        new Date(Date.now() + 3 * 24 * 3600 * 1000),
        new Date(Date.now() + 10 * 24 * 3600 * 1000),
        new Date(Date.now() + 17 * 24 * 3600 * 1000)
      ],
      maxGroupSize: 30,
      isActive: true
    },
    {
      tourId: 'udaipur-heritage-trail',
      title: 'Udaipur Heritage Trail',
      subtitle: 'City of Lakes, grand royal palaces & serene boat cruise on Lake Pichola',
      category: 'Culture',
      destination: 'Rajasthan',
      state: 'Rajasthan',
      durationDays: 2,
      durationNights: 1,
      basePrice: 3499,
      thumbnail: 'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?w=800&auto=format&fit=crop&q=80',
      images: [
        'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?w=800&auto=format&fit=crop&q=80'
      ],
      itinerary: [
        {
          day: 1,
          title: 'City Palace & Lake Pichola Boat Cruise',
          description: 'Luxury AC coach transfer to Udaipur, check-in to heritage hotel, private royal boat ride overlooking Jag Mandir.',
          mealsIncluded: ['Dinner']
        },
        {
          day: 2,
          title: 'Saheliyon-ki-Bari & Bagore Ki Haveli',
          description: 'Stroll through historic royal courtyards, shopping at Bada Bazaar for traditional Rajasthani textiles.',
          mealsIncluded: ['Breakfast']
        }
      ],
      inclusions: [
        'Intercity AC Sleeper Coach',
        '1 Night Heritage Haveli Hotel Stay',
        'Lake Pichola Boat Cruise Ticket',
        'Experienced Licensed Historian Guide'
      ],
      exclusions: ['Monument Camera Fees', 'Room Service'],
      departureDates: [
        new Date(Date.now() + 2 * 24 * 3600 * 1000),
        new Date(Date.now() + 7 * 24 * 3600 * 1000)
      ],
      maxGroupSize: 28,
      isActive: true
    },
    {
      tourId: 'goa-beach-getaway',
      title: 'Goa Beach Getaway',
      subtitle: 'Sun-kissed beaches, coastal cafes, watersports & Old Goa Portuguese cathedrals',
      category: 'Best seller',
      destination: 'Goa',
      state: 'Goa',
      durationDays: 4,
      durationNights: 3,
      basePrice: 7999,
      thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80',
      images: [
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80'
      ],
      itinerary: [
        {
          day: 1,
          title: 'North Goa Arrival & Sunset at Calangute',
          description: 'Direct multi-axle luxury coach to Panaji, transfer to 4-star beach resort, evening sunset stroll at Baga Beach.',
          mealsIncluded: ['Dinner']
        },
        {
          day: 2,
          title: 'Watersports & Fort Aguada',
          description: 'Parasailing, jet ski, and banana boat rides at Anjuna followed by panoramic lighthouse tour.',
          mealsIncluded: ['Breakfast']
        },
        {
          day: 3,
          title: 'South Goa Heritage & Mandovi River Cruise',
          description: 'Basilica of Bom Jesus, Se Cathedral, spice plantation tour with Goan buffet lunch, evening luxury river cruise.',
          mealsIncluded: ['Breakfast', 'Lunch']
        },
        {
          day: 4,
          title: 'Souvenir Shopping & Return Coach Departure',
          description: 'Free morning at resort pool, afternoon boarding on return express coach.',
          mealsIncluded: ['Breakfast']
        }
      ],
      inclusions: [
        'Multi-Axle Volvo Coach Transfer',
        '3 Nights Resort Accommodation with Pool',
        'Mandovi River Sunset Cruise Ticket',
        'Daily Buffet Breakfast'
      ],
      exclusions: ['Adventure Watersport Upgrades'],
      departureDates: [
        new Date(Date.now() + 5 * 24 * 3600 * 1000),
        new Date(Date.now() + 12 * 24 * 3600 * 1000)
      ],
      maxGroupSize: 35,
      isActive: true
    },
    {
      tourId: 'manali-mountain-adventure',
      title: 'Manali Snow & Valley Adventure',
      subtitle: 'Snow-capped peaks of Solang Valley, Rohtang Pass & riverside pine camps',
      category: 'Adventure',
      destination: 'Himachal',
      state: 'Himachal Pradesh',
      durationDays: 5,
      durationNights: 4,
      basePrice: 8499,
      thumbnail: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80',
      images: [
        'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80'
      ],
      itinerary: [
        {
          day: 1,
          title: 'Overnight Volvo Journey from Hub',
          description: 'Boarding luxury Scania AC semi-sleeper coach with mountain air suspension.',
          mealsIncluded: ['Water Bottle & Snacks']
        },
        {
          day: 2,
          title: 'Manali Local Sightseeing & Hadimba Temple',
          description: 'Hotel check-in, visit ancient cedar forest, Vashisht hot springs, evening mall road shopping.',
          mealsIncluded: ['Dinner']
        },
        {
          day: 3,
          title: 'Solang Valley & Snow Sports',
          description: 'Skiing, ziplining, ATV rides at Solang, Atal Tunnel visit.',
          mealsIncluded: ['Breakfast', 'Dinner']
        },
        {
          day: 4,
          title: 'Naggar Castle & River Rafting at Kullu',
          description: 'Historic wooden castle tour, river rafting on Beas River.',
          mealsIncluded: ['Breakfast', 'Dinner']
        },
        {
          day: 5,
          title: 'Departure & Memories',
          description: 'Return luxury coach departure.',
          mealsIncluded: ['Breakfast']
        }
      ],
      inclusions: [
        'Return Volvo AC Coach Travel',
        '3 Nights Riverside Resort Stay',
        'Daily Breakfast & Dinner',
        'All Local Sightseeing Transfers'
      ],
      exclusions: ['Rafting & Skiing Equipment Rentals'],
      departureDates: [
        new Date(Date.now() + 4 * 24 * 3600 * 1000),
        new Date(Date.now() + 11 * 24 * 3600 * 1000)
      ],
      maxGroupSize: 30,
      isActive: true
    }
  ];

  await Tour.insertMany(toursData);

  console.log('[Seed] Seeding Promotional Discount Offers...');
  await Offer.create([
    {
      code: 'RUPADIYA100',
      title: 'Flat ₹100 Off on Intercity Routes',
      description: 'Applicable on bookings above ₹500 across all 33 franchise companies.',
      discountType: 'FLAT',
      discountAmount: 100,
      discountPercent: 10,
      minBookingAmount: 500,
      validUntil: new Date(Date.now() + 90 * 24 * 3600 * 1000),
      isActive: true
    },
    {
      code: 'FIRSTTRIP',
      title: '15% First Time Traveler Discount',
      description: 'Save up to ₹250 on your maiden booking with Rupadiya platform.',
      discountType: 'PERCENTAGE',
      discountPercent: 15,
      maxDiscountAmount: 250,
      minBookingAmount: 800,
      validUntil: new Date(Date.now() + 60 * 24 * 3600 * 1000),
      isActive: true
    }
  ]);

  console.log('[Seed] Seeding Security Audit Logs...');
  await AuditLog.create({
    userId: admin._id,
    action: 'PLATFORM_INITIALIZED',
    resource: 'System',
    details: 'Rupadiya Platform database cleanly seeded with 33 company codes, 6 Hub-and-Spoke corridors, and Tour packages.',
    ipAddress: '127.0.0.1'
  });

  console.log('========================================================');
  console.log('  RUPADIYA PLATFORM SEED COMPLETED SUCCESSFULLY!        ');
  console.log('  Accounts (Password: Password123!):                   ');
  console.log('  - Super Admin:    admin@rupadiya.test                ');
  console.log('  - Company Owner:  owner@rupadiya.test (Company #01)  ');
  console.log('  - Agent L1:       agent@rupadiya.test (₹15,000 Wlt)  ');
  console.log('  - Sub-Agent L2:   subagent@rupadiya.test             ');
  console.log('  - Passenger:      passenger@rupadiya.test            ');
  console.log('========================================================');

  process.exit(0);
}

seed().catch(err => {
  console.error('[Seed Fatal Error]', err);
  process.exit(1);
});
