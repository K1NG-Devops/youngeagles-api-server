#!/usr/bin/env node

import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },
  multipleStatements: true
};

async function executeSeedScript() {
  let connection;
  
  try {
    console.log('🔌 Connecting to database...');
    console.log(`📊 Host: ${dbConfig.host}:${dbConfig.port}`);
    console.log(`📊 Database: ${dbConfig.database}`);
    console.log(`👤 User: ${dbConfig.user}`);
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Database connected successfully!');
    
    // Read the seeding script
    const seedScriptPath = path.join(process.cwd(), 'seed-martin-data-fixed.sql');
    console.log(`📂 Reading seed script: ${seedScriptPath}`);
    
    if (!fs.existsSync(seedScriptPath)) {
      throw new Error(`Seed script not found: ${seedScriptPath}`);
    }
    
    const seedScript = fs.readFileSync(seedScriptPath, 'utf8');
    console.log('📜 Seed script loaded successfully');
    
    // Execute the script
    console.log('🚀 Executing Martin Baker seed script...');
    const results = await connection.query(seedScript);
    
    console.log('✅ Seed script executed successfully!');
    console.log(`📊 Query results: ${results.length} result sets returned`);
    
    // Display any SELECT results from the script
    if (Array.isArray(results) && results.length > 0) {
      results.forEach((result, index) => {
        if (Array.isArray(result) && result.length > 0 && typeof result[0] === 'object') {
          console.log(`\n📋 Result Set ${index + 1}:`);
          console.table(result);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error executing seed script:', error.message);
    
    if (error.code) {
      console.error(`Error Code: ${error.code}`);
    }
    if (error.sqlState) {
      console.error(`SQL State: ${error.sqlState}`);
    }
    if (error.sql) {
      console.error(`SQL Query: ${error.sql.substring(0, 200)}...`);
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔐 Database connection closed');
    }
  }
}

// Run the script
executeSeedScript();
