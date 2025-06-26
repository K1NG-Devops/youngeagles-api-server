import bcrypt from 'bcryptjs';
import { query, execute } from './src/db.js';
import dotenv from 'dotenv';

dotenv.config();

const seedKingAdmin = async () => {
  try {
    console.log('🌱 Creating King admin user...');
    
    const adminData = {
      name: 'King Admin',
      email: 'admin@youngeagles.org.za',
      password: 'YoungEagles@123',
      role: 'admin'
    };

    // Hash password
    const hashedPassword = await bcrypt.hash(adminData.password, 12);

    // Check if admin already exists in staff table
    const existingAdmin = await query(
      'SELECT id FROM staff WHERE email = ?',
      [adminData.email],
      'skydek_DB'
    );

    if (existingAdmin.length > 0) {
      console.log('⚠️  King admin user already exists. Updating password...');
      
      await execute(
        'UPDATE staff SET name = ?, password = ?, role = ?, is_verified = TRUE WHERE email = ?',
        [adminData.name, hashedPassword, adminData.role, adminData.email],
        'skydek_DB'
      );
      
      console.log('✅ King admin user updated successfully!');
    } else {
      console.log('➕ Creating new King admin user...');
      
      await execute(
        'INSERT INTO staff (name, email, password, role, is_verified) VALUES (?, ?, ?, ?, TRUE)',
        [adminData.name, adminData.email, hashedPassword, adminData.role],
        'skydek_DB'
      );
      
      console.log('✅ King admin user created successfully!');
    }

    console.log('\n🎉 King Admin setup complete!');
    console.log('='.repeat(50));
    console.log('King Admin Login Credentials:');
    console.log(`📧 Email: ${adminData.email}`);
    console.log(`🔑 Password: ${adminData.password}`);
    console.log('='.repeat(50));
    console.log('\n💡 You can now login as King admin!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up King admin:', error);
    process.exit(1);
  }
};

// Run the seeding script
seedKingAdmin(); 