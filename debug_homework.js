import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

async function debugHomeworkForMartin() {
    let connection;
    
    try {
        // Create database connection with SSL settings for Railway
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            ssl: {
                rejectUnauthorized: false
            },
            connectTimeout: 30000,
            acquireTimeout: 30000,
            timeout: 30000
        });

        console.log('✅ Database connection established');

        const martinId = 25;
        
        // 1. Get Martin Baker's parent info
        console.log('\n=== 1. Martin Baker Parent Info ===');
        const [parentRows] = await connection.execute(
            'SELECT * FROM users WHERE id = ?',
            [martinId]
        );
        console.log('Parent found:', parentRows.length > 0 ? 'Yes' : 'No');
        if (parentRows.length > 0) {
            console.log('Parent details:', {
                id: parentRows[0].id,
                name: parentRows[0].name,
                email: parentRows[0].email
            });
        }

        // 2. Get Martin's children
        console.log('\n=== 2. Martin\'s Children ===');
        const [childrenRows] = await connection.execute(
            'SELECT * FROM children WHERE parent_id = ?',
            [martinId]
        );
        console.log('Children count:', childrenRows.length);
        childrenRows.forEach((child, index) => {
            console.log(`Child ${index + 1}:`, {
                id: child.id,
                name: child.name,
                grade: child.grade,
                className: child.className
            });
        });

        // 3. Check all homework assignments
        console.log('\n=== 3. All Homework Assignments ===');
        const [homeworkRows] = await connection.execute(
            'SELECT * FROM homeworks ORDER BY className, dueDate'
        );
        console.log('Total homework assignments:', homeworkRows.length);
        
        // Group by className
        const homeworkByClass = {};
        homeworkRows.forEach(hw => {
            if (!homeworkByClass[hw.className]) {
                homeworkByClass[hw.className] = [];
            }
            homeworkByClass[hw.className].push(hw);
        });
        
        console.log('Homework by class:');
        Object.keys(homeworkByClass).forEach(className => {
            console.log(`  ${className}: ${homeworkByClass[className].length} assignments`);
        });

        // 4. Check homework for each of Martin's children
        console.log('\n=== 4. Homework for Each Child ===');
        for (const child of childrenRows) {
            console.log(`\n--- Child: ${child.name} (Grade: ${child.grade}, Class: ${child.className}) ---`);
            
            // Check homework by exact className match
            const [childHomeworkByClass] = await connection.execute(
                'SELECT * FROM homeworks WHERE className = ? ORDER BY dueDate',
                [child.className]
            );
            console.log(`Homework by className "${child.className}":`, childHomeworkByClass.length);
            
            // Check homework by grade match
            const [childHomeworkByGrade] = await connection.execute(
                'SELECT * FROM homeworks WHERE className = ? ORDER BY dueDate',
                [child.grade]
            );
            console.log(`Homework by grade "${child.grade}":`, childHomeworkByGrade.length);
            
            // Show first few assignments if any
            if (childHomeworkByClass.length > 0) {
                console.log('Sample assignments by className:');
                childHomeworkByClass.slice(0, 3).forEach(hw => {
                    console.log(`  - ${hw.subject}: ${hw.title} (Due: ${hw.dueDate})`);
                });
            }
            
            if (childHomeworkByGrade.length > 0) {
                console.log('Sample assignments by grade:');
                childHomeworkByGrade.slice(0, 3).forEach(hw => {
                    console.log(`  - ${hw.subject}: ${hw.title} (Due: ${hw.dueDate})`);
                });
            }
        }

        // 5. Simulate the exact API query
        console.log('\n=== 5. Simulating API Query ===');
        for (const child of childrenRows) {
            console.log(`\n--- API Query for ${child.name} ---`);
            
            const query = `
                SELECT 
                    h.*,
                    s.id as submissionId,
                    s.submittedAt,
                    s.grade as submissionGrade,
                    s.feedback,
                    s.filePath
                FROM homeworks h
                LEFT JOIN submissions s ON h.id = s.homeworkId AND s.childId = ?
                WHERE h.className = ?
                ORDER BY h.dueDate DESC
            `;
            
            const [apiResults] = await connection.execute(query, [child.id, child.className]);
            console.log(`Results for className "${child.className}":`, apiResults.length);
            
            if (apiResults.length > 0) {
                console.log('Sample results:');
                apiResults.slice(0, 2).forEach(result => {
                    console.log(`  - ${result.subject}: ${result.title}`);
                    console.log(`    Due: ${result.dueDate}, Submitted: ${result.submittedAt || 'No'}`);
                });
            }
        }

        // 6. Check for potential mismatches
        console.log('\n=== 6. Data Alignment Analysis ===');
        const allClassNames = [...new Set(homeworkRows.map(hw => hw.className))];
        const allChildClasses = [...new Set(childrenRows.map(child => child.className))];
        const allChildGrades = [...new Set(childrenRows.map(child => child.grade))];
        
        console.log('All homework class names:', allClassNames);
        console.log('All children class names:', allChildClasses);
        console.log('All children grades:', allChildGrades);
        
        console.log('\nMismatches:');
        allChildClasses.forEach(childClass => {
            if (!allClassNames.includes(childClass)) {
                console.log(`  ❌ Child className "${childClass}" has no homework assignments`);
            }
        });
        
        allChildGrades.forEach(grade => {
            if (!allClassNames.includes(grade)) {
                console.log(`  ❌ Child grade "${grade}" has no homework assignments`);
            }
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Full error:', error);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n📝 Database connection closed');
        }
    }
}

// Run the diagnostic
debugHomeworkForMartin();
