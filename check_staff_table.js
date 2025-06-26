import mysql from 'mysql2/promise';

const dbConfig = {
  host: 'autorack.proxy.rlwy.net',
  port: 54082,
  user: 'root',
  password: 'QWNglsZCFbsopnKNqWvPqZqJjrAvCOBh',
  database: 'railway',
  ssl: {
    rejectUnauthorized: false
  }
};

async function checkTable() {
  let connection;
  try {
    console.log('🔌 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected successfully');

    // Check table structure
    console.log('\n📋 Checking staff table structure...');
    const [columns] = await connection.query('DESCRIBE staff');
    console.log('Current columns:');
    columns.forEach(col => {
      console.log(`- ${col.Field} (${col.Type})`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.sqlMessage) {
      console.error('SQL Error:', error.sqlMessage);
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

checkTable(); 