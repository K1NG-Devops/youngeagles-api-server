import crypto from 'crypto';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Use the same password hashing method as the API (PBKDF2)
function hashPassword(password) {
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

const seedProductionAdmin = async () => {
  let connection = null;
  
  try {
    console.log('🌱 Creating production admin user...');
    
    // Production database configuration
    const dbConfig = {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    };
    
    console.log('🔌 Connecting to production database...');
    console.log(`📍 Host: ${dbConfig.host}`);
    console.log(`📍 Database: ${dbConfig.database}`);
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to production database!');
    
    // Create staff table if it doesn't exist
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS staff (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin', 'teacher') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_verified BOOLEAN DEFAULT FALSE,
        reset_token VARCHAR(255),
        reset_token_expires TIMESTAMP NULL,
        className VARCHAR(255) NULL,
        phone VARCHAR(20) NULL,
        qualification VARCHAR(255) NULL,
        experience_years INT NULL,
        specialization VARCHAR(255) NULL,
        emergency_contact_name VARCHAR(255) NULL,
        emergency_contact_phone VARCHAR(255) NULL,
        bio TEXT NULL,
        profile_picture VARCHAR(255) NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ Staff table ready!');
    
    const adminData = {
      name: 'Production Admin',
      email: 'admin@youngeagles.org.za',
      password: '#Admin@2012',
      role: 'admin'
    };

    // Hash password using PBKDF2 (same as API)
    const hashedPassword = hashPassword(adminData.password);
    console.log('🔐 Password hashed using PBKDF2');

    // Check if admin already exists
    const [existingAdmin] = await connection.execute(
      'SELECT id FROM staff WHERE email = ?',
      [adminData.email]
    );

    if (existingAdmin.length > 0) {
      console.log('⚠️  Production admin user already exists. Updating password...');
      
      await connection.execute(
        'UPDATE staff SET name = ?, password = ?, role = ?, is_verified = TRUE WHERE email = ?',
        [adminData.name, hashedPassword, adminData.role, adminData.email]
      );
      
      console.log('✅ Production admin user updated successfully!');
    } else {
      console.log('➕ Creating new production admin user...');
      
      await connection.execute(
        'INSERT INTO staff (name, email, password, role, is_verified) VALUES (?, ?, ?, ?, TRUE)',
        [adminData.name, adminData.email, hashedPassword, adminData.role]
      );
      
      console.log('✅ Production admin user created successfully!');
    }

    // Also create a teacher for testing
    const teacherData = {
      name: 'Test Teacher',
      email: 'teacher@youngeagles.org.za',
      password: 'Teacher@123',
      role: 'teacher'
    };

    const teacherHashedPassword = hashPassword(teacherData.password);

    const [existingTeacher] = await connection.execute(
      'SELECT id FROM staff WHERE email = ?',
      [teacherData.email]
    );

    if (existingTeacher.length > 0) {
      console.log('⚠️  Test teacher already exists. Updating password...');
      
      await connection.execute(
        'UPDATE staff SET name = ?, password = ?, role = ?, is_verified = TRUE WHERE email = ?',
        [teacherData.name, teacherHashedPassword, teacherData.role, teacherData.email]
      );
      
      console.log('✅ Test teacher updated successfully!');
    } else {
      console.log('➕ Creating test teacher...');
      
      await connection.execute(
        'INSERT INTO staff (name, email, password, role, is_verified) VALUES (?, ?, ?, ?, TRUE)',
        [teacherData.name, teacherData.email, teacherHashedPassword, teacherData.role]
      );
      
      console.log('✅ Test teacher created successfully!');
    }

    console.log('\n🎉 Production setup complete!');
    console.log('='.repeat(60));
    console.log('Production Admin Login Credentials:');
    console.log(`📧 Email: ${adminData.email}`);
    console.log(`🔑 Password: ${adminData.password}`);
    console.log('');
    console.log('Test Teacher Login Credentials:');
    console.log(`📧 Email: ${teacherData.email}`);
    console.log(`🔑 Password: ${teacherData.password}`);
    console.log('='.repeat(60));
    console.log('\n💡 You can now login with these credentials!');
    
  } catch (error) {
    console.error('❌ Error setting up production admin:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      sqlState: error.sqlState,
      errno: error.errno
    });
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
    process.exit(0);
  }
};

// Run the seeding script
seedProductionAdmin();
