const { query } = require('../config/db');

async function logAudit({ userId = null, action, entity, entityId = null }) {
  try {
    await query(
      `
        INSERT INTO dbo.AuditLogs (user_id, action, entity, entity_id)
        VALUES (@userId, @action, @entity, @entityId);
      `,
      {
        userId: userId || null,
        action,
        entity,
        entityId: entityId ? String(entityId) : null,
      }
    );
  } catch {
    // Do not block the main flow if audit logging fails.
  }
}

module.exports = { logAudit };
