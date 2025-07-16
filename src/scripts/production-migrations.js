#!/usr/bin/env node

/**
 * Production Database Migration Runner
 * This script runs necessary database migrations on production deployment
 */

import { query } from '../db.js';
import fixPushSubscriptionsTable from './fix-push-subscriptions.js';

async function runProductionMigrations() {
  console.log('🚀 Starting production database migrations...');
  
  try {
    // 1. Fix push_subscriptions table
    console.log('\n1️⃣ Fixing push_subscriptions table...');
    await fixPushSubscriptionsTable();
    
    // 2. Add more migrations here as needed
    // await runOtherMigration();
    
    console.log('\n🎉 All production migrations completed successfully!');
    
    // Test database connection
    console.log('\n🧪 Testing database connection...');
    const testResult = await query('SELECT 1 as test');
    console.log('✅ Database connection successful:', testResult[0]);
    
  } catch (error) {
    console.error('\n❌ Production migration failed:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runProductionMigrations()
    .then(() => {
      console.log('✅ Production migrations completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Production migrations failed:', error);
      process.exit(1);
    });
}

export default runProductionMigrations;
