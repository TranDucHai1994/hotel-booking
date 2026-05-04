const sql = require('mssql');
require('dotenv').config();

const DEFAULT_DATABASE = process.env.SQL_DATABASE || 'HotelBooking';
const DEFAULT_SERVER = process.env.SQL_SERVER || '127.0.0.1';
const DEFAULT_PORT = Number(process.env.SQL_PORT || 58720);
const DEFAULT_USER = process.env.SQL_USER || 'sa';
const DEFAULT_PASSWORD = process.env.SQL_PASSWORD || '123';

function getSqlConfig(database = DEFAULT_DATABASE) {
  return {
    user: DEFAULT_USER,
    password: DEFAULT_PASSWORD,
    server: DEFAULT_SERVER,
    port: DEFAULT_PORT,
    database,
    options: {
      encrypt: String(process.env.SQL_ENCRYPT || 'false').toLowerCase() === 'true',
      trustServerCertificate: String(process.env.SQL_TRUST_SERVER_CERTIFICATE || 'true').toLowerCase() !== 'false',
      enableArithAbort: true,
    },
    pool: {
      max: Number(process.env.SQL_POOL_MAX || 10),
      min: 0,
      idleTimeoutMillis: 30000,
    },
    connectionTimeout: Number(process.env.SQL_CONNECTION_TIMEOUT || 15000),
    requestTimeout: Number(process.env.SQL_REQUEST_TIMEOUT || 15000),
  };
}

async function testSchema() {
  const pool = await new sql.ConnectionPool(getSqlConfig(DEFAULT_DATABASE)).connect();
  
  try {
    console.log('Testing schema statements...');
    
    // Test 1: Create Users table
    try {
      console.log('Test 1: Creating Users table...');
      await pool.request().batch(`
        IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
        CREATE TABLE dbo.Users (
          id INT IDENTITY(1,1) PRIMARY KEY,
          username NVARCHAR(100) NULL,
          email NVARCHAR(255) NOT NULL
        )
      `);
      console.log('✓ Users table created successfully');
    } catch (e) {
      console.error('✗ Users table failed:', e.message);
      return;
    }
    
    // Test 2: Create Hotels table
    try {
      console.log('Test 2: Creating Hotels table...');
      await pool.request().batch(`
        IF OBJECT_ID(N'dbo.Hotels', N'U') IS NULL
        CREATE TABLE dbo.Hotels (
          id INT IDENTITY(1,1) PRIMARY KEY,
          name NVARCHAR(200) NOT NULL
        )
      `);
      console.log('✓ Hotels table created successfully');
    } catch (e) {
      console.error('✗ Hotels table failed:', e.message);
      return;
    }
    
    // Test 3: Create Rooms table with FK
    try {
      console.log('Test 3: Creating Rooms table...');
      await pool.request().batch(`
        IF OBJECT_ID(N'dbo.Rooms', N'U') IS NULL
        CREATE TABLE dbo.Rooms (
          id INT IDENTITY(1,1) PRIMARY KEY,
          hotel_id INT NOT NULL,
          room_type NVARCHAR(150) NOT NULL,
          CONSTRAINT FK_Rooms_Hotels FOREIGN KEY (hotel_id) REFERENCES dbo.Hotels(id) ON DELETE CASCADE
        )
      `);
      console.log('✓ Rooms table created successfully');
    } catch (e) {
      console.error('✗ Rooms table failed:', e.message);
      return;
    }
    
    // Test 4: Create index
    try {
      console.log('Test 4: Creating index on Rooms...');
      await pool.request().batch(`
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UQ_Rooms_HotelRoomType' AND object_id = OBJECT_ID(N'dbo.Rooms'))
        CREATE UNIQUE INDEX UQ_Rooms_HotelRoomType ON dbo.Rooms(hotel_id, room_type)
      `);
      console.log('✓ Index created successfully');
    } catch (e) {
      console.error('✗ Index creation failed:', e.message);
      return;
    }
    
    console.log('\nAll schema tests passed!');
  } finally {
    await pool.close();
  }
}

testSchema().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
