const mongoose = require('mongoose');
const { ROLES } = require('../config/constants');
const Company = require('../modules/companies/company.model');

async function requireCompanyScope(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Super Admin bypasses company filter
  if (req.user.role === ROLES.SUPER_ADMIN) {
    req.companyFilter = {};
    req.isSuperAdmin = true;
    return next();
  }

  // Company Owner & Agent are strictly restricted to their company
  if (req.user.role === ROLES.COMPANY_OWNER || req.user.role === ROLES.AGENT) {
    if (!req.user.companyCode && !req.user.companyId) {
      return res.status(403).json({ error: 'User is not assigned to any registered company.' });
    }

    // Strict Tenant Isolation: An owner/agent can only access their OWN franchise code!
    const requestedCode = req.params?.code || req.params?.companyCode || req.query?.companyCode || req.body?.companyCode;
    if (requestedCode !== undefined && requestedCode !== null && requestedCode !== '') {
      const parsed = parseInt(requestedCode, 10);
      if (!isNaN(parsed) && parsed !== req.user.companyCode) {
        return res.status(403).json({
          error: `Cross-tenant access forbidden: Your account belongs to Company #${req.user.companyCode} and cannot manage Company #${parsed}.`,
          code: 'TENANT_MISMATCH'
        });
      }
    }

    let companyId = req.user.companyId;
    if (!companyId && req.user.companyCode && mongoose.connection?.readyState === 1) {
      try {
        const comp = await Company.findOne({ companyCode: req.user.companyCode }).lean().exec();
        if (comp) {
          companyId = comp._id;
          req.user.companyId = comp._id;
        }
      } catch (e) {
        // Fallback without throwing if DB query encounters an issue
      }
    }

    if (companyId) {
      req.companyFilter = {
        $or: [
          { companyId },
          { companyCode: req.user.companyCode }
        ]
      };
      req.companyId = companyId;
    } else {
      req.companyFilter = { companyCode: req.user.companyCode };
    }
    req.effectiveCompanyCode = req.user.companyCode;
    return next();
  }

  return res.status(403).json({ error: 'Company-scoped access forbidden for this role.' });
}

module.exports = { requireCompanyScope };
