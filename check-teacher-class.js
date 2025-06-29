import { query } from './src/db.js';

async function checkTeacherData() {
  try {
    console.log('🔍 Checking teacher data...');
    
    // Check staff table for teachers
    const teachers = await query(
      'SELECT id, name, email, className, role FROM staff WHERE role = ?',
      ['teacher'],
      'skydek_DB'
    );
    
    console.log('\n👨‍🏫 Teachers in staff table:');
    teachers.forEach(teacher => {
      console.log(`- ID: ${teacher.id}, Name: ${teacher.name}, Class: ${teacher.className || 'UNASSIGNED'}`);
    });
    
    // Check children table for class names
    const classes = await query(
      'SELECT DISTINCT className FROM children WHERE className IS NOT NULL',
      [],
      'skydek_DB'
    );
    
    console.log('\n🏫 Available classes:');
    classes.forEach(cls => {
      console.log(`- ${cls.className}`);
    });
    
    // Check if any teachers have null className
    const unassignedTeachers = teachers.filter(t => !t.className);
    if (unassignedTeachers.length > 0) {
      console.log('\n⚠️ Teachers without class assignment:');
      unassignedTeachers.forEach(teacher => {
        console.log(`- ${teacher.name} (ID: ${teacher.id})`);
      });
    } else {
      console.log('\n✅ All teachers have class assignments');
    }
    
    // Check for recent homework assignments
    const recentHomework = await query(
      'SELECT id, title, class_name, uploaded_by_teacher_id, created_at FROM homeworks ORDER BY created_at DESC LIMIT 5',
      [],
      'skydek_DB'
    );
    
    console.log('\n📚 Recent homework assignments:');
    recentHomework.forEach(hw => {
      console.log(`- ID: ${hw.id}, Title: ${hw.title}, Class: ${hw.class_name}, Teacher: ${hw.uploaded_by_teacher_id}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkTeacherData(); 