const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const Company = require('../modules/companies/company.model');
const Trip = require('../modules/trips/trip.model');
const { FIXED_COMPANY_SPECS } = require('../config/constants');
const holdStore = require('../config/holdStore');

async function syncAndClear() {
  console.log('[DB Sync] Connecting to MongoDB...');
  await connectDB();

  console.log('[DB Sync] Existing companies count:', await Company.countDocuments());

  // Step 1: Temporarily prefix all slugs to avoid unique index collisions during remapping
  await Company.updateMany({}, [{ $set: { slug: { $concat: ['$slug', '-temp-', { $toString: '$_id' }] } } }]);
  console.log('[DB Sync] Temporary slugs set.');

  // Step 2: Upsert all 35 companies cleanly
  for (const spec of FIXED_COMPANY_SPECS) {
    let comp = await Company.findOne({ companyCode: spec.code });
    if (comp) {
      comp.rank = spec.rank;
      comp.shortCode = spec.shortCode;
      comp.name = spec.defaultName;
      comp.slug = spec.slug;
      comp.status = 'ACTIVE';
      await comp.save();
      console.log(`Updated Company #${spec.code} [${spec.shortCode}] -> ${spec.defaultName}`);
    } else {
      await Company.create({
        companyCode: spec.code,
        rank: spec.rank,
        shortCode: spec.shortCode,
        name: spec.defaultName,
        slug: spec.slug,
        contactPhone: '+91 0000000000',
        contactEmail: `contact@${spec.slug}.rupadiya.test`,
        status: 'ACTIVE',
        annualTarget: {
          targetPassengers: 12000,
          currentPassengers: 0,
          financialYear: '2026-2027'
        }
      });
      console.log(`Created Company #${spec.code} [${spec.shortCode}] -> ${spec.defaultName} (${spec.nepaliName})`);
    }
  }

  // Delete any companies beyond code 35 if they exist
  const removed = await Company.deleteMany({ companyCode: { $gt: 35 } });
  if (removed.deletedCount > 0) {
    console.log(`Removed ${removed.deletedCount} extra companies beyond code 35.`);
  }

  const finalCompanyCount = await Company.countDocuments();
  console.log(`[DB Sync] Total Companies in DB: ${finalCompanyCount}`);

  // Clear all legacy trips
  const deletedTrips = await Trip.deleteMany({});
  console.log(`[DB Sync] Deleted ${deletedTrips.deletedCount} legacy trips.`);

  try {
    if (holdStore && typeof holdStore.holds?.clear === 'function') {
      holdStore.holds.clear();
    }
  } catch (e) {}

  const finalTripCount = await Trip.countDocuments();
  console.log(`[DB Sync] Final Trip Count in DB: ${finalTripCount}`);

  await mongoose.disconnect();
  console.log('[DB Sync] Finished successfully.');
}

syncAndClear().catch(err => {
  console.error('[DB Sync Error]:', err);
  process.exit(1);
});
