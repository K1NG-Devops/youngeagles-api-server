import dotenv from 'dotenv';
dotenv.config();

import billingService from './src/services/billingService.js';
import { initDatabase } from './src/db.js';

async function setupBillingAutomation() {
    console.log('🚀 Setting up YoungEagles Billing Automation...');
    
    try {
        // Initialize database
        console.log('🔌 Connecting to database...');
        const dbConnected = await initDatabase();
        
        if (!dbConnected) {
            throw new Error('Database connection failed');
        }
        console.log('✅ Database connected successfully');

        // Test billing system
        console.log('🧪 Testing billing system...');
        const testResult = await billingService.testBillingSystem();
        
        if (!testResult.success) {
            throw new Error(`Billing system test failed: ${testResult.error}`);
        }
        
        console.log('✅ Billing system test passed');
        console.log('📊 System Status:', {
            database: testResult.database,
            payfast: testResult.payfast,
            stripe: testResult.stripe
        });

        // Initialize billing automation
        console.log('⚙️ Initializing billing automation...');
        billingService.init();

        console.log('🎉 Billing automation setup completed successfully!');
        console.log('📅 Scheduled tasks:');
        console.log('  - Daily billing checks: 2:00 AM CAT');
        console.log('  - Expiry checks: Every 6 hours');
        console.log('  - Failed payment retry: Every 3 days at 3:00 AM CAT');
        console.log('  - Monthly reports: 1st of month at 8:00 AM CAT');

        // Keep the process running
        console.log('🔄 Billing automation is now running...');
        console.log('Press Ctrl+C to stop');

        // Graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n🛑 Shutting down billing automation...');
            billingService.stop();
            process.exit(0);
        });

        process.on('SIGTERM', () => {
            console.log('\n🛑 Shutting down billing automation...');
            billingService.stop();
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ Billing automation setup failed:', error);
        process.exit(1);
    }
}

// Manual billing test function
async function runManualBillingTest() {
    console.log('🧪 Running manual billing test...');
    
    try {
        await initDatabase();
        
        // Process any due renewals manually
        await billingService.processScheduledBilling();
        
        // Process expired subscriptions
        await billingService.processExpiredSubscriptions();
        
        // Get stats
        const stats = billingService.getBillingStats();
        console.log('📊 Billing Stats:', stats);
        
        console.log('✅ Manual billing test completed');
        
    } catch (error) {
        console.error('❌ Manual billing test failed:', error);
    }
}

// Check command line arguments
const command = process.argv[2];

switch (command) {
    case 'test':
        runManualBillingTest().then(() => process.exit(0));
        break;
    case 'setup':
    default:
        setupBillingAutomation();
        break;
}

export { setupBillingAutomation, runManualBillingTest }; 