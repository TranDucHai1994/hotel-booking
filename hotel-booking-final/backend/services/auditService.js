/**
 * auditService.js
 * Mục đích: Cung cấp hàm ghi nhật ký hoạt động (audit log) của người dùng
 * vào bảng AuditLogs trong cơ sở dữ liệu, phục vụ theo dõi và truy vết
 * thao tác quan trọng trong hệ thống. Lỗi ghi log không làm gián đoạn luồng chính.
 */
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
