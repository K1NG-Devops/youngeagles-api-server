import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Database configuration from index-local.js
const dbConfig = {
  host: 'shuttle.proxy.rlwy.net',
  port: 49263,
  user: 'root',
  password: 'fhdgRvbocRQKcikxGTNsQUHVIMizngLb',
  database: 'skydek_DB',
  ssl: false,
  connectionLimit: 10,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true
};

async function fixClassNames() {
  let connection;
  try {
    console.log('Starting class name fix...');
    
    // Create connection
    connection = await mysql.createConnection(dbConfig);

    // Update all "Panda Class" to "Panda"
    const [result] = await connection.execute(
      'UPDATE children SET className = ? WHERE className = ?',
      ['Panda', 'Panda Class']
    );

    console.log(`✅ Updated ${result.affectedRows} records from "Panda Class" to "Panda"`);
    
    // Verify the changes
    const [children] = await connection.execute(
      'SELECT id, name, className FROM children WHERE className IN (?, ?)',
      ['Panda', 'Panda Class']
    );

    console.log('\nCurrent children in Panda class:');
    children.forEach(child => {
      console.log(`- ${child.name} (ID: ${child.id}): ${child.className}`);
    });

  } catch (error) {
    console.error('Error fixing class names:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit(0);
  }
}

fixClassNames(); 