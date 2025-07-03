/**
 * Test script for Attendance API endpoints
 * Run with: node test-attendance-endpoints.js
 */

import axios from 'axios';

const API_BASE = 'http://localhost:3001/api';

// Test configuration
const testConfig = {
  // You'll need to replace this with a valid teacher JWT token
  teacherToken: 'your_teacher_jwt_token_here',
  testDate: new Date().toISOString().split('T')[0], // Today's date
  testChildId: 1 // Assuming child ID 1 exists
};

console.log('🧪 Testing Attendance API Endpoints\n');
console.log(`📅 Test Date: ${testConfig.testDate}`);
console.log(`👨‍🏫 Using teacher token: ${testConfig.teacherToken.substring(0, 20)}...`);
console.log(`👶 Test Child ID: ${testConfig.testChildId}\n`);

// Helper function to make authenticated requests
const makeRequest = async (method, endpoint, data = null) => {
  try {
    const config = {
      method,
      url: `${API_BASE}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${testConfig.teacherToken}`,
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status || 500
    };
  }
};

// Test 1: Get today's attendance
async function testGetTodayAttendance() {
  console.log('📋 Test 1: Get Today\'s Attendance');
  console.log('GET /api/attendance/class');
  
  const result = await makeRequest('GET', '/attendance/class');
  
  if (result.success) {
    console.log('✅ Success!');
    console.log(`   Class: ${result.data.className}`);
    console.log(`   Students: ${result.data.totalStudents}`);
    console.log(`   Stats: Present: ${result.data.attendanceStats?.present || 0}, Absent: ${result.data.attendanceStats?.absent || 0}, Late: ${result.data.attendanceStats?.late || 0}, Unmarked: ${result.data.attendanceStats?.unmarked || 0}`);
  } else {
    console.log('❌ Failed!');
    console.log(`   Status: ${result.status}`);
    console.log(`   Error: ${JSON.stringify(result.error, null, 2)}`);
  }
  
  console.log('');
  return result;
}

// Test 2: Mark individual attendance
async function testMarkAttendance() {
  console.log('✏️ Test 2: Mark Individual Attendance');
  console.log('POST /api/attendance/mark');
  
  const requestData = {
    childId: testConfig.testChildId,
    date: testConfig.testDate,
    status: 'present',
    notes: 'Test attendance marking'
  };
  
  console.log(`   Request: ${JSON.stringify(requestData, null, 2)}`);
  
  const result = await makeRequest('POST', '/attendance/mark', requestData);
  
  if (result.success) {
    console.log('✅ Success!');
    console.log(`   Message: ${result.data.message}`);
    console.log(`   Student: ${result.data.data?.childName}`);
    console.log(`   Status: ${result.data.data?.status}`);
  } else {
    console.log('❌ Failed!');
    console.log(`   Status: ${result.status}`);
    console.log(`   Error: ${JSON.stringify(result.error, null, 2)}`);
  }
  
  console.log('');
  return result;
}

// Test 3: Bulk mark attendance
async function testBulkMarkAttendance() {
  console.log('📝 Test 3: Bulk Mark Attendance');
  console.log('POST /api/attendance/bulk-mark');
  
  const requestData = {
    date: testConfig.testDate,
    attendanceRecords: [
      {
        childId: testConfig.testChildId,
        status: 'present',
        notes: 'Bulk test - present'
      }
      // Add more students if you have their IDs
    ]
  };
  
  console.log(`   Request: ${JSON.stringify(requestData, null, 2)}`);
  
  const result = await makeRequest('POST', '/attendance/bulk-mark', requestData);
  
  if (result.success) {
    console.log('✅ Success!');
    console.log(`   Processed: ${result.data.summary?.total || 0} records`);
    console.log(`   Successful: ${result.data.summary?.successful || 0}`);
    console.log(`   Failed: ${result.data.summary?.failed || 0}`);
  } else {
    console.log('❌ Failed!');
    console.log(`   Status: ${result.status}`);
    console.log(`   Error: ${JSON.stringify(result.error, null, 2)}`);
  }
  
  console.log('');
  return result;
}

// Test 4: Get attendance history
async function testGetAttendanceHistory() {
  console.log('📊 Test 4: Get Attendance History');
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7); // 7 days ago
  const endDate = new Date();
  
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];
  
  console.log(`GET /api/attendance/history/${startDateStr}/${endDateStr}`);
  
  const result = await makeRequest('GET', `/attendance/history/${startDateStr}/${endDateStr}`);
  
  if (result.success) {
    console.log('✅ Success!');
    console.log(`   Class: ${result.data.className}`);
    console.log(`   Records: ${result.data.totalRecords}`);
    console.log(`   Date Range: ${result.data.startDate} to ${result.data.endDate}`);
  } else {
    console.log('❌ Failed!');
    console.log(`   Status: ${result.status}`);
    console.log(`   Error: ${JSON.stringify(result.error, null, 2)}`);
  }
  
  console.log('');
  return result;
}

// Test 5: Get attendance statistics
async function testGetAttendanceStats() {
  console.log('📈 Test 5: Get Attendance Statistics');
  
  const currentMonth = new Date().toISOString().substr(0, 7); // YYYY-MM
  console.log(`GET /api/attendance/stats/${currentMonth}`);
  
  const result = await makeRequest('GET', `/attendance/stats/${currentMonth}`);
  
  if (result.success) {
    console.log('✅ Success!');
    console.log(`   Class: ${result.data.className}`);
    console.log(`   Month: ${result.data.month}`);
    console.log(`   Students: ${result.data.classStats?.totalStudents || 0}`);
    console.log(`   Average Attendance Rate: ${result.data.classStats?.averageAttendanceRate || 0}%`);
  } else {
    console.log('❌ Failed!');
    console.log(`   Status: ${result.status}`);
    console.log(`   Error: ${JSON.stringify(result.error, null, 2)}`);
  }
  
  console.log('');
  return result;
}

// Run all tests
async function runAllTests() {
  if (testConfig.teacherToken === 'your_teacher_jwt_token_here') {
    console.log('⚠️ Please update the teacherToken in testConfig before running tests');
    console.log('💡 You can get a teacher token by logging in through /api/auth/login with teacher credentials');
    return;
  }

  console.log('🚀 Starting Attendance API Tests...\n');
  
  const results = {
    getTodayAttendance: await testGetTodayAttendance(),
    markAttendance: await testMarkAttendance(),
    bulkMarkAttendance: await testBulkMarkAttendance(),
    getAttendanceHistory: await testGetAttendanceHistory(),
    getAttendanceStats: await testGetAttendanceStats()
  };
  
  // Summary
  console.log('📋 Test Results Summary:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  Object.entries(results).forEach(([testName, result]) => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${testName}`);
  });
  
  const passedTests = Object.values(results).filter(r => r.success).length;
  const totalTests = Object.keys(results).length;
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 Results: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All attendance API endpoints are working correctly!');
  } else {
    console.log('⚠️ Some tests failed. Check the error messages above.');
  }
}

// Test individual endpoints
async function testBasicEndpoints() {
  console.log('🧪 Testing Basic Endpoint Availability...\n');
  
  // Test server health
  try {
    const healthResponse = await axios.get(`${API_BASE.replace('/api', '')}/health`);
    console.log('✅ Server is running');
    console.log(`   Status: ${healthResponse.data.status}`);
    console.log(`   Service: ${healthResponse.data.service}`);
  } catch (error) {
    console.log('❌ Server is not responding');
    console.log(`   Error: ${error.message}`);
    return;
  }
  
  // Test API health
  try {
    const apiHealthResponse = await axios.get(`${API_BASE}/health`);
    console.log('✅ API endpoints are available');
  } catch (error) {
    console.log('❌ API endpoints are not available');
    console.log(`   Error: ${error.message}`);
  }
  
  console.log('');
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  testBasicEndpoints().then(() => {
    runAllTests().catch(console.error);
  });
}

export { testGetTodayAttendance, testMarkAttendance, testBulkMarkAttendance, testGetAttendanceHistory, testGetAttendanceStats };
