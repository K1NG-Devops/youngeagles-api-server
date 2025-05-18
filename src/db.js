import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE, 
  port: Number(process.env.MYSQLPORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl:{
    rejectUnauthorized: false,
  },
  connectTimeout: 10000,
});

export default pool;

// Test DB connection
export const connect = async () => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT DATABASE() AS db');
    console.log(`✅ Connected to database: ${rows[0].db}`);
    connection.release();
  } catch (error) {
    console.error('❌ Error connecting to the database:', error);
  }
};

// Gracefully close the pool (if needed in shutdown scripts)
export const close = async () => {
  try {
    await pool.end();
    console.log('✅ Database connection pool closed');
  } catch (error) {
    console.error('❌ Error closing database pool:', error);
  }
};

// General SELECT or query
export const query = async (sql, params) => {
  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (error) {
    console.error('❌ Error executing query:', error);
    throw error;
  }
};

// INSERT, UPDATE, DELETE with better metadata
export const execute = async (sql, params) => {
  try {
    const [result] = await pool.execute(sql, params);
    return result;
  } catch (error) {
    console.error('❌ Error executing statement:', error);
    throw error;
  }
};


// Full transaction with internal connection
export const transaction = async (queries) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const query of queries) {
      await connection.query(query.sql, query.params);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error executing transaction:', error);
    throw error;
  } finally {
    connection.release();
  }
};

// export const connect = async () => {
//   try {
//     const connection = await pool.getConnection();
//     console.log('Connected to the database');
//     connection.release();
//   } catch (error) {
//     console.error('Error connecting to the database:', error);
//   }
// };
// export const close = async () => {
//   try {
//     await pool.end();
//     console.log('Database connection closed');
//   } catch (error) {
//     console.error('Error closing the database connection:', error);
//   }
// };
// export const query = async (sql, params) => {
//   try {
//     const [rows] = await pool.query(sql, params);
//     return rows;
//   } catch (error) {
//     console.error('Error executing query:', error);
//     throw error;
//   }
// };
// export const execute = async (sql, params) => {
//   try {
//     const [result] = await pool.execute(sql, params);
//     return result;
//   } catch (error) {
//     console.error('Error executing query:', error);
//     throw error;
//   }
// };
// export const transaction = async (queries) => {
//   const connection = await pool.getConnection();
//   try {
//     await connection.beginTransaction();
//     for (const query of queries) {
//       await connection.query(query.sql, query.params);
//     }
//     await connection.commit();
//   } catch (error) {
//     await connection.rollback();
//     console.error('Error executing transaction:', error);
//     throw error;
//   } finally {
//     connection.release();
//   }
// };
// export const transactionWithConnection = async (queries, connection) => {
//   try {
//     await connection.beginTransaction();
//     for (const query of queries) {
//       await connection.query(query.sql, query.params);
//     }
//     await connection.commit();
//   } catch (error) {
//     await connection.rollback();
//     console.error('Error executing transaction:', error);
//     throw error;
//   }
// };
// export const transactionWithConnectionAndRelease = async (queries, connection) => {
//   try {
//     await connection.beginTransaction();
//     for (const query of queries) {
//       await connection.query(query.sql, query.params);
//     }
//     await connection.commit();
//   } catch (error) {
//     await connection.rollback();
//     console.error('Error executing transaction:', error);
//     throw error;
//   } finally {
//     connection.release();
//   }
// };
// export const transactionWithConnectionAndReleaseAndError = async (queries, connection) => {
//   try {
//     await connection.beginTransaction();
//     for (const query of queries) {
//       await connection.query(query.sql, query.params);
//     }
//     await connection.commit();
//   } catch (error) {
//     await connection.rollback();
//     console.error('Error executing transaction:', error);
//     throw error;
//   } finally {
//     connection.release();
//   }
// };