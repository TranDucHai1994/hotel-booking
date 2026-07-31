/**
 * systemSettingsService.js
 * Mục đích: Cung cấp hàm đọc/ghi các cấu hình hệ thống được lưu dưới dạng
 * cặp key-value trong bảng SystemSettings (ví dụ email người gửi), dùng
 * chung cho các service và controller khác.
 */
const { query } = require('../config/db');

const SYSTEM_SETTING_KEYS = {
  EMAIL_SENDER: 'email_sender',
};

async function getSettingValue(key, fallback = '') {
  const result = await query(
    `
      SELECT TOP 1 [value]
      FROM dbo.SystemSettings
      WHERE [key] = @key;
    `,
    { key: String(key || '').trim() }
  );

  const value = result.recordset[0]?.value;
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return String(value);
}

// Dùng MERGE (vừa UPDATE nếu key đã tồn tại, vừa INSERT nếu chưa có) thay vì viết 2 bước
// riêng (SELECT kiểm tra tồn tại rồi mới quyết định UPDATE hay INSERT). Gộp thành 1 câu lệnh
// giúp tránh race condition: nếu 2 request ghi cùng lúc, tách 2 bước có thể dẫn tới cả hai
// cùng thấy "chưa tồn tại" rồi cùng INSERT, gây lỗi trùng khóa chính.
async function upsertSettingValue(key, value) {
  await query(
    `
      MERGE dbo.SystemSettings AS target
      USING (SELECT @key AS [key], @value AS [value]) AS source
      ON target.[key] = source.[key]
      WHEN MATCHED THEN
        UPDATE SET [value] = source.[value], updated_at = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN
        INSERT ([key], [value], updated_at) VALUES (source.[key], source.[value], SYSUTCDATETIME());
    `,
    {
      key: String(key || '').trim(),
      value: String(value || '').trim(),
    }
  );
}

module.exports = {
  SYSTEM_SETTING_KEYS,
  getSettingValue,
  upsertSettingValue,
};
