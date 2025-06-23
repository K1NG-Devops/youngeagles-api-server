#!/usr/bin/env node

import axios from 'axios';
import { io } from 'socket.io-client';

// Configuration
const BASE_URL = process.env.API_URL || 'https://youngeagles-api-server.up.railway.app';
const WS_URL = BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://');

console.log('🧪 Young Eagles API Comprehensive Test Suite');
console.log(`🌐 Testing API: ${BASE_URL}`);
console.log(`🔌 Testing WebSocket: ${WS_URL}`);
console.log('='.repeat(60));

let testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

// Test utility functions
function logTest(name, status, details = '') {
  const emoji = status === 'PASS' ? '✅' : '❌';
  console.log(`${emoji} ${name}: ${status}`);
  if (details) console.log(`   ${details}`);
  
  testResults.tests.push({ name, status, details });
  if (status === 'PASS') testResults.passed++;
  else testResults.failed++;
}

async function testEndpoint(name, method, endpoint, data = null, expectedStatus = 200, token = null) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        'x-request-source': 'test-suite'
      }
    };
    
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      config.data = data;
    }
    
    const response = await axios(config);
    
    if (response.status === expectedStatus) {
      logTest(name, 'PASS', `Status: ${response.status}`);
      return response.data;
    } else {
      logTest(name, 'FAIL', `Expected: ${expectedStatus}, Got: ${response.status}`);
      return null;
    }
  } catch (error) {
    const status = error.response?.status || 'No Response';
    const message = error.response?.data?.message || error.message;
    logTest(name, 'FAIL', `Status: ${status}, Error: ${message}`);
    return null;
  }
}

async function testWebSocket() {
  return new Promise((resolve) => {
    try {
      const socket = io(WS_URL, {
        path: '/socket.io/',
        query: {
          userId: '2',
          role: 'teacher'
        },
        transports: ['websocket']
      });

      let connected = false;
      const timeout = setTimeout(() => {
        if (!connected) {
          logTest('WebSocket Connection', 'FAIL', 'Connection timeout');
          socket.disconnect();
          resolve(false);
        }
      }, 10000);

      socket.on('connect', () => {
        connected = true;
        clearTimeout(timeout);
        logTest('WebSocket Connection', 'PASS', `Connected with ID: ${socket.id}`);
      });

      socket.on('connected', (data) => {
        logTest('WebSocket Authentication', 'PASS', `User authenticated: ${data.userId} (${data.role})`);
        
        // Test message sending
        socket.emit('send_message', {
          recipientId: '1',
          message: 'Test message from test suite',
          type: 'text'
        });
      });

      socket.on('message_sent', (data) => {
        logTest('WebSocket Messaging', 'PASS', `Message sent successfully at ${data.timestamp}`);
        socket.disconnect();
        resolve(true);
      });

      socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        logTest('WebSocket Connection', 'FAIL', `Connection error: ${error.message}`);
        resolve(false);
      });

      socket.on('disconnect', () => {
        clearTimeout(timeout);
        if (connected) {
          logTest('WebSocket Disconnect', 'PASS', 'Disconnected successfully');
        }
        resolve(connected);
      });

    } catch (error) {
      logTest('WebSocket Connection', 'FAIL', `Setup error: ${error.message}`);
      resolve(false);
    }
  });
}

async function runTests() {
  console.log('\n📋 Starting API Tests...\n');

  // 1. Health Check
  await testEndpoint('Health Check', 'GET', '/api/health');
  
  // 2. Database Health Check
  await testEndpoint('Database Health Check', 'GET', '/api/health/db');

  // 3. Test Admin Login
  console.log('\n👤 Testing Authentication...\n');
  
  const adminLoginResult = await testEndpoint(
    'Admin Login', 
    'POST', 
    '/api/auth/admin-login',
    {
      email: 'admin@youngeagles.org.za',
      password: '#Admin@2012'
    }
  );

  let adminToken = null;
  if (adminLoginResult?.accessToken) {
    adminToken = adminLoginResult.accessToken;
    logTest('Admin Token Received', 'PASS', 'Token extracted successfully');
  } else {
    logTest('Admin Token Received', 'FAIL', 'No token in response');
  }

  // 4. Test Teacher Login
  const teacherLoginResult = await testEndpoint(
    'Teacher Login',
    'POST',
    '/api/auth/teacher-login',
    {
      email: 'teacher@youngeagles.org.za',
      password: 'Teacher@123'
    }
  );

  let teacherToken = null;
  if (teacherLoginResult?.accessToken) {
    teacherToken = teacherLoginResult.accessToken;
    logTest('Teacher Token Received', 'PASS', 'Token extracted successfully');
  } else {
    logTest('Teacher Token Received', 'FAIL', 'No token in response');
  }

  // 5. Test Token Verification
  if (adminToken) {
    await testEndpoint('Admin Token Verification', 'GET', '/api/auth/verify', null, 200, adminToken);
  }

  if (teacherToken) {
    await testEndpoint('Teacher Token Verification', 'GET', '/api/auth/verify', null, 200, teacherToken);
  }

  // 6. Test Admin Endpoints
  if (adminToken) {
    console.log('\n🔐 Testing Admin Endpoints...\n');
    
    await testEndpoint('Admin Dashboard', 'GET', '/api/admin/dashboard', null, 200, adminToken);
    await testEndpoint('Admin Analytics', 'GET', '/api/admin/analytics', null, 200, adminToken);
    await testEndpoint('Admin Users List', 'GET', '/api/admin/users', null, 200, adminToken);
  }

  // 7. Test Teacher Endpoints
  if (teacherToken) {
    console.log('\n👩‍🏫 Testing Teacher Endpoints...\n');
    
    await testEndpoint('Teacher Profile', 'GET', '/api/teacher/profile', null, 200, teacherToken);
    await testEndpoint('Teacher Classes', 'GET', '/api/teacher/classes', null, 200, teacherToken);
    await testEndpoint('Teacher Homework Stats', 'GET', '/api/homework/teacher/stats', null, 200, teacherToken);
  }

  // 8. Test Public Endpoints
  console.log('\n🌐 Testing Public Endpoints...\n');
  
  await testEndpoint('Children List', 'GET', '/api/children');
  await testEndpoint('Classes List', 'GET', '/api/classes');

  // 9. Test Parent Registration
  console.log('\n👨‍👩‍👧‍👦 Testing Parent Endpoints...\n');
  
  const randomEmail = `test-parent-${Date.now()}@test.com`;
  const parentRegResult = await testEndpoint(
    'Parent Registration',
    'POST',
    '/api/auth/parent/register',
    {
      name: 'Test Parent',
      email: randomEmail,
      password: 'TestPassword123!'
    },
    201
  );

  let parentToken = null;
  if (parentRegResult?.accessToken) {
    parentToken = parentRegResult.accessToken;
    logTest('Parent Token Received', 'PASS', 'Token extracted successfully');
  }

  // 10. Test Parent Login
  if (parentToken) {
    const parentLoginResult = await testEndpoint(
      'Parent Login',
      'POST',
      '/api/auth/parent/login',
      {
        email: randomEmail,
        password: 'TestPassword123!'
      }
    );
  }

  // 11. Test WebSocket
  console.log('\n🔌 Testing WebSocket Connection...\n');
  await testWebSocket();

  // 12. Test File Upload Endpoints
  console.log('\n📁 Testing File Upload Endpoints...\n');
  
  // Test upload endpoint structure
  await testEndpoint('Upload Directory Check', 'GET', '/uploads', null, 404); // Should return 404 but endpoint should exist

  // 13. Test Error Handling
  console.log('\n❌ Testing Error Handling...\n');
  
  await testEndpoint('Invalid Endpoint', 'GET', '/api/nonexistent', null, 404);
  await testEndpoint('Unauthorized Access', 'GET', '/api/admin/dashboard', null, 401);
  await testEndpoint('Invalid Login', 'POST', '/api/auth/admin/login', {
    email: 'wrong@email.com',
    password: 'wrongpassword'
  }, 401);

  // Final Results
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Tests Passed: ${testResults.passed}`);
  console.log(`❌ Tests Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${Math.round((testResults.passed / (testResults.passed + testResults.failed)) * 100)}%`);
  
  if (testResults.failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.tests
      .filter(test => test.status === 'FAIL')
      .forEach(test => console.log(`   • ${test.name}: ${test.details}`));
  }

  console.log('\n🏁 Test Suite Complete');
  
  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Promise Rejection:', error.message);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  process.exit(1);
});

// Run the tests
runTests().catch((error) => {
  console.error('❌ Test suite failed:', error.message);
  process.exit(1);
}); 