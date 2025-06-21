import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const runMigration = async () => {
  console.log('🚀 Starting className migration...');
  
  // Create connection pool
  const pool = mysql.createPool({
    host: process.env.SKYDEK_DB_HOST || 'localhost',
    port: process.env.SKYDEK_DB_PORT || 3306,
    user: process.env.SKYDEK_DB_USER,
    password: process.env.SKYDEK_DB_PASSWORD,
    database: process.env.SKYDEK_DB_NAME || 'skydek_DB',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Creating connection pool for skydek_DB database');

    // Check if className column exists
    console.log('📊 Checking staff table for className column...');
    const [columns] = await pool.query('SHOW COLUMNS FROM staff LIKE ?', ['className']);
    
    if (columns.length === 0) {
      console.log('➕ Adding className column to staff table...');
      await pool.query('ALTER TABLE staff ADD COLUMN className VARCHAR(50) DEFAULT NULL');
      console.log('✅ className column added successfully');
      
      // Add index for faster lookups
      console.log('📊 Adding index on className column...');
      await pool.query('ALTER TABLE staff ADD INDEX idx_className (className)');
      console.log('✅ Index added successfully');
    } else {
      console.log('ℹ️  className column already exists in staff table');
    }

    console.log('🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Error during migration:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

runMigration();
