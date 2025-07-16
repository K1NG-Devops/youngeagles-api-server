const express = require('express');
const mysql = require('mysql2/promise');
const app = express();

// Create connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'youngeagles',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Debug endpoint to check push_subscriptions table schema
app.get('/debug/schema', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        // Check if table exists
        const [tables] = await connection.execute(
            "SHOW TABLES LIKE 'push_subscriptions'"
        );
        
        if (tables.length === 0) {
            connection.release();
            return res.json({
                error: 'push_subscriptions table does not exist',
                tables: tables
            });
        }
        
        // Get table structure
        const [columns] = await connection.execute(
            "DESCRIBE push_subscriptions"
        );
        
        // Check specific column existence
        const [userIdColumn] = await connection.execute(
            `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
             FROM INFORMATION_SCHEMA.COLUMNS 
             WHERE TABLE_SCHEMA = DATABASE() 
             AND TABLE_NAME = 'push_subscriptions' 
             AND COLUMN_NAME = 'userId'`
        );
        
        connection.release();
        
        res.json({
            success: true,
            tableExists: true,
            columns: columns,
            userIdColumn: userIdColumn.length > 0 ? userIdColumn[0] : null,
            hasUserId: userIdColumn.length > 0
        });
        
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({
            error: 'Database connection failed',
            message: error.message
        });
    }
});

// Debug endpoint to show all tables
app.get('/debug/tables', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [tables] = await connection.execute("SHOW TABLES");
        connection.release();
        
        res.json({
            success: true,
            tables: tables
        });
        
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({
            error: 'Database connection failed',
            message: error.message
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Debug server running on port ${PORT}`);
    console.log('Available endpoints:');
    console.log('- GET /debug/schema - Check push_subscriptions table schema');
    console.log('- GET /debug/tables - List all database tables');
});
