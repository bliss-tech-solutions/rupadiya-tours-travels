/**
 * Usage:
 *   node src/scripts/setPrimaryAdmin.js              → promote the oldest super admin if none is primary
 *   node src/scripts/setPrimaryAdmin.js admin@x.com  → make this super admin the PRIMARY (others become STANDARD)
 */
const mongoose = require('mongoose');
const env = require('../config/env');
const User = require('../modules/users/user.model');
const { ensurePrimaryAdmin } = require('../services/adminAccounts.service');

(async () => {
  await mongoose.connect(env.MONGODB_URI, { dbName: env.MONGODB_DB || 'rupadiya' });
  const email = process.argv[2];
  if (email) {
    const target = await User.findOne({ email: email.toLowerCase(), role: 'SUPER_ADMIN' });
    if (!target) {
      console.error(`No super admin with email ${email}`);
      process.exit(1);
    }
    await User.updateMany({ role: 'SUPER_ADMIN', _id: { $ne: target._id } }, { $set: { adminLevel: 'STANDARD' } });
    await User.updateOne({ _id: target._id }, { $set: { adminLevel: 'PRIMARY' } });
    console.log(`${target.email} is now the PRIMARY super admin.`);
  } else {
    await ensurePrimaryAdmin();
  }
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
