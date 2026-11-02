const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../modules/users/user.model');

function extractToken(req) {
  // 1. Prioritize explicit Authorization Bearer header sent by the client
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.split(' ')[1];
    if (bearer && bearer !== 'null' && bearer !== 'undefined' && bearer.trim() !== '') {
      return bearer.trim();
    }
  }

  // 2. Fall back to httpOnly cookie
  if (req.cookies && req.cookies.rupadiya_access_token) {
    return req.cookies.rupadiya_access_token;
  }

  return null;
}

async function authenticateToken(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication required. Please sign in.', 
      code: 'AUTH_REQUIRED' 
    });
  }

  try {
    const decoded = jwt.verify(token, env.AUTH_ACCESS_SECRET);
    const userId = decoded.id || decoded._id || decoded.userId;
    const user = await User.findById(userId).select('-passwordHash');

    if (!user || !user.isActive) {
      return res.status(401).json({ 
        success: false, 
        error: 'User account not found or deactivated', 
        code: 'ACCOUNT_DEACTIVATED' 
      });
    }

    // Strict Multi-Portal Role Isolation:
    // If request specifies a client header, enforce that user's role matches that portal!
    const clientHeader = req.headers['x-rupadiya-client'];
    if (clientHeader === 'admin-portal' && user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        error: `Access Denied: Only Super Admin can access admin-portal endpoints. (Authenticated as ${user.role})`,
        code: 'PORTAL_ROLE_MISMATCH'
      });
    }
    if (clientHeader === 'company-portal' && user.role !== 'COMPANY_OWNER' && user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        error: `Access Denied: Only Company Owners can access company-portal endpoints. (Authenticated as ${user.role})`,
        code: 'PORTAL_ROLE_MISMATCH'
      });
    }
    if (clientHeader === 'agent-portal' && user.role !== 'AGENT') {
      return res.status(403).json({
        success: false,
        error: `Access Denied: Only Booking Agents can access agent-portal endpoints. (Authenticated as ${user.role})`,
        code: 'PORTAL_ROLE_MISMATCH'
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ 
      success: false, 
      error: 'Invalid or expired authentication token', 
      code: 'TOKEN_EXPIRED' 
    });
  }
}

/**
 * Optional authentication: If token is provided, decode and attach user; otherwise proceed as guest
 */
async function optionalAuth(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, env.AUTH_ACCESS_SECRET);
    const user = await User.findById(decoded.id).select('-passwordHash');
    req.user = user || null;
  } catch {
    req.user = null;
  }
  next();
}

const { authorizeRoles } = require('./rbac.middleware');

module.exports = {
  authenticateToken,
  authenticate: authenticateToken,
  optionalAuth,
  authorizeRoles,
  authorize: authorizeRoles
};
