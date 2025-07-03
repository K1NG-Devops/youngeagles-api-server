/**
 * API Endpoints Test Script
 * Tests all implemented endpoints according to the API documentation
 */

import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

const BASE_URL = 'http://localhost:3001';
let authToken = '';

// Test results tracker
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(testName, status, response = null, error = null) {
  const result = {
    test: testName,
    status,
    response: response ? response.data || response : null,
    error: error ? error.message : null
  };
  
  results.tests.push(result);
  
  if (status === 'PASS') {
    results.passed++;
    console.log(`✅ ${testName}`);
  } else {
    results.failed++;
    console.log(`❌ ${testName}`);
    if (error) console.log(`   Error: ${error.message}`);
  }
}

async function runTests() {
  console.log('🚀 Starting API Endpoint Tests\n');
  
  // Test 1: Health Check
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    logTest('Health Check', response.status === 200 ? 'PASS' : 'FAIL', response);
  } catch (error) {
    logTest('Health Check', 'FAIL', null, error);
  }

  // Test 2: Admin Login
  try {
    const response = await axios.post(`${BASE_URL}/api/auth/admin-login`, {
      username: 'admin@youngeagles.org.za',
      password: '#Admin@2012'
    });
    if (response.data.success && response.data.token) {
      authToken = response.data.token;
      logTest('Admin Login', 'PASS', response);
    } else {
      logTest('Admin Login', 'FAIL', response);
    }
  } catch (error) {
    logTest('Admin Login', 'FAIL', null, error);
  }

  // Test 3: Parent Login (test with dummy data)
  try {
    const response = await axios.post(`${BASE_URL}/api/auth/parent-login`, {
      username: 'parent@test.com',
      password: 'password123'
    });
    logTest('Parent Login', response.status === 401 ? 'PASS' : 'FAIL', response); // Should fail with 401
  } catch (error) {
    if (error.response && error.response.status === 401) {
      logTest('Parent Login (Expected 401)', 'PASS');
    } else {
      logTest('Parent Login', 'FAIL', null, error);
    }
  }

  // Test 4: Teacher Login (test with dummy data)
  try {
    const response = await axios.post(`${BASE_URL}/api/auth/teacher-login`, {
      username: 'teacher@test.com',
      password: 'password123'
    });
    logTest('Teacher Login', response.status === 401 ? 'PASS' : 'FAIL', response); // Should fail with 401
  } catch (error) {
    if (error.response && error.response.status === 401) {
      logTest('Teacher Login (Expected 401)', 'PASS');
    } else {
      logTest('Teacher Login', 'FAIL', null, error);
    }
  }

  if (!authToken) {
    console.log('⚠️ No auth token available. Skipping authenticated endpoint tests.');
    return printResults();
  }

  const authHeaders = { Authorization: `Bearer ${authToken}` };

  // Test 5: Get All Children
  try {
    const response = await axios.get(`${BASE_URL}/api/children`, { headers: authHeaders });
    logTest('Get All Children', response.data.success ? 'PASS' : 'FAIL', response);
  } catch (error) {
    logTest('Get All Children', 'FAIL', null, error);
  }

  // Test 6: Get All Classes
  try {
    const response = await axios.get(`${BASE_URL}/api/classes`, { headers: authHeaders });
    logTest('Get All Classes', response.data.success ? 'PASS' : 'FAIL', response);
  } catch (error) {
    logTest('Get All Classes', 'FAIL', null, error);
  }

  // Test 7: Get Children by Parent (with test parent ID)
  try {
    const response = await axios.get(`${BASE_URL}/api/children/parent/1`, { headers: authHeaders });
    logTest('Get Children by Parent', response.data.success ? 'PASS' : 'FAIL', response);
  } catch (error) {
    logTest('Get Children by Parent', 'FAIL', null, error);
  }

  // Test 8: Get Children by Class (with test class)
  try {
    const response = await axios.get(`${BASE_URL}/api/classes/Pandas/children`, { headers: authHeaders });
    logTest('Get Children by Class', response.data.success ? 'PASS' : 'FAIL', response);
  } catch (error) {
    logTest('Get Children by Class', 'FAIL', null, error);
  }

  // Test 9: Create Homework
  try {
    const response = await axios.post(`${BASE_URL}/api/homework`, {
      title: 'Test Homework Assignment',
      description: 'This is a test homework assignment',
      due_date: '2024-12-31',
      classId: 'Pandas'
    }, { headers: authHeaders });
    logTest('Create Homework', response.data.success ? 'PASS' : 'FAIL', response);
  } catch (error) {
    logTest('Create Homework', 'FAIL', null, error);
  }

  // Test 10: Get Homework by Teacher
  try {
    const response = await axios.get(`${BASE_URL}/api/homework/teacher/1`, { headers: authHeaders });
    logTest('Get Homework by Teacher', response.data.success ? 'PASS' : 'FAIL', response);
  } catch (error) {
    logTest('Get Homework by Teacher', 'FAIL', null, error);
  }

  // Test 11: Get Homework by Class
  try {
    const response = await axios.get(`${BASE_URL}/api/homework/class/Pandas`, { headers: authHeaders });
    logTest('Get Homework by Class', response.data.success ? 'PASS' : 'FAIL', response);
  } catch (error) {
    logTest('Get Homework by Class', 'FAIL', null, error);
  }

  // Test 12: Get Homework for Child
  try {
    const response = await axios.get(`${BASE_URL}/api/homework/child/1`, { headers: authHeaders });
    logTest('Get Homework for Child', response.data.success ? 'PASS' : 'FAIL', response);
  } catch (error) {
    logTest('Get Homework for Child', 'FAIL', null, error);
  }

  // Test 13: Upload File
  try {
    const formData = new FormData();
    // Create a test file
    const testContent = 'This is a test file for homework submission.';
    fs.writeFileSync('test-file.txt', testContent);
    formData.append('file', fs.createReadStream('test-file.txt'));
    
    const response = await axios.post(`${BASE_URL}/api/homework/upload`, formData, {
      headers: {
        ...authHeaders,
        ...formData.getHeaders()
      }
    });
    logTest('Upload File', response.data.success ? 'PASS' : 'FAIL', response);
    
    // Clean up test file
    fs.unlinkSync('test-file.txt');
  } catch (error) {
    logTest('Upload File', 'FAIL', null, error);
  }

  // Test 14: Test unauthorized access
  try {
    const response = await axios.get(`${BASE_URL}/api/children`);
    logTest('Unauthorized Access', 'FAIL', response); // Should fail
  } catch (error) {
    if (error.response && error.response.status === 401) {
      logTest('Unauthorized Access (Expected 401)', 'PASS');
    } else {
      logTest('Unauthorized Access', 'FAIL', null, error);
    }
  }

  printResults();
}

function printResults() {
  console.log('\n📊 Test Results Summary:');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Total: ${results.passed + results.failed}`);
  console.log(`🎯 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%\n`);
  
  if (results.failed > 0) {
    console.log('❌ Failed Tests:');
    results.tests
      .filter(test => test.status === 'FAIL')
      .forEach(test => {
        console.log(`   - ${test.test}: ${test.error || 'Unknown error'}`);
      });
  }
}

// Check if server is running
async function checkServer() {
  try {
    await axios.get(`${BASE_URL}/health`);
    console.log('✅ Server is running. Starting tests...\n');
    return true;
  } catch (error) {
    console.log('❌ Server is not running. Please start the server first.');
    console.log(`   Expected server at: ${BASE_URL}`);
    return false;
  }
}

// Main execution
async function main() {
  console.log('🔍 Young Eagles API Endpoint Tests');
  console.log('====================================\n');
  
  const serverRunning = await checkServer();
  if (serverRunning) {
    await runTests();
  }
}

main().catch(console.error); 