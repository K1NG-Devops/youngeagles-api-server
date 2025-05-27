import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Create a function to create a pool dynamically base on the environment
const getPool = (db = 'skydek_DB') => {
  const config = {
    skydek_DB: {
      host: process.env.MYSQLHOST,
      user: process.env.MYSQLUSER,
      password: process.env.MYSQLPASSWORD,
      database: process.env.MYSQLDATABASE,
      port: Number(process.env.MYSQLPORT) || 3306,
    },
    railway: {
      host: process.env.RAILWAY_HOST,
      user: process.env.RAILWAY_USER,
      password: process.env.RAILWAY_PASSWORD,
      database: process.env.RAILWAY_DATABASE,
      port: Number(process.env.RAILWAY_PORT) || 3306,
    },
    // local: {
    //   host: process.env.DB_HOST,
    // user: process.env.DB_USER,
    // password: process.env.DB_PASSWORD,
    // database: process.env.DB_NAME,
    // },
  };
  const selectedConfig = config[db] || config.skydek_DB;
  return mysql.createPool({
    ...selectedConfig,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: {
      rejectUnauthorized: false,
    },
    connectTimeout: 10000,
  });
};

// Test DB connection for all environments
export const testAllConnections = async () => {
  const dbs = ['skydek_DB', 'railway'];
  for (const db of dbs) {
    try {
      const pool = getPool(db);
      const connection = await pool.getConnection();
      const [rows] = await connection.query('SELECT DATABASE() AS db');
      console.log(`✅ Connected to ${db} database: ${rows[0].db}`);
      connection.release();
      await pool.end();
    } catch (error) {
      console.error(`❌ Error connecting to the ${db} database:`, error);
    }
  }
};

// Gracefully close the pool (if needed in shutdown scripts)
export const close = async () => {
  try {
    const pool = getPool(); // Ensure the pool is created before attempting to close it
    await pool.end();
    console.log('✅ Database connection pool closed');
  } catch (error) {
    console.error('❌ Error closing database pool:', error);
  }
};

// General SELECT or query
// General SELECT or query
export const query = async (sql, params = [], db = 'skydek_DB') => {
  const pool = getPool(db);
  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (error) {
    console.error(`❌ Error executing query on ${db} database:`, error);
    throw error;
  }
};

// INSERT, UPDATE, DELETE with better metadata
export const execute = async (sql, params, db = 'skydek_DB') => {
  const pool = getPool(db);
  try {
    const [result] = await pool.execute(sql, params);
    return result;
  } catch (error) {
    console.error(`❌ Error executing statement on ${db} database:`, error);
    throw error;
  }
};


// Full transaction with internal connection
export const transaction = async (queries, db = 'skydek_DB') => {
  const pool = getPool(db);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const query of queries) {
      await connection.query(query.sql, query.params);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    console.error(`❌ Error executing transaction on ${db} database:`, error);
    throw error;
  } finally {
    connection.release();
  }
};