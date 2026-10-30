const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../modules/users/user.model');

function extractToken(req) {
  // 1. Try reading from httpOnly cookie first
  if (req.cookies && req.cookies.rupadiya_access_token) {
    return req.cookies.rupadiya_access_token;
  }

  // 2. Fall back to Authorization Bearer header
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
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
