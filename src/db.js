import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { Sequelize } from 'sequelize';

dotenv.config();

// Database configuration - SECURE FOR PRODUCTION
const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true',
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
  acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT) || 60000,
  timeout: parseInt(process.env.DB_TIMEOUT) || 60000,
  reconnect: true
};

let db;

// Initialize database connection
export async function initDatabase() {
  try {
    console.log('🔌 Connecting to database...');
    db = mysql.createPool(dbConfig);
    
    // Test connection
    const connection = await db.getConnection();
    console.log('✅ Database connected successfully!');
    
    // Secure logging - don't expose sensitive details in production
    const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;
    if (isProduction) {
      console.log(`📊 Connected to database: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
    } else {
      console.log(`📊 Connected to: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
    }
    
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

// Export the database pool for use by other modules
export { db };

// Legacy support for existing code
const poolCache = {}; // Cache pools by db name

const dbConfigs = {
  skydek_DB: {
    host: process.env.SKYDEK_DB_HOST || process.env.DB_HOST,
    user: process.env.SKYDEK_DB_USER || process.env.DB_USER,
    password: process.env.SKYDEK_DB_PASSWORD || process.env.DB_PASSWORD,
    database: process.env.SKYDEK_DB_NAME || process.env.DB_NAME,
    port: Number(process.env.SKYDEK_DB_PORT || process.env.DB_PORT) || 3306,
  }
};

const getPool = (db = 'skydek_DB') => {
  if (!poolCache[db]) {
    const selectedConfig = dbConfigs[db] || dbConfigs.skydek_DB;
    
    // Connection options
    const connectionOptions = {
      ...selectedConfig,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 10000,
    };
    
    // Always use SSL
    connectionOptions.ssl = { rejectUnauthorized: false };
    
    poolCache[db] = mysql.createPool(connectionOptions);
    
    console.log(`🔌 Creating connection pool for ${db} database`);
  }
  return poolCache[db];
};

export const testAllConnections = async () => {
    try {
    const pool = getPool('skydek_DB');
      const connection = await pool.getConnection();
      const [rows] = await connection.query('SELECT DATABASE() AS db');
    console.log(`✅ Connected to skydek_DB database: ${rows[0].db}`);
      connection.release();
    } catch (error) {
    console.error(`❌ Error connecting to the skydek_DB database:`, error);
  }
};

// Close all cached pools
export const close = async () => {
  for (const db in poolCache) {
    try {
      await poolCache[db].end();
      console.log(`✅ Closed pool for ${db}`);
    } catch (error) {
      console.error(`❌ Error closing pool for ${db}:`, error);
    }
  }
};

export const query = async (sql, params = [], dbName = 'skydek_DB') => {
  const pool = getPool(dbName);
  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (error) {
    console.error(`❌ Error executing query on ${dbName} database:`, error);
    throw error;
  }
};

export const execute = async (sql, params, dbName = 'skydek_DB') => {
  const pool = getPool(dbName);
  try {
    const [result] = await pool.execute(sql, params);
    return result;
  } catch (error) {
    console.error(`❌ Error executing statement on ${dbName} database:`, error);
    throw error;
  }
};

export const transaction = async (queries, dbName = 'skydek_DB') => {
  const pool = getPool(dbName);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const query of queries) {
      await connection.query(query.sql, query.params);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    console.error(`❌ Error executing transaction on ${dbName} database:`, error);
    throw error;
  } finally {
    connection.release();
  }
};

export const sequelize = new Sequelize(
  process.env.SKYDEK_DB_NAME || process.env.DB_NAME,
  process.env.SKYDEK_DB_USER || process.env.DB_USER,
  process.env.SKYDEK_DB_PASSWORD || process.env.DB_PASSWORD,
  {
    host: process.env.SKYDEK_DB_HOST || process.env.DB_HOST,
    dialect: 'mysql',
    port: Number(process.env.SKYDEK_DB_PORT || process.env.DB_PORT) || 3306,
    logging: false,
  }
);
export default sequelize;
