/**
 * Rupadiya Platform - Clean Database Setup Script
 * Sets up a production-ready relational database with:
 * 1. Root Super Admin account
 * 2. 33 Franchise Companies (#01 to #33) with real Owner accounts & Company Wallets
 * 3. 5-Tier Agent referral network with real hierarchy (L1 -> L2 -> L3 -> L4 -> L5)
 * 4. Compliant Fleet (36 Berth Sleeper & 40 Passenger Seater) with valid papers
 * 5. Hub-and-Spoke Intercity Corridors (Rupadiya <-> Lucknow, Delhi, Varanasi, etc.)
 * 6. Active scheduled trips with seat maps
 * 7. Verified test booking with real PNR (RUP-T1001), passenger manifest, wallet ledger & tax records
 * 8. 5 Commission Tiers (L1 to L5)
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../modules/users/user.model');
const Company = require('../modules/companies/company.model');
const Bus = require('../modules/fleet/bus.model');
const Route = require('../modules/routes/route.model');
const Trip = require('../modules/trips/trip.model');
const Booking = require('../modules/bookings/booking.model');
const { Wallet, WalletLedger } = require('../modules/wallets/wallet.model');
const { CommissionTier, CommissionRecord } = require('../modules/commissions/commission.model');
const TaxEntry = require('../modules/tax/tax.model');
const DepositRequest = require('../modules/wallets/deposit.model');

const {
  ROLES,
  KYC_STATUS,
  COMPANY_CODES,
  DEFAULT_COMMISSION_TIERS,
  TRANSACTION_TYPES
} = require('../config/constants');

async function setupCleanDatabase() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/rupadiya_demo';
  console.log('====================================================');
  console.log('  Rupadiya Platform - Clean Relational DB Setup');
  console.log(`  Connecting to: ${uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')}`);
  console.log('====================================================');

  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB.');

    const defaultPassword = 'Password123!';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(defaultPassword, salt);

    // 1. Root Super Admin
    console.log('\n👑 1. Initializing Super Admin...');
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@rupadiya.test').toLowerCase();
    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      admin = await User.create({
        name: 'Super Admin Officer',
        email: adminEmail,
        phone: '9876543210',
        passwordHash,
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        kycStatus: KYC_STATUS.VERIFIED
      });
      console.log(`   Super Admin created: ${adminEmail}`);
    } else {
      admin.role = ROLES.SUPER_ADMIN;
      admin.isActive = true;
      await admin.save();
      console.log(`   Super Admin verified: ${adminEmail}`);
    }

    // 2. 33 Franchise Companies & Dedicated Company Owners
    console.log('\n🏢 2. Initializing 33 Franchise Companies and Owner Accounts...');
    const createdCompanies = [];
    for (const c of COMPANY_CODES) {
      let company = await Company.findOne({ companyCode: c.code });
      const ownerEmail = `owner${c.code}@rupadiya.test`;
      let owner = await User.findOne({ email: ownerEmail });

      if (!owner) {
        owner = await User.create({
          name: `${c.defaultName} Owner`,
          email: ownerEmail,
          phone: `98${String(c.code).padStart(2, '0')}000001`,
          passwordHash,
          role: ROLES.COMPANY_OWNER,
          companyCode: c.code,
          isActive: true,
          kycStatus: KYC_STATUS.VERIFIED
        });
      }

      if (!company) {
        company = await Company.create({
          companyCode: c.code,
          name: c.code === 1 ? 'Rupadiya Super Express Ltd.' : c.defaultName,
          slug: c.slug,
          ownerId: owner._id,
          status: 'ACTIVE',
          contactPhone: `+91 98${String(c.code).padStart(2, '0')}000001`,
          contactEmail: `contact@${c.slug}.rupadiya.test`,
          address: `Transport Nagar, Hub Terminal #${c.code}, Rupadiya, UP`,
          annualTarget: {
            targetPassengers: 12000,
            currentPassengers: 0,
            financialYear: '2026-2027'
          }
        });
      } else {
        company.ownerId = owner._id;
        await company.save();
      }

      owner.companyId = company._id;
      owner.companyCode = company.companyCode;
      await owner.save();

      // Ensure Company Wallet
      let compWallet = await Wallet.findOne({ userId: owner._id });
      if (!compWallet) {
        compWallet = await Wallet.create({
          userId: owner._id,
          companyId: company._id,
          companyCode: company.companyCode,
          ownerType: 'COMPANY',
          availableBalance: 50000,
          reservedBalance: 0
        });
      } else {
        compWallet.companyId = company._id;
        compWallet.ownerType = 'COMPANY';
        await compWallet.save();
      }

      createdCompanies.push(company);
    }
    console.log(`   33 Companies & Owners verified with relational companyId.`);

    const comp1 = createdCompanies[0];
    const comp2 = createdCompanies[1];

    // 3. 5-Tier Agent Referral Tree under Company 1
    console.log('\n🤝 3. Initializing 5-Tier Agent Referral Hierarchy (Company 1)...');
    let sponsorId = null;
    const tierAgents = [];

    for (let lvl = 5; lvl >= 1; lvl--) {
      const agentEmail = `agent_l${lvl}@rupadiya.test`;
      let agent = await User.findOne({ email: agentEmail });
      const refCode = `AGT01L${lvl}T0001`; // Exactly 12 characters

      if (!agent) {
        agent = await User.create({
          name: `Tier ${lvl} Partner Agent`,
          email: agentEmail,
          phone: `981000000${lvl}`,
          passwordHash,
          role: ROLES.AGENT,
          companyId: comp1._id,
          companyCode: comp1.companyCode,
          referredBy: sponsorId,
          referralCode: refCode,
          agencyName: `Rupadiya Prime Desk #${lvl}`,
          agentLevel: lvl === 1 ? 'PLATINUM' : (lvl <= 3 ? 'GOLD' : 'SILVER'),
          kycStatus: KYC_STATUS.VERIFIED,
          aadharNumber: `12345678901${lvl}`,
          panNumber: `RUPAD123${lvl}A`,
          bankDetails: {
            accountName: `Tier ${lvl} Partner`,
            accountNumberMasked: `XXXX-XXXX-100${lvl}`,
            ifscCode: 'HDFC0001234',
            upiId: `agent${lvl}@upi`,
            bankName: 'HDFC Bank'
          },
          isActive: true
        });
      } else {
        agent.companyId = comp1._id;
        agent.referredBy = sponsorId;
        agent.referralCode = refCode;
        await agent.save();
      }

      // Agent Wallet with REAL 0 initial balance
      let agtWallet = await Wallet.findOne({ userId: agent._id });
      if (!agtWallet) {
        agtWallet = await Wallet.create({
          userId: agent._id,
          companyId: comp1._id,
          companyCode: comp1.companyCode,
          ownerType: 'AGENT',
          availableBalance: 0,
          reservedBalance: 0
        });
      } else {
        agtWallet.companyId = comp1._id;
        await agtWallet.save();
      }

      sponsorId = agent._id;
      tierAgents[lvl] = agent;
    }
    console.log('   5-Tier Hierarchy: L1 (Top) -> L2 -> L3 -> L4 -> L5 (Base)');

    // 4. Standard Compliant Fleets
    console.log('\n🚌 4. Initializing Standard Fleets with Valid Legal Compliance Documents...');
    const fleetDefs = [
      {
        company: comp1,
        busNumber: 'UP-40-BT-1001',
        name: 'Rupadiya Royal Sleeper Coach #01',
        busType: 'AC Sleeper (2+1)',
        category: 'SLEEPER',
        layoutType: '2+1',
        totalSeats: 36
      },
      {
        company: comp1,
        busNumber: 'UP-40-BT-1002',
        name: 'Rupadiya Express Seater Coach #02',
        busType: 'AC Seater (2+2)',
        category: 'SEATER',
        layoutType: '2+2',
        totalSeats: 40
      },
      {
        company: comp2,
        busNumber: 'UP-40-BT-2001',
        name: 'Rupadiya Luxury Sleeper Coach #03',
        busType: 'AC Sleeper (2+1)',
        category: 'SLEEPER',
        layoutType: '2+1',
        totalSeats: 36
      }
    ];

    const validExpiry = new Date(Date.now() + 365 * 24 * 3600 * 1000); // 1 year in future
    const createdBuses = [];

    for (const fb of fleetDefs) {
      let bus = await Bus.findOne({ busNumber: fb.busNumber });
      const complianceDocs = {
        rc: { documentNumber: `RC-${fb.busNumber}`, expiryDate: validExpiry, verified: true },
        insurance: { documentNumber: `INS-${fb.busNumber}`, expiryDate: validExpiry, verified: true },
        fitness: { documentNumber: `FIT-${fb.busNumber}`, expiryDate: validExpiry, verified: true },
        permit: { documentNumber: `PER-${fb.busNumber}`, expiryDate: validExpiry, verified: true },
        puc: { documentNumber: `PUC-${fb.busNumber}`, expiryDate: validExpiry, verified: true },
        roadTax: { documentNumber: `TAX-${fb.busNumber}`, expiryDate: validExpiry, verified: true },
        driverLicense: { documentNumber: `DL-${fb.busNumber}`, expiryDate: validExpiry, verified: true }
      };

      if (!bus) {
        bus = await Bus.create({
          busNumber: fb.busNumber,
          name: fb.name,
          operatorName: fb.company.name,
          companyId: fb.company._id,
          companyCode: fb.company.companyCode,
          busType: fb.busType,
          category: fb.category,
          layoutType: fb.layoutType,
          totalSeats: fb.totalSeats,
          legalDocuments: complianceDocs,
          status: 'ACTIVE'
        });
      } else {
        bus.companyId = fb.company._id;
        bus.legalDocuments = complianceDocs;
        await bus.save();
      }
      createdBuses.push(bus);
    }
    console.log(`   ${createdBuses.length} Fleet coaches verified with 365-day compliance.`);

    // 5. Hub-and-Spoke Intercity Routes
    console.log('\n🛣️ 5. Initializing Intercity Corridors...');
    const corridorDefs = [
      {
        from: { id: 'rupadiya', name: 'Rupadiya', state: 'Uttar Pradesh' },
        to: { id: 'lucknow', name: 'Lucknow', state: 'Uttar Pradesh' },
        distanceKm: 185,
        durationHours: 4.5,
        baseFare: 450,
        boarding: [
          { id: 'bp-rup-1', name: 'Rupadiya Border Main Stand', landmark: 'Opposite Custom Gate', timeOffsetMinutes: 0 },
          { id: 'bp-rup-2', name: 'Rupadiya Toll Plaza Checkpost', landmark: 'National Highway 927', timeOffsetMinutes: 15 }
        ],
        dropping: [
          { id: 'dp-lko-1', name: 'Lucknow Alambagh ISBT Terminal', landmark: 'Platform 4', timeOffsetMinutes: 270 },
          { id: 'dp-lko-2', name: 'Lucknow Charbagh Railway Stand', landmark: 'Station Front', timeOffsetMinutes: 290 }
        ]
      },
      {
        from: { id: 'rupadiya', name: 'Rupadiya', state: 'Uttar Pradesh' },
        to: { id: 'delhi', name: 'Delhi', state: 'Delhi' },
        distanceKm: 580,
        durationHours: 11.0,
        baseFare: 1100,
        boarding: [
          { id: 'bp-rup-del-1', name: 'Rupadiya Border Main Stand', landmark: 'Platform 1', timeOffsetMinutes: 0 }
        ],
        dropping: [
          { id: 'dp-del-1', name: 'Kashmere Gate ISBT', landmark: 'Gate 2', timeOffsetMinutes: 660 },
          { id: 'dp-del-2', name: 'Anand Vihar Terminal', landmark: 'Metro Pillar 42', timeOffsetMinutes: 700 }
        ]
      }
    ];

    const createdRoutes = [];
    for (const cd of corridorDefs) {
      let r = await Route.findOne({ 'fromCity.id': cd.from.id, 'toCity.id': cd.to.id });
      if (!r) {
        r = await Route.create({
          companyId: comp1._id,
          companyCode: comp1.companyCode,
          fromCity: cd.from,
          toCity: cd.to,
          distanceKm: cd.distanceKm,
          estimatedDurationHours: cd.durationHours,
          baseFare: cd.baseFare,
          boardingPoints: cd.boarding,
          droppingPoints: cd.dropping,
          isActive: true
        });
      } else {
        r.companyId = comp1._id;
        await r.save();
      }
      createdRoutes.push(r);
    }
    console.log(`   ${createdRoutes.length} Corridors verified.`);

    // 6. Scheduled Trips
    console.log('\n📅 6. Initializing Scheduled Trips for Today & Tomorrow...');
    const now = new Date();
    const trip1Dep = new Date(now.getTime() + 4 * 3600 * 1000); // 4 hours from now (Today)
    const trip1Arr = new Date(trip1Dep.getTime() + 4.5 * 3600 * 1000);

    let testTrip = await Trip.findOne({ companyId: comp1._id, routeId: createdRoutes[0]._id });
    if (!testTrip) {
      testTrip = await Trip.create({
        companyId: comp1._id,
        companyCode: comp1.companyCode,
        routeId: createdRoutes[0]._id,
        busId: createdBuses[1]._id, // 40 Seater Coach
        departureTime: trip1Dep,
        arrivalTime: trip1Arr,
        baseFare: createdRoutes[0].baseFare,
        seats: Trip.generateSeater40Seats(createdRoutes[0].baseFare),
        status: 'SCHEDULED'
      });
    } else {
      testTrip.departureTime = trip1Dep;
      testTrip.arrivalTime = trip1Arr;
      testTrip.companyId = comp1._id;
      testTrip.status = 'SCHEDULED';
      await testTrip.save();
    }
    console.log(`   Trip scheduled: ${createdRoutes[0].fromCity.name} -> ${createdRoutes[0].toCity.name} at ${testTrip.departureTime.toLocaleTimeString()}`);

    // 7. Seed Real Confirmed Booking (RUP-T1001) for Track Bus & Print Ticket verification
    console.log('\n🎟️ 7. Initializing Real Confirmed Booking (#RUP-T1001)...');
    const pnrCode = 'RUP-T1001';
    let testBooking = await Booking.findOne({ pnr: pnrCode });

    const passengerUser = await User.findOne({ email: 'passenger@rupadiya.test' });
    let traveler = passengerUser;
    if (!traveler) {
      traveler = await User.create({
        name: 'Rajesh Kumar',
        email: 'passenger@rupadiya.test',
        phone: '9876543210',
        passwordHash,
        role: ROLES.PASSENGER,
        isActive: true
      });
    }

    if (!testBooking) {
      // Mark seat 1A and 1B as BOOKED on trip
      testTrip.seats.forEach(s => {
        if (s.seatNumber === '1A' || s.seatNumber === '1B') {
          s.status = 'BOOKED';
          s.passenger = { name: 'Rajesh Kumar', age: 34, gender: 'male' };
        }
      });
      await testTrip.save();

      testBooking = await Booking.create({
        bookingId: 'BK_RUP_10001',
        pnr: pnrCode,
        passengerId: traveler._id,
        tripId: testTrip._id,
        routeId: createdRoutes[0]._id,
        busId: createdBuses[1]._id,
        companyId: comp1._id,
        companyCode: comp1.companyCode,
        referralAgentId: tierAgents[1]._id, // L1 Agent
        seatNumbers: ['1A', '1B'],
        passengers: [
          { seatNumber: '1A', name: 'Rajesh Kumar', age: 34, gender: 'male', fare: 450 },
          { seatNumber: '1B', name: 'Sunita Kumar', age: 32, gender: 'female', fare: 450 }
        ],
        boardingPoint: {
          name: 'Rupadiya Border Main Stand',
          time: testTrip.departureTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
        },
        droppingPoint: {
          name: 'Lucknow Alambagh ISBT Terminal',
          time: testTrip.arrivalTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
        },
        fareBreakdown: {
          baseFare: 450,
          seatCount: 2,
          subtotal: 900,
          gstAmount: 45, // 5% GST
          insuranceAmount: 0,
          discountAmount: 0,
          totalPayable: 945
        },
        contactDetails: {
          email: 'passenger@rupadiya.test',
          phone: '9876543210'
        },
        paymentProvider: 'agent_wallet',
        paymentStatus: 'SUCCESS',
        paymentReference: 'TXN_INIT_945',
        status: 'CONFIRMED'
      });

      // Record 5% GST in tax_entries
      await TaxEntry.create({
        taxType: 'GST',
        refType: 'BOOKING',
        refId: pnrCode,
        bookingId: testBooking._id,
        companyId: comp1._id,
        companyCode: comp1.companyCode,
        taxableAmount: 900,
        taxRate: 0.05,
        amount: 45,
        period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
        financialYear: '2026-2027',
        status: 'ACCRUED'
      });

      // Distribute 5-tier commissions & record 1% TCS
      const commissionService = require('../modules/commissions/commission.service');
      await commissionService.distributeCommissions({
        booking: testBooking,
        trip: testTrip,
        seatCount: 2
      });

      console.log(`   Real test booking #${pnrCode} created with GST & 5-tier commission ledger.`);
    } else {
      testBooking.companyId = comp1._id;
      await testBooking.save();
      console.log(`   Test booking #${pnrCode} verified.`);
    }

    // 8. Commission Tiers (1 to 5)
    console.log('\n💎 8. Verifying Commission Tiers (1 to 5)...');
    for (const tier of DEFAULT_COMMISSION_TIERS) {
      await CommissionTier.findOneAndUpdate(
        { level: tier.level },
        { ...tier, bonusPerSeat: 20, isActive: true },
        { upsert: true, new: true }
      );
    }
    console.log('   5 Tiers verified with ₹20 bonus.');

    console.log('\n====================================================');
    console.log('🎉 Clean Database Setup Complete with 100% Relational Integrity!');
    console.log('   Super Admin:   admin@rupadiya.test / Password123!');
    console.log('   Company Owner: owner1@rupadiya.test / Password123!');
    console.log('   Agent (L1):    agent_l1@rupadiya.test / Password123! (Code: AGT01L1T0001)');
    console.log('   Passenger:     passenger@rupadiya.test (OTP: 1234 in non-prod)');
    console.log('   Live Test PNR: RUP-T1001 (Ready for Track Bus & Print Ticket)');
    console.log('====================================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Database setup error:', err);
    process.exit(1);
  }
}

setupCleanDatabase();

