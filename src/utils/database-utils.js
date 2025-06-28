import mysql from 'mysql2/promise';

/**
 * Database configuration and initialization utilities
 */

// Database configuration - SECURE FOR PRODUCTION
export function createDbConfig() {
  return {
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
}

// Validate required database environment variables
export function validateDbEnvironment() {
  const requiredDbVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  const missingDbVars = requiredDbVars.filter(varName => !process.env[varName]);

  if (missingDbVars.length > 0) {
    console.error('❌ Missing required database environment variables:', missingDbVars);
    console.error('🚨 Please set the following environment variables:');
    missingDbVars.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    console.error('🚨 For production, ensure all credentials are set via environment variables');
    process.exit(1);
  }
}

// Initialize database connection
export async function initDatabase() {
  try {
    console.log('🔌 Connecting to database...');
    const dbConfig = createDbConfig();
    const db = mysql.createPool(dbConfig);
    
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
    return { db, connected: true };
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return { db: null, connected: false };
  }
}

// Database helper functions with fallback protection
export async function findUserByEmail(db, email, role = null) {
  try {
    if (!db) {
      console.log('⚠️ Database not available for user lookup');
      return null;
    }
    
    let query = 'SELECT * FROM users WHERE email = ?';
    let params = [email];
    
    if (role) {
      query += ' AND role = ?';
      params.push(role);
    }
    
    const [rows] = await db.execute(query, params);
    return rows[0] || null;
  } catch (error) {
    console.error('❌ Database query error:', error);
    return null;
  }
}

export async function findStaffByEmail(db, email) {
  try {
    if (!db) {
      console.log('⚠️ Database not available for staff lookup');
      return null;
    }
    
    const [rows] = await db.execute('SELECT * FROM staff WHERE email = ?', [email]);
    return rows[0] || null;
  } catch (error) {
    console.error('❌ Database query error:', error);
    return null;
  }
}
