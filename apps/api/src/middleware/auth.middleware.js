const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../modules/users/user.model');

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  try {
    const decoded = jwt.verify(token, env.AUTH_ACCESS_SECRET);
    const user = await User.findById(decoded.id).select('-passwordHash');

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User account not found or deactivated' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired authentication token' });
  }
}

/**
 * Optional authentication: If token is provided, decode and attach user; otherwise proceed as guest
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

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

