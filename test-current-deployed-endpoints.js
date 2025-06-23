#!/usr/bin/env node

import axios from 'axios';

const BASE_URL = 'https://youngeagles-api-server.up.railway.app';

console.log('🧪 Testing Currently Deployed Young Eagles API');
console.log(`🌐 API URL: ${BASE_URL}`);
console.log('='.repeat(60));

let testResults = { passed: 0, failed: 0, tests: [] };

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
        'Content-Type': 'application/json'
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

async function runTests() {
  console.log('\n📋 Testing Deployed Endpoints...\n');

  // 1. Health Check
  await testEndpoint('Health Check', 'GET', '/api/health');
  
  // 2. Root endpoint
  await testEndpoint('Root Endpoint', 'GET', '/');
  
  // 3. API Info
  await testEndpoint('API Info', 'GET', '/api');

  // 4. Test admin login with seeded credentials
  console.log('\n🔐 Testing Authentication...\n');
  
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

  // 5. Test teacher login
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

  // 6. Test token verification
  if (adminToken) {
    await testEndpoint('Admin Token Verification', 'GET', '/api/auth/verify', null, 200, adminToken);
  }

  if (teacherToken) {
    await testEndpoint('Teacher Token Verification', 'GET', '/api/auth/verify', null, 200, teacherToken);
  }

  // 7. Test admin endpoints
  if (adminToken) {
    console.log('\n🔐 Testing Admin Endpoints...\n');
    
    await testEndpoint('Admin Dashboard', 'GET', '/api/admin/dashboard', null, 200, adminToken);
    await testEndpoint('Admin Analytics', 'GET', '/api/admin/analytics', null, 200, adminToken);
    await testEndpoint('Admin Users List', 'GET', '/api/admin/users', null, 200, adminToken);
  }

  // 8. Test teacher endpoints
  if (teacherToken) {
    console.log('\n👩‍🏫 Testing Teacher Endpoints...\n');
    
    await testEndpoint('Teacher Profile', 'GET', '/api/teacher/profile', null, 200, teacherToken);
    await testEndpoint('Teacher Dashboard', 'GET', '/api/teacher/dashboard', null, 200, teacherToken);
    await testEndpoint('Teacher Classes', 'GET', '/api/teacher/classes', null, 200, teacherToken);
    await testEndpoint('Teacher Stats', 'GET', '/api/teacher/stats', null, 200, teacherToken);
  }

  // 9. Test specific homework endpoint that was failing
  if (teacherToken) {
    console.log('\n📚 Testing Homework Endpoints...\n');
    await testEndpoint('Teacher Homework Stats', 'GET', '/api/homework/teacher/stats', null, 200, teacherToken);
  }

  // 10. Test error handling
  console.log('\n❌ Testing Error Handling...\n');
  
  await testEndpoint('Invalid Endpoint', 'GET', '/api/nonexistent', null, 404);
  await testEndpoint('Unauthorized Access', 'GET', '/api/admin/dashboard', null, 401);

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

  console.log('\n🚀 Recommendations:');
  if (testResults.tests.some(t => t.name.includes('Database Health Check') && t.status === 'FAIL')) {
    console.log('   • Deploy latest code to enable database health endpoint');
  }
  if (testResults.tests.some(t => t.name.includes('WebSocket') && t.status === 'FAIL')) {
    console.log('   • Deploy latest code to enable WebSocket functionality');
  }
  if (testResults.tests.some(t => t.name.includes('Admin Login') && t.status === 'FAIL')) {
    console.log('   • Run seeding scripts to create admin/teacher accounts');
  }

  console.log('\n🏁 Test Complete');
  
  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

runTests().catch((error) => {
  console.error('❌ Test suite failed:', error.message);
  process.exit(1);
}); 