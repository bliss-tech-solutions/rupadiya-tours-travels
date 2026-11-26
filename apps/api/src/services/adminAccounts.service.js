const User = require('../modules/users/user.model');

/**
 * Guarantees exactly one way into admin-account management:
 * if no super admin is PRIMARY yet, the oldest super admin is promoted and every
 * other super admin without a level becomes STANDARD.
 */
async function ensurePrimaryAdmin() {
  const primary = await User.findOne({ role: 'SUPER_ADMIN', adminLevel: 'PRIMARY' }).select('_id email');
  if (!primary) {
    const oldest = await User.findOne({ role: 'SUPER_ADMIN' }).sort({ createdAt: 1, _id: 1 }).select('_id email');
    if (oldest) {
      await User.updateOne({ _id: oldest._id }, { $set: { adminLevel: 'PRIMARY' } });
      console.log(`[Admin] ${oldest.email} promoted to PRIMARY super admin (no primary existed).`);
    }
  }
  await User.updateMany(
    { role: 'SUPER_ADMIN', adminLevel: { $in: [null, undefined] } },
    { $set: { adminLevel: 'STANDARD' } }
  );
}

module.exports = { ensurePrimaryAdmin };
