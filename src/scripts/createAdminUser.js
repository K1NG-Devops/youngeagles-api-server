import bcrypt from 'bcryptjs';
import { query, execute } from '../db.js';
import dotenv from 'dotenv';

dotenv.config();

const createAdminUser = async () => {
  try {
    console.log('🔧 Creating admin user in staff table...');
    
    const adminData = {
      email: 'king@youngeagles.org.za',
      password: 'King@123',
      name: 'King',
    };

    // Check if admin already exists in staff table
    const existingAdmin = await query(
      'SELECT id FROM staff WHERE email = ? AND role = ?',
      [adminData.email, 'admin'],
      'skydek_DB'
    );

    const hashedPassword = await bcrypt.hash(adminData.password, 12);

    if (existingAdmin.length > 0) {
      console.log('⚠️ Admin user already exists in staff. Updating password...');
      await execute(
        'UPDATE staff SET password = ?, name = ? WHERE email = ? AND role = ?',
        [hashedPassword, adminData.name, adminData.email, 'admin'],
        'skydek_DB'
      );
      console.log('✅ Admin password updated successfully in staff!');
    } else {
      await execute(
        'INSERT INTO staff (name, email, password, role) VALUES (?, ?, ?, ?)',
        [adminData.name, adminData.email, hashedPassword, 'admin'],
        'skydek_DB'
      );
      console.log('✅ Admin user created successfully in staff!');
    }

    console.log('\n🎉 Admin setup complete!');
    console.log('Admin credentials:');
    console.log(`Email: ${adminData.email}`);
    console.log(`Password: ${adminData.password}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user in staff:', error);
    process.exit(1);
  }
};

// Run the script
createAdminUser(); 