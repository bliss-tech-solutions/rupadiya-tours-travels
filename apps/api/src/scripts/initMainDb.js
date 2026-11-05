/**
 * Rupadiya Platform - Main Database Initialization Script
 * Bootstraps a fresh or existing database with:
 * 1. Root Super Admin Account
 * 2. All 34 Franchise Companies (Ranks 1 to 34, #01 to #34)
 * 3. Standardized 6 Bidirectional Hub-and-Spoke Corridors (12 Routes)
 * 4. Standard Fleets (36 Berth Sleepers & 40 Passenger Seaters)
 * 5. Commission Tiers (5 Tiers L1 to L5)
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../modules/users/user.model');
const Company = require('../modules/companies/company.model');
const Bus = require('../modules/fleet/bus.model');
const Route = require('../modules/routes/route.model');
const { CommissionTier } = require('../modules/commissions/commission.model');

const {
  ROLES,
  KYC_STATUS,
  COMPANY_CODES,
  DEFAULT_COMMISSION_TIERS
} = require('../config/constants');

async function initMainDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI is not set in environment or .env file!');
    process.exit(1);
  }

  console.log(`====================================================`);
  console.log(`  Rupadiya Platform Database Initializer`);
  console.log(`  Connecting to: ${uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')}`);
  console.log(`====================================================`);

  try {
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB successfully.');

    // 1. Root Super Admin Account
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@rupadiya.test').toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || 'Password123!';
    let admin = await User.findOne({ email: adminEmail });

    if (!admin) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(adminPassword, salt);
      admin = await User.create({
        name: 'Super Admin Officer',
        email: adminEmail,
        phone: '9876543210',
        passwordHash,
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        kycStatus: KYC_STATUS.VERIFIED
      });
      console.log(`✅ Super Admin created: ${adminEmail} (Role: ${ROLES.SUPER_ADMIN})`);
    } else {
      console.log(`ℹ️ Super Admin already exists: ${adminEmail}`);
    }

    // 2. 34 Franchise Companies (#01 to #34, Ntt to Ott)
    console.log(`\n📦 Verifying 34 Franchise Companies Registry...`);
    let companiesCreated = 0;
    for (const c of COMPANY_CODES) {
      const existing = await Company.findOne({ companyCode: c.code });
      if (!existing) {
        await Company.create({
          companyCode: c.code,
          rank: c.rank,
          shortCode: c.shortCode.toUpperCase(),
          name: c.defaultName,
          slug: c.slug,
          ownerId: null,
          status: 'ACTIVE',
          contactPhone: '',
          contactEmail: '',
          address: '',
          city: 'Rupadiya',
          state: 'Uttar Pradesh',
          annualTarget: {
            targetPassengers: 12000,
            currentPassengers: 0,
            financialYear: '2026-2027'
          }
        });
        companiesCreated++;
      } else {
        existing.rank = c.rank;
        existing.shortCode = c.shortCode.toUpperCase();
        existing.name = c.defaultName;
        existing.slug = c.slug;
        await existing.save();
      }
    }
    console.log(`✅ 34 Companies verified (${companiesCreated} newly created, ${COMPANY_CODES.length - companiesCreated} already existed/updated).`);

    // 3. 6 Hub-and-Spoke Corridors (Rupadiya <-> 6 Major Cities)
    console.log(`\n🛣️ Verifying Hub-and-Spoke Intercity Corridors...`);
    const hubCity = { id: 'rupadiya', name: 'Rupadiya', state: 'Uttar Pradesh' };
    const spokeDefinitions = [
      { id: 'ahmedabad', name: 'Ahmedabad', state: 'Gujarat', distanceKm: 1250, durationHours: 21.0, fare: 1650 },
      { id: 'surat', name: 'Surat', state: 'Gujarat', distanceKm: 1320, durationHours: 22.5, fare: 1750 },
      { id: 'vadodara', name: 'Vadodara', state: 'Gujarat', distanceKm: 1180, durationHours: 20.0, fare: 1550 },
      { id: 'bengaluru', name: 'Bengaluru', state: 'Karnataka', distanceKm: 1980, durationHours: 32.0, fare: 2400 },
      { id: 'hyderabad', name: 'Hyderabad', state: 'Telangana', distanceKm: 1720, durationHours: 28.0, fare: 2100 },
      { id: 'mumbai', name: 'Mumbai', state: 'Maharashtra', distanceKm: 1540, durationHours: 25.0, fare: 1950 },
    ];

    let routesCreated = 0;
    for (const spoke of spokeDefinitions) {
      // Outbound (Rupadiya -> Spoke)
      const existingOut = await Route.findOne({ 'fromCity.id': hubCity.id, 'toCity.id': spoke.id });
      if (!existingOut) {
        await Route.create({
          fromCity: { id: hubCity.id, name: hubCity.name, state: hubCity.state },
          toCity: { id: spoke.id, name: spoke.name, state: spoke.state },
          distanceKm: spoke.distanceKm,
          estimatedDurationHours: spoke.durationHours,
          baseFare: spoke.fare,
          boardingPoints: [
            { id: `bp-${hubCity.id}-1`, name: `${hubCity.name} Border Main Stand`, landmark: 'Platform 1', timeOffsetMinutes: 0 },
            { id: `bp-${hubCity.id}-2`, name: `${hubCity.name} Toll Plaza Checkpost`, landmark: 'Highway Bypass', timeOffsetMinutes: 20 }
          ],
          droppingPoints: [
            { id: `dp-${spoke.id}-1`, name: `${spoke.name} Central Terminal`, landmark: 'City Center', timeOffsetMinutes: Math.round(spoke.durationHours * 60) }
          ],
          isActive: true
        });
        routesCreated++;
      }

      // Inbound (Spoke -> Rupadiya)
      const existingIn = await Route.findOne({ 'fromCity.id': spoke.id, 'toCity.id': hubCity.id });
      if (!existingIn) {
        await Route.create({
          fromCity: { id: spoke.id, name: spoke.name, state: spoke.state },
          toCity: { id: hubCity.id, name: hubCity.name, state: hubCity.state },
          distanceKm: spoke.distanceKm,
          estimatedDurationHours: spoke.durationHours,
          baseFare: spoke.fare,
          boardingPoints: [
            { id: `bp-${spoke.id}-1`, name: `${spoke.name} Central Terminal`, landmark: 'City Center', timeOffsetMinutes: 0 }
          ],
          droppingPoints: [
            { id: `dp-${hubCity.id}-1`, name: `${hubCity.name} Border Main Stand`, landmark: 'Platform 1', timeOffsetMinutes: Math.round(spoke.durationHours * 60) }
          ],
          isActive: true
        });
        routesCreated++;
      }
    }
    console.log(`✅ Hub-and-Spoke corridors verified (${routesCreated} routes created).`);

    // 4. Initial Standard Fleets (36 Sleeper & 40 Seater Coaches)
    console.log(`\n🚌 Verifying Standardized Fleet Configuration...`);
    const initialBuses = [
      { companyCode: 1, busNumber: 'UP-40-BT-1001', name: 'Rupadiya Royal Sleeper Coach #01', layoutType: '2+1', busType: 'AC Sleeper (2+1)', category: 'SLEEPER', totalSeats: 36 },
      { companyCode: 1, busNumber: 'UP-40-BT-1002', name: 'Rupadiya Express Seater Coach #02', layoutType: '2+2', busType: 'AC Seater (2+2)', category: 'SEATER', totalSeats: 40 },
      { companyCode: 2, busNumber: 'UP-40-BT-2001', name: 'Rupadiya Deluxe Sleeper #03', layoutType: '2+1', busType: 'AC Sleeper (2+1)', category: 'SLEEPER', totalSeats: 36 },
      { companyCode: 3, busNumber: 'UP-40-BT-3001', name: 'Rupadiya City Seater #04', layoutType: '2+2', busType: 'AC Seater (2+2)', category: 'SEATER', totalSeats: 40 }
    ];

    let busesCreated = 0;
    for (const b of initialBuses) {
      const existingBus = await Bus.findOne({ busNumber: b.busNumber });
      if (!existingBus) {
        await Bus.create({
          companyCode: b.companyCode,
          busNumber: b.busNumber,
          name: b.name,
          busType: b.busType,
          category: b.category,
          layoutType: b.layoutType,
          totalSeats: b.totalSeats,
          status: 'ACTIVE'
        });
        busesCreated++;
      }
    }
    console.log(`✅ Fleet verified (${busesCreated} initial coaches created).`);

    // 5. Default Commission Tiers (5 Tiers L1 to L5)
    console.log(`\n💎 Verifying Commission Tiers...`);
    for (const tier of DEFAULT_COMMISSION_TIERS) {
      await CommissionTier.findOneAndUpdate(
        { level: tier.level },
        { ...tier, isActive: true },
        { upsert: true, new: true }
      );
    }
    console.log(`✅ 5 Commission Tiers verified.`);

    console.log(`\n====================================================`);
    console.log(`🎉 Database initialization complete and ready for production!`);
    console.log(`   Super Admin: ${adminEmail}`);
    console.log(`   Companies: 34 Franchises Active (#01 to #34, Ntt to Ott)`);
    console.log(`   Routes: 12 Hub-and-Spoke Corridors Configured`);
    console.log(`====================================================\n`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Database initialization error:', err);
    process.exit(1);
  }
}

initMainDb();
