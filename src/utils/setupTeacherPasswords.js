import bcrypt from 'bcryptjs';
import { query, execute } from '../db.js';
import dotenv from 'dotenv';

dotenv.config({ path: '/home/king/Desktop/YoungEagles_Local/.env' });
console.log('DEBUG ENV:', {
  SKYDEK_DB_HOST: process.env.SKYDEK_DB_HOST,
  SKYDEK_DB_USER: process.env.SKYDEK_DB_USER,
  SKYDEK_DB_PASSWORD: process.env.SKYDEK_DB_PASSWORD,
  SKYDEK_DB_NAME: process.env.SKYDEK_DB_NAME,
  SKYDEK_DB_PORT: process.env.SKYDEK_DB_PORT,
  NODE_ENV: process.env.NODE_ENV
});

const teachersToInsert = [
  {
    name: 'Katso Mogashoa',
    email: 'katso@youngeagles.org.za',
    password: '#Katso@yehc',
    role: 'teacher',
  },
  {
    name: 'Seipati Kgalema',
    email: 'seipati@youngeagles.org.za',
    password: '#Seipati@yehc',
    role: 'teacher',
  },
];

const setupTeacherPasswords = async () => {
  try {
    console.log('🔧 Inserting/updating specified teachers in skydek_DB...');

    for (const teacher of teachersToInsert) {
      const hashedPassword = await bcrypt.hash(teacher.password, 12);
      // Check if teacher exists by email
      const existing = await query(
        'SELECT id FROM staff WHERE email = ? AND role = ? LIMIT 1',
        [teacher.email, teacher.role],
        'skydek_DB'
      );
      if (existing && existing.length > 0) {
        // Update name and password
        await execute(
          'UPDATE staff SET name = ?, password = ? WHERE id = ?',
          [teacher.name, hashedPassword, existing[0].id],
          'skydek_DB'
        );
        console.log(`🔄 Updated teacher: ${teacher.name} (${teacher.email})`);
      } else {
        // Insert new teacher
        await execute(
          'INSERT INTO staff (name, email, password, role) VALUES (?, ?, ?, ?)',
          [teacher.name, teacher.email, hashedPassword, teacher.role],
          'skydek_DB'
        );
        console.log(`➕ Inserted teacher: ${teacher.name} (${teacher.email})`);
      }
    }

    console.log('\n✨ Specified teachers have been inserted/updated!');
    teachersToInsert.forEach(t => {
      console.log(`- ${t.name} (${t.email}) | Password: ${t.password}`);
    });
    console.log('\n🎉 Setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up teacher passwords:', error);
    process.exit(1);
  }
};

setupTeacherPasswords();

