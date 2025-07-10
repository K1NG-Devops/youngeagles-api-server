import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import 'dotenv/config';
import config from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
    const connection = await mysql.createConnection(config);
    
    try {
        // Create migrations table if it doesn't exist
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS migrations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                migration_name VARCHAR(255) NOT NULL,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Get all SQL files in the migrations directory
        const files = fs.readdirSync(__dirname)
            .filter(file => file.endsWith('.sql'))
            .sort();

        // Get executed migrations
        const [executed] = await connection.execute('SELECT migration_name FROM migrations');
        const executedMigrations = new Set(executed.map(row => row.migration_name));

        for (const file of files) {
            if (!executedMigrations.has(file)) {
                console.log(`Running migration: ${file}`);
                const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
                
                await connection.execute(sql);
                await connection.execute('INSERT INTO migrations (migration_name) VALUES (?)', [file]);
                
                console.log(`Migration completed: ${file}`);
            }
        }

        console.log('All migrations completed successfully');
    } catch (error) {
        console.error('Error running migrations:', error);
        throw error;
    } finally {
        await connection.end();
    }
}

runMigrations().catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
});
