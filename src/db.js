import mysql from 'mysql2/promise'; // Import mysql2/promise for promise-based MySQL queries
// import dotenv from 'dotenv'; // Import dotenv to load environment variables

const pool = mysql.createPool({
    host: process.env.RAILWAY_PRIVATE_DOMAIN,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.MYSQLPORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

export default pool; // Export the connection pool for use in other modules