/**
 * Database Migration Script: migrateCompanyIds.js
 * Backfills referential `companyId` (ObjectId ref: 'Company') across all platform collections
 * based on numeric `companyCode`.
 * Safe and idempotent: can be executed multiple times without side effects.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');

const Company = require('../modules/companies/company.model');
const User = require('../modules/users/user.model');
const Bus = require('../modules/fleet/bus.model');
const Route = require('../modules/routes/route.model');
const Trip = require('../modules/trips/trip.model');
const Booking = require('../modules/bookings/booking.model');
const { Wallet, WalletLedger } = require('../modules/wallets/wallet.model');
const DepositRequest = require('../modules/wallets/deposit.model');
const TaxEntry = require('../modules/tax/tax.model');
const { CommissionRecord } = require('../modules/commissions/commission.model');
const Payment = require('../modules/payments/payment.model');
const WithdrawalRequest = require('../modules/withdrawals/withdrawal.model');

async function migrateCompanyIds() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/rupadiya_demo';
  console.log('====================================================');
  console.log('  Rupadiya Platform - CompanyId Relational Migration');
  console.log(`  Connecting to: ${uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')}`);
  console.log('====================================================');

  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB.');

    // 1. Build lookup map of all active companies by companyCode
    const allCompanies = await Company.find();
    console.log(`Loaded ${allCompanies.length} companies from database.`);
    
    const companyMap = new Map();
    for (const comp of allCompanies) {
      companyMap.set(comp.companyCode, comp._id);
    }

    if (companyMap.size === 0) {
      console.warn('⚠️ No companies found! Run setupCleanDatabase.js first to create initial franchise companies.');
      await mongoose.disconnect();
      return;
    }

    const migrationSummary = [];

    // Helper to migrate a collection
    async function migrateCollection(model, name, queryField = 'companyCode') {
      let updatedCount = 0;
      const totalDocs = await model.countDocuments();
      
      for (const [code, compId] of companyMap.entries()) {
        const query = {
          [queryField]: code,
          $or: [{ companyId: null }, { companyId: { $exists: false } }]
        };
        const res = await model.updateMany(query, { $set: { companyId: compId } });
        updatedCount += res.modifiedCount;
      }

      migrationSummary.push({
        Collection: name,
        TotalDocuments: totalDocs,
        UpdatedCompanyIds: updatedCount
      });
    }

    // Migrate each entity collection
    await migrateCollection(User, 'users');
    await migrateCollection(Bus, 'buses');
    await migrateCollection(Route, 'routes');
    await migrateCollection(Trip, 'trips');
    await migrateCollection(Booking, 'bookings');
    await migrateCollection(Wallet, 'wallets');
    await migrateCollection(WalletLedger, 'walletledgers');
    await migrateCollection(DepositRequest, 'deposits');
    await migrateCollection(TaxEntry, 'tax_entries');
    await migrateCollection(CommissionRecord, 'commissionrecords');
    await migrateCollection(Payment, 'payments');
    await migrateCollection(WithdrawalRequest, 'withdrawalrequests');

    // Also link company owners back to company
    let ownerLinksUpdated = 0;
    for (const comp of allCompanies) {
      if (comp.ownerId) {
        const res = await User.updateOne(
          { _id: comp.ownerId, $or: [{ companyId: null }, { companyId: { $exists: false } }] },
          { $set: { companyId: comp._id, companyCode: comp.companyCode } }
        );
        if (res.modifiedCount > 0) ownerLinksUpdated++;
      }
    }

    console.log('\nMigration Summary Table:');
    console.table(migrationSummary);
    console.log(`Company Owners linked directly to Company: ${ownerLinksUpdated}`);

    console.log('\n====================================================');
    console.log('✅ CompanyId migration completed successfully!');
    console.log('====================================================');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrateCompanyIds();

