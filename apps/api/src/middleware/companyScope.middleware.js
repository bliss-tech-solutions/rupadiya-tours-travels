const { ROLES } = require('../config/constants');

function requireCompanyScope(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Super Admin bypasses company filter
  if (req.user.role === ROLES.SUPER_ADMIN) {
    req.companyFilter = {};
    req.isSuperAdmin = true;
    return next();
  }

  // Company Owner & Agent are strictly restricted to their companyCode
  if (req.user.role === ROLES.COMPANY_OWNER || req.user.role === ROLES.AGENT) {
    if (!req.user.companyCode) {
      return res.status(403).json({ error: 'User is not assigned to any registered company code.' });
    }

    req.companyFilter = { companyCode: req.user.companyCode };
    req.effectiveCompanyCode = req.user.companyCode;
    return next();
  }

  return res.status(403).json({ error: 'Company-scoped access forbidden for this role.' });
}

module.exports = { requireCompanyScope };
