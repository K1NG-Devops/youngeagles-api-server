import crypto from 'crypto';
import { query, execute } from './src/db.js';

// Set production environment variables
process.env.SKYDEK_DB_HOST = 'shuttle.proxy.rlwy.net';
process.env.SKYDEK_DB_USER = 'root';
process.env.SKYDEK_DB_PASSWORD = 'PJWCNiMVfCHVaKpOZIBjzaYTSRxJIdOT';
process.env.SKYDEK_DB_NAME = 'skydek_DB';
process.env.SKYDEK_DB_PORT = '49263';
process.env.NODE_ENV = 'production';

// Use the same password hashing method as the API (PBKDF2)
function hashPassword(password) {
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

const setupProductionAccounts = async () => {
  try {
    console.log('🚀 Setting up production accounts with Railway database...\n');
    console.log(`🔌 Connecting to: ${process.env.SKYDEK_DB_HOST}:${process.env.SKYDEK_DB_PORT}`);
    console.log(`📊 Database: ${process.env.SKYDEK_DB_NAME}\n`);
    
    const accounts = [
      {
        name: 'Admin User',
        email: 'admin@youngeagles.org.za',
        password: '#Admin@2012',
        role: 'admin',
        table: 'staff'
      },
      {
        name: 'Test Teacher',
        email: 'test.teacher@youngeagles.org.za',
        password: 'Test@123',
        role: 'teacher',
        table: 'staff',
        className: 'Panda Class'
      },
      {
        name: 'Gabriel Teacher',
        email: 'gabriel@youngeagles.org.za',
        password: 'Gabriel@123',
        role: 'teacher',
        table: 'staff',
        className: 'Lion Class'
      },
      {
        name: 'King Developer',
        email: 'king@youngeagles.org.za',
        password: 'King@123',
        role: 'admin',
        table: 'staff'
      }
    ];

    for (const account of accounts) {
      console.log(`🔧 Processing ${account.role}: ${account.email}`);
      
      // Hash password using PBKDF2 (same as API)
      const hashedPassword = hashPassword(account.password);
      console.log(`   🔐 Generated PBKDF2 hash: ${hashedPassword.substring(0, 50)}...`);
      
      // Check if account exists in staff table
      const existing = await query(
        'SELECT id, name, email, role, password FROM staff WHERE email = ?',
        [account.email],
        'skydek_DB'
      );

      if (existing.length > 0) {
        console.log(`   ⚠️  Account exists. Updating with PBKDF2 password...`);
        
        const updateFields = ['name = ?', 'password = ?', 'role = ?', 'is_verified = TRUE', 'updated_at = NOW()'];
        const updateValues = [account.name, hashedPassword, account.role];
        
        if (account.className) {
          updateFields.push('className = ?');
          updateValues.push(account.className);
        }
        
        updateValues.push(account.email);
        
        await execute(
          `UPDATE staff SET ${updateFields.join(', ')} WHERE email = ?`,
          updateValues,
          'skydek_DB'
        );
        
        console.log(`   ✅ Account updated successfully!`);
      } else {
        console.log(`   ➕ Creating new account...`);
        
        const insertFields = ['name', 'email', 'password', 'role', 'is_verified'];
        const insertValues = [account.name, account.email, hashedPassword, account.role, true];
        
        if (account.className) {
          insertFields.push('className');
          insertValues.push(account.className);
        }
        
        await execute(
          `INSERT INTO staff (${insertFields.join(', ')}) VALUES (${insertFields.map(() => '?').join(', ')})`,
          insertValues,
          'skydek_DB'
        );
        
        console.log(`   ✅ Account created successfully!`);
      }
    }

    // Verify all accounts
    console.log('\n🔍 Verifying created accounts...');
    
    const staffAccounts = await query(
      'SELECT id, name, email, role, className, is_verified, password, updated_at FROM staff ORDER BY email',
      [],
      'skydek_DB'
    );

    console.log('\n🎉 Production accounts setup complete!');
    console.log('='.repeat(80));
    console.log('📊 ALL STAFF ACCOUNTS:');
    staffAccounts.forEach(account => {
      console.log(`   ${account.role.toUpperCase()}: ${account.email}`);
      console.log(`   Name: ${account.name}`);
      if (account.className) console.log(`   Class: ${account.className}`);
      console.log(`   Verified: ${account.is_verified ? 'Yes' : 'No'}`);
      console.log(`   Password Hash: ${account.password.substring(0, 20)}...`);
      console.log(`   Updated: ${account.updated_at}`);
      console.log('');
    });
    
    console.log('🔑 WORKING LOGIN CREDENTIALS:');
    console.log('   Admin: admin@youngeagles.org.za / #Admin@2012');
    console.log('   Test Teacher: test.teacher@youngeagles.org.za / Test@123');
    console.log('   Gabriel Teacher: gabriel@youngeagles.org.za / Gabriel@123');
    console.log('   King Admin: king@youngeagles.org.za / King@123');
    console.log('='.repeat(80));
    
    console.log('\n✨ All passwords now use PBKDF2 hashing (compatible with API)');
    console.log('🌐 Login URLs:');
    console.log('   Admin: https://youngeagles-2eca3qu6x-k1ng-devops-projects.vercel.app/admin-login');
    console.log('   Teacher: https://youngeagles-2eca3qu6x-k1ng-devops-projects.vercel.app/teacher-login');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up production accounts:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
};

// Run the setup
setupProductionAccounts(); 