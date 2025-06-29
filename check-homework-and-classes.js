import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function checkData() {
    console.log('🔌 Connecting to database...');
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });
    console.log('✅ Database connected successfully!\n');

    // Check all homework assignments
    const [homeworks] = await connection.execute('SELECT * FROM homeworks ORDER BY created_at DESC');
    console.log('📚 All Homework Assignments:');
    console.table(homeworks);

    // Check all classes
    const [classes] = await connection.execute('SELECT * FROM classes ORDER BY id');
    console.log('\n🏫 All Classes:');
    console.table(classes);

    // Check children's grades vs class names
    const [childrenGrades] = await connection.execute('SELECT DISTINCT grade FROM children ORDER BY grade');
    console.log('\n👦👧 Distinct Grades in Children Table:');
    console.table(childrenGrades);

    // Check class names vs grades
    const [classNames] = await connection.execute('SELECT DISTINCT name FROM classes ORDER BY name');
    console.log('\n📋 Distinct Class Names:');
    console.table(classNames);

    await connection.end();
    console.log('\n🔐 Database connection closed');
}

checkData().catch(console.error);
