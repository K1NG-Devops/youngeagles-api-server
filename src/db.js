import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || process.env.SKYDEK_DB_HOST,
  port: parseInt(process.env.DB_PORT || process.env.SKYDEK_DB_PORT) || 3306,
  user: process.env.DB_USER || process.env.SKYDEK_DB_USER,
  password: process.env.DB_PASSWORD || process.env.SKYDEK_DB_PASSWORD,
  database: process.env.DB_NAME || process.env.SKYDEK_DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false // Allow self-signed certificates
  } : false,
  connectionLimit: 10
};

let db;

// Initialize database connection
export async function initDatabase() {
  try {
    console.log('🔌 Connecting to database...');
    
    // Validate required environment variables
    const requiredVars = ['host', 'user', 'password', 'database'];
    const missingVars = requiredVars.filter(key => !dbConfig[key]);
    
    if (missingVars.length > 0) {
      console.error('❌ Missing database configuration:', missingVars);
      return false;
    }

    // Create connection pool
    db = mysql.createPool({
      ...dbConfig,
      waitForConnections: true,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    });
    
    // Test connection
    const connection = await db.getConnection();
    console.log('✅ Database connected successfully!');
    console.log(`📊 Connected to: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
    
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

// Export the database pool
export { db };

// Helper functions
export const query = async (sql, params = []) => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  try {
    const [rows] = await db.query(sql, params);
    return rows;
  } catch (error) {
    console.error('❌ Database query error:', error);
    throw error;
  }
};

export const execute = async (sql, params = []) => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  try {
    const [result] = await db.execute(sql, params);
    return result;
  } catch (error) {
    console.error('❌ Database execute error:', error);
    throw error;
  }
};

// Close database connection
export const close = async () => {
  if (db) {
    try {
      await db.end();
      console.log('✅ Database connection closed');
    } catch (error) {
      console.error('❌ Error closing database:', error);
    }
  }
}; 