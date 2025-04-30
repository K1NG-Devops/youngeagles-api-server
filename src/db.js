import mysql from 'mysql2/promise';
import dotenv from 'dotenv'; 

dotenv.config();

const pool = mysql.createPool({
  host: process.env.MARIADB_HOST,
  user: process.env.MARIADB_USER || process.env.MARIADB_USERNAME,
  password: process.env.MARIADB_PASSWORD,
  database: process.env.MARIADB_DATABASE,
  port: process.env.MARIADB_PORT || 3306,
});

export default pool;