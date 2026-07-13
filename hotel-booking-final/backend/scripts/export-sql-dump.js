require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { connectDB, query, getPool } = require('../config/db');
const { getSchemaStatements } = require('../config/db');

const OUTPUT_PATH = path.join(__dirname, '..', '..', 'database', 'hotel_booking_full.sql');
const DATABASE_NAME = process.env.SQL_DATABASE || 'HotelBooking';
const ROWS_PER_INSERT = 200;

// Bang can export du lieu, theo dung thu tu de khong vi pham khoa ngoai (FK).
// AuditLogs khong export vi chi la log thao tac trong qua trinh dev, khong phai du lieu demo.
const TABLES = [
  { name: 'Users', identity: true },
  { name: 'Hotels', identity: true },
  { name: 'Rooms', identity: true },
  { name: 'Bookings', identity: true },
  { name: 'Feedbacks', identity: true },
  { name: 'SystemSettings', identity: false },
];

function formatValue(value) {
  if (value === null || value === undefined) return 'NULL';

  if (typeof value === 'boolean') return value ? '1' : '0';

  if (typeof value === 'number') return String(value);

  if (Buffer.isBuffer(value)) return `0x${value.toString('hex')}`;

  if (value instanceof Date) {
    const iso = value.toISOString(); // e.g. 2026-04-15T00:00:00.000Z
    const [datePart, timePart] = iso.split('T');
    const hasTime = timePart && timePart !== '00:00:00.000Z';
    if (!hasTime) return `'${datePart}'`;
    return `'${datePart} ${timePart.replace('Z', '')}'`;
  }

  // mssql driver can return DECIMAL columns as strings already
  return `N'${String(value).replace(/'/g, "''")}'`;
}

function buildInsertStatements(tableName, columns, rows) {
  if (!rows.length) return [`-- (khong co du lieu cho dbo.${tableName})\n`];

  const columnList = columns.map((c) => `[${c}]`).join(', ');
  const statements = [];

  for (let offset = 0; offset < rows.length; offset += ROWS_PER_INSERT) {
    const chunk = rows.slice(offset, offset + ROWS_PER_INSERT);
    const valuesSql = chunk
      .map((row) => `(${columns.map((c) => formatValue(row[c])).join(', ')})`)
      .join(',\n  ');

    statements.push(
      `INSERT INTO dbo.${tableName} (${columnList}) VALUES\n  ${valuesSql};\n`
    );
  }

  return statements;
}

async function exportTable(table) {
  const result = await query(`SELECT * FROM dbo.${table.name};`);
  const rows = result.recordset;
  const columns = result.recordset.columns ? Object.keys(result.recordset.columns) : Object.keys(rows[0] || {});

  const lines = [`\nPRINT N'Seeding dbo.${table.name} (${rows.length} rows)...';`];

  if (table.identity) {
    lines.push(`SET IDENTITY_INSERT dbo.${table.name} ON;`);
  }

  lines.push(...buildInsertStatements(table.name, columns, rows));

  if (table.identity) {
    lines.push(`SET IDENTITY_INSERT dbo.${table.name} OFF;`);
  }

  return lines.join('\n');
}

async function main() {
  await connectDB();

  const schemaStatements = getSchemaStatements();
  const schemaSql = schemaStatements.map((stmt) => `${stmt.trim()};`).join('\n\nGO\n\n');

  const header = `/*
 * Hotel Booking - Full database script (schema + du lieu mau)
 * Tu dong sinh boi backend/scripts/export-sql-dump.js
 * Sinh luc: ${new Date().toISOString()}
 *
 * Cach dung:
 *   1. Mo file nay bang SQL Server Management Studio (SSMS), hoac
 *   2. Chay qua sqlcmd, vi du:
 *      sqlcmd -S <server>\\<instance> -U sa -P <password> -i hotel_booking_full.sql
 *
 * Script se tu tao database "${DATABASE_NAME}" neu chua co, tao bang/index,
 * roi chen toan bo du lieu mau (tai khoan, khach san, phong, booking, feedback).
 */

IF DB_ID(N'${DATABASE_NAME}') IS NULL
BEGIN
  CREATE DATABASE [${DATABASE_NAME}];
END
GO

USE [${DATABASE_NAME}];
GO

-- Can bat truoc khi tao filtered index (vd UQ_Users_Username)
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

${schemaSql}
GO
`;

  const tableSections = [];
  for (const table of TABLES) {
    // eslint-disable-next-line no-await-in-loop
    const section = await exportTable(table);
    tableSections.push(section);
  }

  const footer = `\nPRINT N'Hoan tat import du lieu mau cho ${DATABASE_NAME}.';\nGO\n`;

  const fullScript = `${header}\n${tableSections.join('\n')}\n${footer}`;

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, fullScript, 'utf8');

  console.log(`Da xuat script tai: ${OUTPUT_PATH}`);
  console.log(`Kich thuoc: ${(fs.statSync(OUTPUT_PATH).size / 1024 / 1024).toFixed(2)} MB`);

  const pool = await getPool();
  await pool.close();
}

main().catch((error) => {
  console.error('Xuat script that bai:', error);
  process.exit(1);
});
