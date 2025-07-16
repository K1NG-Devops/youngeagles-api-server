import mysql from 'mysql2/promise';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
    let connection;
    
    try {
        // Create connection
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'youngeagles'
        });
        
        console.log('Connected to database successfully');
        
        // Read migration file
        const migrationPath = path.join(__dirname, 'fix_push_subscriptions_table.sql');
        const migrationSQL = await fs.readFile(migrationPath, 'utf8');
        
        console.log('Running migration...');
        console.log('SQL to execute:', migrationSQL);
        
        // Execute migration
        await connection.execute(migrationSQL);
        
        console.log('Migration completed successfully!');
        
        // Verify the column was added
        const [columns] = await connection.execute("DESCRIBE push_subscriptions");
        console.log('Current table structure:');
        console.table(columns);
        
        // Check if userId column exists
        const userIdColumn = columns.find(col => col.Field === 'userId');
        if (userIdColumn) {
            console.log('✅ userId column exists:', userIdColumn);
        } else {
            console.log('❌ userId column not found');
        }
        
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('Database connection closed');
        }
    }
}

// Run migration
runMigration();
