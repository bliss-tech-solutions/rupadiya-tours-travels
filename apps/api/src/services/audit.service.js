const AuditLog = require('../modules/audit/audit.model');

/**
 * Records an immutable audit log entry for sensitive administrative operations.
 *
 * @param {Object} req - Express request object (extracts user and client IP/agent)
 * @param {Object} entry - { action, resource, resourceId, companyCode, details }
 */
async function recordAudit(req, entry = {}) {
  try {
    const user = req?.user || {};
    const ipAddress = req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req?.socket?.remoteAddress || '';
    const userAgent = req?.headers?.['user-agent'] || '';

    await AuditLog.create({
      userId: user._id || null,
      userRole: user.role || 'ANONYMOUS',
      companyCode: entry.companyCode ?? user.companyCode ?? null,
      action: entry.action || 'UNKNOWN_ACTION',
      resource: entry.resource || 'SYSTEM',
      resourceId: String(entry.resourceId || ''),
      details: entry.details || {},
      ipAddress,
      userAgent
    });
  } catch (err) {
    // Audit logging is resilient and shouldn't crash the main operation, but log the error
    console.error('[AuditService Error] Failed to write audit log:', err.message);
  }
}

module.exports = {
  recordAudit
};
