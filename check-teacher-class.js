import mysql from 'mysql2/promise';

const dbConfig = {
  host: 'shuttle.proxy.rlwy.net',
  port: 49263,
  user: 'root',
  password: 'fhdgRvbocRQKcikxGTNsQUHVIMizngLb',
  database: 'skydek_DB',
  ssl: false
};

async function checkTeacherAndChildren() {
  let connection;
  try {
    console.log('Checking teacher and children...');
    
    // Create connection
    connection = await mysql.createConnection(dbConfig);

    // Get teacher info
    const [teachers] = await connection.execute(
      'SELECT id, name, email, className FROM staff WHERE id = ?',
      [16]
    );

    if (teachers.length > 0) {
      const teacher = teachers[0];
      console.log('\nTeacher info:');
      console.log(`- ${teacher.name} (ID: ${teacher.id}): ${teacher.className}`);

      // Get children in teacher's class
      const [children] = await connection.execute(
        'SELECT id, name, className FROM children WHERE className = ?',
        [teacher.className]
      );

      console.log(`\nChildren in ${teacher.className}:`);
      if (children.length > 0) {
        children.forEach(child => {
          console.log(`- ${child.name} (ID: ${child.id}): ${child.className}`);
        });
      } else {
        console.log('No children found in this class');
      }

      // Also check for children in "Panda"
      const [pandaChildren] = await connection.execute(
        'SELECT id, name, className FROM children WHERE className = ?',
        ['Panda']
      );

      console.log('\nChildren in "Panda":');
      if (pandaChildren.length > 0) {
        pandaChildren.forEach(child => {
          console.log(`- ${child.name} (ID: ${child.id}): ${child.className}`);
        });
      } else {
        console.log('No children found in "Panda" class');
      }
    } else {
      console.log('Teacher not found');
    }

  } catch (error) {
    console.error('Error checking teacher and children:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkTeacherAndChildren(); 