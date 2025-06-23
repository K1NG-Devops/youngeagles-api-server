#!/usr/bin/env node

import https from 'https';

const API_BASE_URL = 'https://youngeagles-api-server.up.railway.app';

// Test the teacher endpoints
async function testTeacherEndpoints() {
  console.log('🧪 Testing Teacher Endpoints');
  console.log('===========================');
  
  const endpoints = [
    '/api/health',
    '/api/teacher/profile',
    '/api/teacher/dashboard', 
    '/api/teacher/classes',
    '/api/teacher/stats',
    '/api/teacher/submissions',
    '/api/teacher'
  ];
  
  for (const endpoint of endpoints) {
    await testEndpoint(endpoint);
  }
}

function testEndpoint(path) {
  return new Promise((resolve) => {
    const url = new URL(API_BASE_URL + path);
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Test Script'
      }
    };

    console.log(`\n🔍 Testing: ${path}`);
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`   Status: ${res.statusCode}`);
        
        if (res.statusCode === 200) {
          console.log(`   ✅ Success`);
          try {
            const json = JSON.parse(data);
            console.log(`   📄 Response: ${JSON.stringify(json).substring(0, 100)}...`);
          } catch (e) {
            console.log(`   📄 Response: ${data.substring(0, 100)}...`);
          }
        } else if (res.statusCode === 403) {
          console.log(`   🔒 Forbidden (expected for protected endpoints)`);
        } else if (res.statusCode === 404) {
          console.log(`   ❌ Not Found - Endpoint missing`);
        } else {
          console.log(`   ⚠️  Status: ${res.statusCode}`);
          console.log(`   📄 Response: ${data.substring(0, 200)}`);
        }
        resolve();
      });
    });

    req.on('error', (error) => {
      console.log(`   ❌ Error: ${error.message}`);
      resolve();
    });

    req.setTimeout(10000, () => {
      console.log(`   ⏰ Timeout`);
      req.destroy();
      resolve();
    });

    req.end();
  });
}

// Run the test
testTeacherEndpoints().then(() => {
  console.log('\n🎉 Test completed!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
}); 