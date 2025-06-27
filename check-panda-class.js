import mysql from 'mysql2/promise';

const dbConfig = {
  host: 'shuttle.proxy.rlwy.net',
  port: 49263,
  user: 'root',
  password: 'fhdgRvbocRQKcikxGTNsQUHVIMizngLb',
  database: 'skydek_DB',
  ssl: false
};

async function checkPandaClass() {
  let connection;
  try {
    console.log('Checking for any remaining "Panda Class" entries...');
    
    // Create connection
    connection = await mysql.createConnection(dbConfig);

    // Check for any remaining "Panda Class" entries
    const [pandaClass] = await connection.execute(
      'SELECT id, name, className FROM children WHERE className = ?',
      ['Panda Class']
    );

    if (pandaClass.length > 0) {
      console.log('\nWARNING: Found children still in "Panda Class":');
      pandaClass.forEach(child => {
        console.log(`- ${child.name} (ID: ${child.id}): ${child.className}`);
      });
    } else {
      console.log('\n✅ No children found with className "Panda Class"');
    }

    // Get all children in "Panda"
    const [panda] = await connection.execute(
      'SELECT id, name, className FROM children WHERE className = ?',
      ['Panda']
    );

    console.log('\nChildren in "Panda":');
    panda.forEach(child => {
      console.log(`- ${child.name} (ID: ${child.id}): ${child.className}`);
    });
    console.log(`\nTotal children in "Panda": ${panda.length}`);

  } catch (error) {
    console.error('Error checking Panda class:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit(0);
  }
}

checkPandaClass(); 