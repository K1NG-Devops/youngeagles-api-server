import bcrypt from 'bcryptjs';
import { query, execute } from './src/db.js';
import dotenv from 'dotenv';

dotenv.config();

const seedAdmin = async () => {
  try {
    console.log('🌱 Setting up staff table and seeding admin user...');
    
    // Create staff table if it doesn't exist (safe for existing data)
    console.log('📋 Creating staff table if not exists...');
    await execute(`
      CREATE TABLE IF NOT EXISTS staff (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin', 'teacher') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_verified BOOLEAN DEFAULT FALSE,
        reset_token VARCHAR(255),
        reset_token_expires TIMESTAMP NULL
      )
    `, [], 'skydek_DB');
    
    console.log('✅ Staff table ready!');
    
    const adminData = {
      name: 'School Administrator',
      email: 'admin@youngeagles.org.za',
      password: '#Admin@2012',
      role: 'admin'
    };

    // Hash password
    const hashedPassword = await bcrypt.hash(adminData.password, 12);

    // Check if admin already exists in staff table
    const existingAdmin = await query(
      'SELECT id FROM staff WHERE email = ? AND role = ?',
      [adminData.email, adminData.role],
      'skydek_DB'
    );

    if (existingAdmin.length > 0) {
      console.log('⚠️  Admin user already exists. Updating...');
      
      await execute(
        'UPDATE staff SET name = ?, password = ?, is_verified = TRUE WHERE email = ? AND role = ?',
        [adminData.name, hashedPassword, adminData.email, adminData.role],
        'skydek_DB'
      );
      
      console.log('✅ Admin user updated successfully!');
    } else {
      console.log('➕ Creating new admin user...');
      
      await execute(
        'INSERT INTO staff (name, email, password, role, is_verified) VALUES (?, ?, ?, ?, TRUE)',
        [adminData.name, adminData.email, hashedPassword, adminData.role],
        'skydek_DB'
      );
      
      console.log('✅ Admin user created successfully!');
    }

    console.log('\n🎉 Admin setup complete!');
    console.log('='.repeat(50));
    console.log('Admin Login Credentials:');
    console.log(`📧 Email: ${adminData.email}`);
    console.log(`🔑 Password: ${adminData.password}`);
    console.log('='.repeat(50));
    console.log('\n💡 You can now add teachers through the admin dashboard!');
    console.log('\n🔒 Your existing user data in skydek_DB remains untouched.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up admin:', error);
    process.exit(1);
  }
};

// Run the seeding script
seedAdmin();

