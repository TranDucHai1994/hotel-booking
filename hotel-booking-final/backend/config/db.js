/**
 * config/db.js
 * Mục đích: Module trung tâm quản lý kết nối SQL Server cho toàn bộ backend.
 * Tự động tạo Database và Schema (bảng, khóa ngoại, index) nếu chưa tồn tại,
 * quản lý connection pool dạng singleton, đồng thời cung cấp các hàm query()
 * và withTransaction() dùng chung cho các module khác.
 */
const sql = require('mssql');

const DEFAULT_DATABASE = process.env.SQL_DATABASE || 'HotelBooking';
const DEFAULT_SERVER = process.env.SQL_SERVER || '127.0.0.1';
const DEFAULT_PORT = process.env.SQL_PORT ? Number(process.env.SQL_PORT) : undefined;
const DEFAULT_INSTANCE = process.env.SQL_INSTANCE || undefined;
const DEFAULT_USER = process.env.SQL_USER || 'sa';
const DEFAULT_PASSWORD = process.env.SQL_PASSWORD || '123';

let poolPromise = null;

/**
 * Hàm lấy cấu hình kết nối SQL Server dựa trên biến môi trường (.env)
 * Thiết lập các thông số như user, password, server, port và timeout.
 */
function getSqlConfig(database = DEFAULT_DATABASE) {
  return {
    user: DEFAULT_USER,
    password: DEFAULT_PASSWORD,
    server: DEFAULT_SERVER,
    // Named SQL Server instances (e.g. SQL1, SQL2...) use a dynamic TCP port that
    // can change after every service restart. When SQL_PORT isn't pinned explicitly,
    // resolve the instance by name through SQL Browser instead of a fixed port.
    ...(DEFAULT_PORT ? { port: DEFAULT_PORT } : {}),
    database,
    options: {
      encrypt: String(process.env.SQL_ENCRYPT || 'false').toLowerCase() === 'true',
      trustServerCertificate: String(process.env.SQL_TRUST_SERVER_CERTIFICATE || 'true').toLowerCase() !== 'false',
      enableArithAbort: true,
      ...(!DEFAULT_PORT && DEFAULT_INSTANCE ? { instanceName: DEFAULT_INSTANCE } : {}),
    },
    pool: {
      max: Number(process.env.SQL_POOL_MAX || 10),
      min: 0,
      idleTimeoutMillis: 30000,
    },
    connectionTimeout: Number(process.env.SQL_CONNECTION_TIMEOUT || 15000),
    requestTimeout: Number(process.env.SQL_REQUEST_TIMEOUT || 30000),
  };
}

function escapeIdentifier(value) {
  return String(value || '').replace(/]/g, ']]');
}

/**
 * Hàm trả về danh sách các câu lệnh SQL để tạo cấu trúc cơ sở dữ liệu (Tables, Foreign Keys, Indexes).
 * Sẽ được chạy khi khởi động app lần đầu nếu database chưa có sẵn các bảng này.
 */
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

/**
 * Hàm đảm bảo Database và Cấu trúc bảng (Schema) đã được tạo sẵn.
 * 1. Dùng Database 'master' để kiểm tra và tạo Database chính nếu chưa tồn tại.
 * 2. Kết nối vào Database chính và chạy từng lệnh CREATE TABLE/INDEX.
 */
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

/**
 * Khởi tạo pool kết nối đến SQL Server.
 * Sử dụng pattern Singleton qua poolPromise để tránh tạo nhiều connection pool.
 */
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

/**
 * Hàm tiện ích để thực thi một câu query an toàn với các tham số.
 * @param {string} text - Câu lệnh SQL (VD: SELECT * FROM Users WHERE id = @id)
 * @param {object} params - Object chứa các biến số (VD: { id: 1 })
 */
async function query(text, params = {}, options = {}) {
  const request = options.transaction
    ? new sql.Request(options.transaction)
    : (await getPool()).request();

  Object.entries(params).forEach(([key, value]) => {
    request.input(key, value);
  });

  return request.query(text);
}

/**
 * Hàm bọc một chuỗi thao tác CSDL trong một Giao dịch (Transaction).
 * Nếu thao tác nào bị lỗi, toàn bộ thay đổi sẽ được Rollback (hoàn tác) để bảo toàn tính toàn vẹn dữ liệu.
 */
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
  getSchemaStatements,
  query,
  sql,
  withTransaction,
};
