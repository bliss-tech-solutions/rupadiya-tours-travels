function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: Access restricted to roles [${allowedRoles.join(', ')}]. Your role is ${req.user.role}.`
      });
    }

    next();
  };
}

const isPrimaryAdmin = (user) => Boolean(user && user.role === 'SUPER_ADMIN' && user.adminLevel === 'PRIMARY');

/**
 * Only the primary super admin (main RBS account) may pass.
 * Used for admin-account management and any export of user / passenger personal data.
 */
function requirePrimaryAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized: Authentication required' });
  if (!isPrimaryAdmin(req.user)) {
    return res.status(403).json({
      error: 'Only the primary super admin can perform this action.',
      code: 'PRIMARY_ADMIN_REQUIRED'
    });
  }
  next();
}

module.exports = { authorizeRoles, requirePrimaryAdmin, isPrimaryAdmin };

