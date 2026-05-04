const sql = require('mssql');

const DEFAULT_DATABASE = process.env.SQL_DATABASE || 'HotelBooking';
const DEFAULT_SERVER = process.env.SQL_SERVER || '127.0.0.1';
const DEFAULT_PORT = Number(process.env.SQL_PORT || 58720);
const DEFAULT_USER = process.env.SQL_USER || 'sa';
const DEFAULT_PASSWORD = process.env.SQL_PASSWORD || '123';

let poolPromise = null;

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

function escapeIdentifier(value) {
  return String(value || '').replace(/]/g, ']]');
}

function getSchemaStatements() {
  return [
    // Users table
    `IF OBJECT_ID(N'dbo.Users', N'U') IS NULL CREATE TABLE dbo.Users (
      id INT IDENTITY(1,1) PRIMARY KEY,
      username NVARCHAR(100) NULL,
      role NVARCHAR(20) NOT NULL DEFAULT N'customer',
      status NVARCHAR(20) NOT NULL DEFAULT N'active',
      deleted_at DATETIME2 NULL,
      failed_attempts INT NOT NULL DEFAULT 0,
      last_login DATETIME2 NULL,
      full_name NVARCHAR(150) NOT NULL,
      email NVARCHAR(255) NOT NULL,
      phone NVARCHAR(30) NOT NULL DEFAULT N'',
      password_hash NVARCHAR(255) NOT NULL,
      refresh_token_hash NVARCHAR(255) NULL,
      refresh_token_expiry DATETIME2 NULL,
      reset_password_token_hash NVARCHAR(255) NULL,
      reset_password_expiry DATETIME2 NULL,
      created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )`,
    
    // Hotels table
    `IF OBJECT_ID(N'dbo.Hotels', N'U') IS NULL CREATE TABLE dbo.Hotels (
      id INT IDENTITY(1,1) PRIMARY KEY,
      name NVARCHAR(200) NOT NULL,
      city NVARCHAR(120) NOT NULL DEFAULT N'',
      address NVARCHAR(255) NOT NULL DEFAULT N'',
      description NVARCHAR(MAX) NOT NULL DEFAULT N'',
      property_type NVARCHAR(30) NOT NULL DEFAULT N'hotel',
      star_rating INT NOT NULL DEFAULT 0,
      is_hot_deal BIT NOT NULL DEFAULT 0,
      hot_deal_discount_percent INT NOT NULL DEFAULT 0,
      amenities NVARCHAR(MAX) NOT NULL DEFAULT N'[]',
      cover_image NVARCHAR(MAX) NOT NULL DEFAULT N'',
      images NVARCHAR(MAX) NOT NULL DEFAULT N'[]',
      created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )`,
    
    // Rooms table without FK constraint in CREATE TABLE
    `IF OBJECT_ID(N'dbo.Rooms', N'U') IS NULL CREATE TABLE dbo.Rooms (
      id INT IDENTITY(1,1) PRIMARY KEY,
      hotel_id INT NOT NULL,
      room_type NVARCHAR(150) NOT NULL,
      max_guests INT NOT NULL DEFAULT 2,
      price_per_night DECIMAL(18,2) NOT NULL,
      total_quantity INT NOT NULL DEFAULT 1,
      status NVARCHAR(20) NOT NULL DEFAULT N'available',
      description NVARCHAR(MAX) NOT NULL DEFAULT N'',
      amenities NVARCHAR(MAX) NOT NULL DEFAULT N'[]',
      created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )`,
    
    // Add FK constraint to Rooms table
    `IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Rooms_Hotels')
    BEGIN
      ALTER TABLE dbo.Rooms ADD CONSTRAINT FK_Rooms_Hotels FOREIGN KEY (hotel_id) REFERENCES dbo.Hotels(id) ON DELETE CASCADE
    END`,
    
    // Bookings table without FK constraints in CREATE TABLE
    `IF OBJECT_ID(N'dbo.Bookings', N'U') IS NULL CREATE TABLE dbo.Bookings (
      id INT IDENTITY(1,1) PRIMARY KEY,
      user_id INT NULL,
      hotel_id INT NOT NULL,
      room_id INT NOT NULL,
      guest_name NVARCHAR(150) NOT NULL DEFAULT N'',
      guest_email NVARCHAR(255) NOT NULL DEFAULT N'',
      guest_phone NVARCHAR(30) NOT NULL DEFAULT N'',
      booking_source NVARCHAR(20) NOT NULL DEFAULT N'account',
      check_in DATE NOT NULL,
      check_out DATE NOT NULL,
      guests INT NOT NULL DEFAULT 1,
      total_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      status NVARCHAR(20) NOT NULL DEFAULT N'pending',
      payment_method NVARCHAR(30) NOT NULL DEFAULT N'pay_at_hotel',
      payment_status NVARCHAR(20) NOT NULL DEFAULT N'unpaid',
      customer_note NVARCHAR(MAX) NOT NULL DEFAULT N'',
      created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )`,
    
    // Add FK constraints to Bookings table
    `IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Bookings_Users')
    BEGIN
      ALTER TABLE dbo.Bookings ADD CONSTRAINT FK_Bookings_Users FOREIGN KEY (user_id) REFERENCES dbo.Users(id) ON DELETE SET NULL
    END`,
    
    `IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Bookings_Hotels')
    BEGIN
      ALTER TABLE dbo.Bookings ADD CONSTRAINT FK_Bookings_Hotels FOREIGN KEY (hotel_id) REFERENCES dbo.Hotels(id) ON DELETE CASCADE
    END`,
    
    `IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Bookings_Rooms')
    BEGIN
      ALTER TABLE dbo.Bookings ADD CONSTRAINT FK_Bookings_Rooms FOREIGN KEY (room_id) REFERENCES dbo.Rooms(id) ON DELETE NO ACTION
    END`,
    
    // Feedbacks table without FK constraints in CREATE TABLE
    `IF OBJECT_ID(N'dbo.Feedbacks', N'U') IS NULL CREATE TABLE dbo.Feedbacks (
      id INT IDENTITY(1,1) PRIMARY KEY,
      user_id INT NOT NULL,
      hotel_id INT NOT NULL,
      rating INT NOT NULL,
      content NVARCHAR(MAX) NOT NULL DEFAULT N'',
      created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )`,
    
    // Add FK constraints to Feedbacks table
    `IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Feedbacks_Users')
    BEGIN
      ALTER TABLE dbo.Feedbacks ADD CONSTRAINT FK_Feedbacks_Users FOREIGN KEY (user_id) REFERENCES dbo.Users(id) ON DELETE CASCADE
    END`,
    
    `IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Feedbacks_Hotels')
    BEGIN
      ALTER TABLE dbo.Feedbacks ADD CONSTRAINT FK_Feedbacks_Hotels FOREIGN KEY (hotel_id) REFERENCES dbo.Hotels(id) ON DELETE CASCADE
    END`,
    
    // AuditLogs table without FK constraint in CREATE TABLE
    `IF OBJECT_ID(N'dbo.AuditLogs', N'U') IS NULL CREATE TABLE dbo.AuditLogs (
      id INT IDENTITY(1,1) PRIMARY KEY,
      user_id INT NULL,
      action NVARCHAR(100) NOT NULL,
      entity NVARCHAR(50) NOT NULL,
      entity_id NVARCHAR(50) NULL,
      [timestamp] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )`,

    // System settings table
    `IF OBJECT_ID(N'dbo.SystemSettings', N'U') IS NULL CREATE TABLE dbo.SystemSettings (
      [key] NVARCHAR(100) NOT NULL PRIMARY KEY,
      [value] NVARCHAR(MAX) NOT NULL DEFAULT N'',
      updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )`,
    
    // Add FK constraint to AuditLogs table
    `IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_AuditLogs_Users')
    BEGIN
      ALTER TABLE dbo.AuditLogs ADD CONSTRAINT FK_AuditLogs_Users FOREIGN KEY (user_id) REFERENCES dbo.Users(id) ON DELETE SET NULL
    END`,
    
    // Create indexes
    `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UQ_Users_Email' AND object_id = OBJECT_ID(N'dbo.Users'))
    CREATE UNIQUE INDEX UQ_Users_Email ON dbo.Users(email)`,
    
    `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UQ_Users_Username' AND object_id = OBJECT_ID(N'dbo.Users'))
    CREATE UNIQUE INDEX UQ_Users_Username ON dbo.Users(username) WHERE username IS NOT NULL`,
    
    `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UQ_Rooms_HotelRoomType' AND object_id = OBJECT_ID(N'dbo.Rooms'))
    CREATE UNIQUE INDEX UQ_Rooms_HotelRoomType ON dbo.Rooms(hotel_id, room_type)`,
    
    `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Rooms_HotelId' AND object_id = OBJECT_ID(N'dbo.Rooms'))
    CREATE INDEX IX_Rooms_HotelId ON dbo.Rooms(hotel_id)`,
    
    `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Bookings_RoomDateStatus' AND object_id = OBJECT_ID(N'dbo.Bookings'))
    CREATE INDEX IX_Bookings_RoomDateStatus ON dbo.Bookings(room_id, check_in, check_out, status)`,
    
    `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Bookings_UserCreatedAt' AND object_id = OBJECT_ID(N'dbo.Bookings'))
    CREATE INDEX IX_Bookings_UserCreatedAt ON dbo.Bookings(user_id, created_at DESC)`,
    
    `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UQ_Feedbacks_UserHotel' AND object_id = OBJECT_ID(N'dbo.Feedbacks'))
    CREATE UNIQUE INDEX UQ_Feedbacks_UserHotel ON dbo.Feedbacks(user_id, hotel_id)`,
    
    `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Feedbacks_HotelId' AND object_id = OBJECT_ID(N'dbo.Feedbacks'))
    CREATE INDEX IX_Feedbacks_HotelId ON dbo.Feedbacks(hotel_id)`
  ];
}

async function ensureDatabaseAndSchema() {
  const safeDatabase = escapeIdentifier(DEFAULT_DATABASE);
  const masterPool = await new sql.ConnectionPool(getSqlConfig('master')).connect();

  try {
    await masterPool.request().batch(`
      IF DB_ID(N'${safeDatabase}') IS NULL
      BEGIN
        CREATE DATABASE [${safeDatabase}];
      END;
    `);
    console.log(`Database ${DEFAULT_DATABASE} ensured.`);
  } finally {
    await masterPool.close();
  }

  const appPool = await new sql.ConnectionPool(getSqlConfig(DEFAULT_DATABASE)).connect();
  try {
    // Execute schema statements one by one
    const statements = getSchemaStatements();
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`Executing statement ${i + 1}/${statements.length}...`);
          await appPool.request().batch(statement);
          console.log(`Statement ${i + 1} completed successfully.`);
        } catch (err) {
          // Ignore "already exists" errors for indexes
          if (!err.message.includes('already exists')) {
            console.error(`Statement ${i + 1} failed with error:`, err.message);
            throw err;
          }
          console.log(`Skipped duplicate index at statement ${i + 1}.`);
        }
      }
    }
    
    console.log(`Schema initialized successfully.`);
  } catch (err) {
    console.error('Schema initialization error:', err.message);
    throw err;
  } finally {
    await appPool.close();
  }
}

async function connectDB() {
  if (!poolPromise) {
    poolPromise = (async () => {
      await ensureDatabaseAndSchema();
      const pool = await new sql.ConnectionPool(getSqlConfig(DEFAULT_DATABASE)).connect();
      console.log(`SQL Server connected: ${DEFAULT_SERVER}:${DEFAULT_PORT}/${DEFAULT_DATABASE}`);
      return pool;
    })().catch((error) => {
      poolPromise = null;
      throw error;
    });
  }

  return poolPromise;
}

async function getPool() {
  return connectDB();
}

async function query(text, params = {}, options = {}) {
  const request = options.transaction
    ? new sql.Request(options.transaction)
    : (await getPool()).request();

  Object.entries(params).forEach(([key, value]) => {
    request.input(key, value);
  });

  return request.query(text);
}

async function withTransaction(handler) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const result = await handler(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    try {
      await transaction.rollback();
    } catch {
      // Ignore rollback failures to preserve the original error.
    }
    throw error;
  }
}

module.exports = {
  connectDB,
  getPool,
  query,
  sql,
  withTransaction,
};
