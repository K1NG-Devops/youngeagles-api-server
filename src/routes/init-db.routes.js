import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, execute } from '../db.js';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize database endpoint
router.post('/init-db', async (req, res) => {
  try {
    console.log('🔄 Starting database initialization...');
    
    // Read the SQL initialization file
    const sqlInitPath = path.join(__dirname, '../../../init-database.sql');
    const sqlContent = fs.readFileSync(sqlInitPath, 'utf8');
    
    // Split by database use statements
    const dbScripts = sqlContent.split(/USE\s+([^;]+);/);
    
    // First part is empty, then we have pairs of [dbName, sqlScript, dbName, sqlScript, ...]
    for (let i = 1; i < dbScripts.length; i += 2) {
      const dbName = dbScripts[i].trim();
      const script = dbScripts[i + 1].trim();
      
      if (dbName && script) {
        console.log(`🗄️ Initializing database: ${dbName}`);
        
        // Split script into individual statements
        const statements = script
          .split(';')
          .filter(stmt => stmt.trim().length > 0)
          .map(stmt => stmt.trim() + ';');
        
        for (const statement of statements) {
          try {
            await execute(statement, [], dbName);
            console.log(`✅ Executed SQL statement successfully`);
          } catch (err) {
            // If table already exists or other non-fatal error, continue
            console.log(`⚠️ SQL statement error (continuing): ${err.message}`);
          }
        }
      }
    }
    
    console.log('✅ Database initialization completed successfully');
    res.status(200).json({ success: true, message: 'Database initialized successfully' });
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
