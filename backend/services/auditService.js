const AuditLog = require('../models/AuditLog');

async function logAudit({ userId = null, action, entity, entityId = null }) {
  try {
    await AuditLog.create({
      user_id: userId || null,
      action,
      entity,
      entity_id: entityId ? String(entityId) : null,
    });
  } catch {
    // Do not block main flows if audit logging fails
  }
}

module.exports = { logAudit };

