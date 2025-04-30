import mysql from 'mysql2/promise'; // Import mysql2/promise for promise-based MySQL queries
// import dotenv from 'dotenv'; // Import dotenv to load environment variables

const pool = mysql.createPool({
  host: process.env.MARIADB_HOST,
  user: process.env.MARIADB_USER || process.env.MARIADB_USERNAME,
  password: process.env.MARIADB_PASSWORD,
  database: process.env.MARIADB_DATABASE,
  port: process.env.MARIADB_PORT || 3306,
});

export default pool; // Export the connection pool for use in other modules