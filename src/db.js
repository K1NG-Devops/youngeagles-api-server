import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { Sequelize } from 'sequelize';

dotenv.config();

const poolCache = {}; // Cache pools by db name

const dbConfigs = {
  skydek_DB: {
    host: process.env.SKYDEK_DB_HOST,
    user: process.env.SKYDEK_DB_USER,
    password: process.env.SKYDEK_DB_PASSWORD,
    database: process.env.SKYDEK_DB_NAME,
    port: Number(process.env.SKYDEK_DB_PORT) || 3306,
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

export const sequelize = new Sequelize(
  process.env.SKYDEK_DB_NAME,
  process.env.SKYDEK_DB_USER,
  process.env.SKYDEK_DB_PASSWORD,
  {
    host: process.env.SKYDEK_DB_HOST,
    dialect: 'mysql',
    port: Number(process.env.SKYDEK_DB_PORT) || 3306,
    logging: false,
  }
);
export default sequelize;
