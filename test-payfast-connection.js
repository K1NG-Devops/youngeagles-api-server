import axios from 'axios';

async function testPayFastConnection() {
    console.log('🔍 Testing PayFast connection on production server...\n');
    
    try {
        // Test the billing system endpoint (if available)
        const healthCheck = await axios.get('https://youngeagles-api-server.up.railway.app/health');
        console.log('✅ Server is running:', healthCheck.data);
        
        // If you have a specific endpoint to test PayFast, you can add it here
        // For example:
        // const payfastTest = await axios.get('https://youngeagles-api-server.up.railway.app/api/test-payfast');
        
        console.log('\n📝 To verify PayFast is working:');
        console.log('1. Check Railway logs for any PayFast connection errors');
        console.log('2. Try making a test payment through your application');
        console.log('3. Monitor the server logs for successful PayFast API calls');
        
    } catch (error) {
        console.error('❌ Error testing connection:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

// Run the test
testPayFastConnection();
