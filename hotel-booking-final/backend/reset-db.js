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

async function resetDatabase() {
  const masterPool = await new sql.ConnectionPool(getSqlConfig('master')).connect();
  
  try {
    // Close all connections to the database
    await masterPool.request().batch(`
      IF DB_ID(N'${DEFAULT_DATABASE}') IS NOT NULL
      BEGIN
        ALTER DATABASE [${DEFAULT_DATABASE}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
        DROP DATABASE [${DEFAULT_DATABASE}];
      END;
    `);
    console.log(`Database ${DEFAULT_DATABASE} dropped successfully.`);
  } catch (error) {
    console.error('Error dropping database:', error.message);
    throw error;
  } finally {
    await masterPool.close();
  }

  // Create the database again
  const masterPool2 = await new sql.ConnectionPool(getSqlConfig('master')).connect();
  try {
    await masterPool2.request().batch(`
      CREATE DATABASE [${DEFAULT_DATABASE}];
    `);
    console.log(`Database ${DEFAULT_DATABASE} created successfully.`);
  } finally {
    await masterPool2.close();
  }
}

async function main() {
  try {
    console.log('Resetting database...');
    await resetDatabase();
    console.log('Database reset completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Database reset failed:', error);
    process.exit(1);
  }
}

main();
