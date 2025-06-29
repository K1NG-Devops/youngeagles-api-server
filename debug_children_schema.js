import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function inspectChildrenSchema() {
    let connection;
    try {
        console.log('Connecting to database...');
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            ssl: { rejectUnauthorized: false }
        });

        // Get the schema of the children table
        console.log('\n=== CHILDREN TABLE SCHEMA ===');
        const [schemaRows] = await connection.execute('DESCRIBE children');
        console.table(schemaRows);

        // Also get a sample record to see the actual data structure
        console.log('\n=== SAMPLE CHILDREN RECORDS ===');
        const [sampleRows] = await connection.execute('SELECT * FROM children LIMIT 3');
        console.table(sampleRows);

        // Test different possible foreign key column names
        console.log('\n=== TESTING FOREIGN KEY COLUMNS ===');
        const possibleFKColumns = ['parentId', 'parent_id', 'userId', 'user_id', 'guardianId', 'guardian_id'];
        
        for (const columnName of possibleFKColumns) {
            try {
                const [testRows] = await connection.execute(`SELECT ${columnName} FROM children LIMIT 1`);
                console.log(`✓ Column '${columnName}' exists`);
                if (testRows.length > 0) {
                    console.log(`  Sample value: ${testRows[0][columnName]}`);
                }
            } catch (error) {
                console.log(`✗ Column '${columnName}' does not exist`);
            }
        }

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        if (connection) {
            await connection.end();
            console.log('Connection closed.');
        }
    }
}

inspectChildrenSchema();
