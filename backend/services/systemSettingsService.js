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
