import crypto from 'crypto';
import { query, execute } from './src/db.js';
import dotenv from 'dotenv';

dotenv.config();

// Use the same password hashing method as the API
function hashPassword(password) {
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

const fixTeacherPassword = async () => {
  try {
    console.log('🔧 Fixing teacher password with correct hashing...');
    
    const email = 'test.teacher@youngeagles.org.za';
    const password = 'Test@123';
    
    // Hash password using the same method as the API
    const hashedPassword = hashPassword(password);
    
    console.log('📧 Email:', email);
    console.log('🔑 Password:', password);
    console.log('🔐 Hashed password format:', hashedPassword.substring(0, 20) + '...');
    
    // Update the existing teacher record
    const result = await execute(
      'UPDATE staff SET password = ?, updated_at = NOW() WHERE email = ? AND role = ?',
      [hashedPassword, email, 'teacher'],
      'skydek_DB'
    );
    
    if (result.affectedRows > 0) {
      console.log('✅ Teacher password updated successfully!');
      
      // Verify the update
      const updatedTeacher = await query(
        'SELECT id, name, email, role, created_at, updated_at FROM staff WHERE email = ?',
        [email],
        'skydek_DB'
      );
      
      if (updatedTeacher.length > 0) {
        console.log('🔍 Updated teacher record:');
        console.log('   ID:', updatedTeacher[0].id);
        console.log('   Name:', updatedTeacher[0].name);
        console.log('   Email:', updatedTeacher[0].email);
        console.log('   Role:', updatedTeacher[0].role);
        console.log('   Updated at:', updatedTeacher[0].updated_at);
        console.log('\n🎉 Teacher password fixed! Try logging in now.');
      }
    } else {
      console.log('❌ No teacher record found to update');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing teacher password:', error);
    process.exit(1);
  }
};

// Run the fix
fixTeacherPassword(); 