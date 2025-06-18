import bcrypt from 'bcryptjs';
import { query, execute } from './src/db.js';
import dotenv from 'dotenv';

dotenv.config();

const createAdminUser = async () => {
  try {
    console.log('🔧 Creating admin user...');
    
    const adminData = {
      email: 'king@youngeagles.org.za',
      password: 'King@123',
      name: 'King',
      address: 'Admin Office'
    };

    // Check if admin already exists
    const existingAdmin = await query(
      'SELECT id FROM users WHERE email = ? AND role = ?',
      [adminData.email, 'admin'],
      'railway'
    );

    if (existingAdmin.length > 0) {
      console.log('⚠️ Admin user already exists. Updating password...');
      
      // Hash password
      const hashedPassword = await bcrypt.hash(adminData.password, 12);
      
      // Update password
      await execute(
        'UPDATE users SET password = ? WHERE email = ? AND role = ?',
        [hashedPassword, adminData.email, 'admin'],
        'railway'
      );
      
      console.log('✅ Admin password updated successfully!');
    } else {
      // Hash password
      const hashedPassword = await bcrypt.hash(adminData.password, 12);
      
      // Insert new admin
      await execute(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        [adminData.name, adminData.email, hashedPassword, 'admin'],
        'railway'
      );
      
      console.log('✅ Admin user created successfully!');
    }

    // Also ensure admin exists in skydek_DB
    const existingAdminSkydek = await query(
      'SELECT id FROM users WHERE email = ? AND role = ?',
      [adminData.email, 'admin'],
      'skydek_DB'
    );

    if (existingAdminSkydek.length === 0) {
      // Hash password again for skydek_DB
      const hashedPassword = await bcrypt.hash(adminData.password, 12);
      
      // Insert admin into skydek_DB with address
      await execute(
        'INSERT INTO users (name, email, password, role, address) VALUES (?, ?, ?, ?, ?)',
        [adminData.name, adminData.email, hashedPassword, 'admin', adminData.address],
        'skydek_DB'
      );
      
      console.log('✅ Admin user added to skydek_DB successfully!');
    }

    console.log('\n🎉 Admin setup complete!');
    console.log('Admin credentials:');
    console.log(`Email: ${adminData.email}`);
    console.log(`Password: ${adminData.password}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
};

// Run the script
createAdminUser(); 