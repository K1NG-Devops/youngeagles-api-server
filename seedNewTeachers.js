import crypto from 'crypto';
import { query, execute } from './src/db.js';
import dotenv from 'dotenv';

dotenv.config();

// Password security utilities (same as in server)
class PasswordSecurity {
  static hashPassword(password) {
    const salt = crypto.randomBytes(32).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }
}

const seedNewTeachers = async () => {
  try {
    console.log('👩‍🏫 Setting up new teacher accounts...');
    
    // First, check if className column exists in staff table, if not add it
    console.log('🔧 Checking staff table schema...');
    
    try {
      const existingClassNameColumn = await query(
        `SELECT COUNT(*) as count FROM information_schema.COLUMNS 
         WHERE TABLE_SCHEMA = 'skydek_DB' AND TABLE_NAME = 'staff' AND COLUMN_NAME = 'className'`,
        [],
        'skydek_DB'
      );
      
      if (existingClassNameColumn[0].count === 0) {
        console.log('➕ Adding className column to staff table...');
        await execute(
          'ALTER TABLE staff ADD COLUMN className VARCHAR(50) NULL',
          [],
          'skydek_DB'
        );
        console.log('✅ className column added successfully!');
      } else {
        console.log('✅ className column already exists');
      }
    } catch (error) {
      console.error('⚠️  Warning: Could not check/add className column:', error.message);
    }
    
    const teachersData = [
      {
        name: 'Dimakatso Mogashoa',
        email: 'katso@youngeagles.org.za',
        password: '#Katso@yehc103',
        className: 'Panda',
        role: 'teacher',
        qualification: 'Bachelor of Education',
        specialization: 'Early Childhood Development',
        bio: 'Passionate educator with experience in early childhood development and creative learning.'
      },
      {
        name: 'Seipati Kgalema',
        email: 'seipati.kgalema@youngeagles.org.za',
        password: '#Seipati@yehc102',
        className: 'Curious Cubs',
        role: 'teacher',
        qualification: 'Bachelor of Education',
        specialization: 'Primary Education',
        bio: 'Dedicated teacher focused on nurturing curiosity and creativity in young learners.'
      }
    ];

    for (const teacherData of teachersData) {
      console.log(`\n👩‍🏫 Processing teacher: ${teacherData.name}...`);
      
      // Hash password
      const hashedPassword = PasswordSecurity.hashPassword(teacherData.password);

      // Check if teacher already exists in staff table
      const existingTeacher = await query(
        'SELECT id FROM staff WHERE email = ? AND role = ?',
        [teacherData.email, teacherData.role],
        'skydek_DB'
      );

      if (existingTeacher.length > 0) {
        console.log(`⚠️  Teacher ${teacherData.name} already exists. Updating...`);
        
        await execute(
          `UPDATE staff SET 
           name = ?, 
           password = ?, 
           className = ?, 
           qualification = ?, 
           specialization = ?, 
           bio = ?, 
           is_verified = TRUE,
           updated_at = CURRENT_TIMESTAMP
           WHERE email = ? AND role = ?`,
          [
            teacherData.name, 
            hashedPassword, 
            teacherData.className,
            teacherData.qualification,
            teacherData.specialization,
            teacherData.bio,
            teacherData.email, 
            teacherData.role
          ],
          'skydek_DB'
        );
        
        console.log(`✅ Teacher ${teacherData.name} updated successfully!`);
      } else {
        console.log(`➕ Creating new teacher: ${teacherData.name}...`);
        
        await execute(
          `INSERT INTO staff (
            name, 
            email, 
            password, 
            role, 
            className, 
            qualification, 
            specialization, 
            bio, 
            is_verified
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
          [
            teacherData.name, 
            teacherData.email, 
            hashedPassword, 
            teacherData.role,
            teacherData.className,
            teacherData.qualification,
            teacherData.specialization,
            teacherData.bio
          ],
          'skydek_DB'
        );
        
        console.log(`✅ Teacher ${teacherData.name} created successfully!`);
      }
    }

    console.log('\n🎉 Teacher setup complete!');
    console.log('='.repeat(60));
    console.log('Teacher Login Credentials:');
    console.log('='.repeat(60));
    
    teachersData.forEach((teacher, index) => {
      console.log(`\n👩‍🏫 Teacher ${index + 1}: ${teacher.name}`);
      console.log(`📧 Email: ${teacher.email}`);
      console.log(`🔑 Password: ${teacher.password}`);
      console.log(`🏫 Class: ${teacher.className}`);
    });
    
    console.log('='.repeat(60));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up teachers:', error);
    process.exit(1);
  }
};

// Run the seeding script
seedNewTeachers();
