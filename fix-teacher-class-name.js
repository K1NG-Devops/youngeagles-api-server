import { query } from './src/db.js';

async function fixTeacherClassName() {
  try {
    console.log('Starting teacher class name fix...');
    
    // Update teacher's className from "Panda Class" to "Panda"
    const result = await query(
      'UPDATE staff SET className = ? WHERE className = ?',
      ['Panda', 'Panda Class'],
      'skydek_DB'
    );

    console.log(`✅ Updated teacher records from "Panda Class" to "Panda"`);
    
    // Verify the changes
    const teachers = await query(
      'SELECT id, name, email, className FROM staff WHERE className = ?',
      ['Panda'],
      'skydek_DB'
    );

    console.log('\nTeachers in Panda class:');
    teachers.forEach(teacher => {
      console.log(`- ${teacher.name} (ID: ${teacher.id}): ${teacher.className}`);
    });

  } catch (error) {
    console.error('Error fixing teacher class name:', error);
  }
}

fixTeacherClassName(); 