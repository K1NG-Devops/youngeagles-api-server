import mysql from 'mysql2/promise'; // Import mysql2/promise for promise-based MySQL queries
// import dotenv from 'dotenv'; // Import dotenv to load environment variables

const pool = mysql.createPool({
    host: 'localhost', // Database host
    user: 'root', // Database user
    password: '#Olivia@17', // Database password
    database: 'skydek_auth', // Database name
    waitForConnections: true, // Wait for connections
    connectionLimit: 10, // Maximum number of connections
    queueLimit: 0, // No limit on the queue
});

export default pool; // Export the connection pool for use in other modules