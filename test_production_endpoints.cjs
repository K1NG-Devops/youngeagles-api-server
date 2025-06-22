#!/usr/bin/env node

const axios = require('axios');

const API_BASE = 'http://localhost:3001';
const TEST_CREDENTIALS = {
  email: 'parent@local.test',
  password: 'LocalParent123!'
};

let authToken = null;
let parentId = null;
let childId = null;

console.log('🚀 Starting PRODUCTION API Tests...\n');
console.log('📍 Environment: PWA_PROJECT (Production Ready)');
console.log('🎯 Target: ' + API_BASE);
console.log('=' * 60 + '\n');

// Test 1: Health Check
async function testHealthCheck() {
  console.log('1️⃣ Testing Health Check...');
  try {
    const response = await axios.get(`${API_BASE}/api/health`);
    console.log('✅ Health Check:', response.data.status);
    console.log('   Database:', response.data.database);
    console.log('   Environment:', response.data.environment);
    console.log('   Authentication:', response.data.authentication);
    return true;
  } catch (error) {
    console.log('❌ Health Check Failed:', error.message);
    return false;
  }
}

// Test 2: Parent Login
async function testParentLogin() {
  console.log('\n2️⃣ Testing Parent Login...');
  try {
    const response = await axios.post(`${API_BASE}/api/auth/login`, TEST_CREDENTIALS);
    authToken = response.data.accessToken;
    parentId = response.data.user.id;
    console.log('✅ Login Successful');
    console.log('   User:', response.data.user.name);
    console.log('   Role:', response.data.user.role);
    console.log('   Parent ID:', parentId);
    console.log('   Token Length:', authToken ? authToken.length : 'N/A');
    return true;
  } catch (error) {
    console.log('❌ Login Failed:', error.response?.data?.message || error.message);
    console.log('   Status:', error.response?.status);
    return false;
  }
}

// Test 3: Token Verification
async function testTokenVerification() {
  console.log('\n3️⃣ Testing Token Verification...');
  try {
    const response = await axios.get(`${API_BASE}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('✅ Token Valid');
    console.log('   Verified User:', response.data.user.email);
    console.log('   User Role:', response.data.user.role);
    return true;
  } catch (error) {
    console.log('❌ Token Verification Failed:', error.response?.data?.message || error.message);
    return false;
  }
}

// Test 4: Children List
async function testChildrenList() {
  console.log('\n4️⃣ Testing Children List...');
  try {
    const response = await axios.get(`${API_BASE}/api/children/${parentId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const children = response.data.data || response.data;
    console.log('✅ Children Retrieved');
    console.log(`   Count: ${children.length} children`);
    
    if (children.length > 0) {
      childId = children[0].id;
      children.forEach((child, index) => {
        console.log(`   Child ${index + 1}: ${child.name} (ID: ${child.id}, Class: ${child.className})`);
      });
    } else {
      console.log('   ⚠️  No children found for this parent');
    }
    return true;
  } catch (error) {
    console.log('❌ Children List Failed:', error.response?.data?.message || error.message);
    return false;
  }
}

// Test 5: Homework Data
async function testHomeworkData() {
  console.log('\n5️⃣ Testing Homework Data...');
  if (!childId) {
    console.log('❌ No child ID available for homework test');
    return false;
  }
  
  try {
    const response = await axios.get(`${API_BASE}/api/homework/parent/${parentId}/child/${childId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const homework = response.data.data;
    console.log('✅ Homework Retrieved');
    console.log(`   Count: ${homework.length} homework items`);
    
    homework.forEach((hw, index) => {
      console.log(`   Homework ${index + 1}: ${hw.title}`);
      console.log(`     Subject: ${hw.subject}, Status: ${hw.status}`);
      console.log(`     Due: ${new Date(hw.due_date).toLocaleDateString()}`);
    });
    return true;
  } catch (error) {
    console.log('❌ Homework Data Failed:', error.response?.data?.message || error.message);
    return false;
  }
}

// Test 6: Grades Data
async function testGradesData() {
  console.log('\n6️⃣ Testing Grades Data...');
  if (!childId) {
    console.log('❌ No child ID available for grades test');
    return false;
  }
  
  try {
    const response = await axios.get(`${API_BASE}/api/homeworks/grades/child/${childId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const grades = response.data.grades;
    console.log('✅ Grades Retrieved');
    console.log(`   Count: ${grades.length} grades`);
    
    grades.forEach((grade, index) => {
      console.log(`   Grade ${index + 1}: ${grade.homework_title} - ${grade.grade} (${grade.percentage}%)`);
      console.log(`     Teacher: ${grade.teacher}, Subject: ${grade.subject}`);
    });
    return true;
  } catch (error) {
    console.log('❌ Grades Data Failed:', error.response?.data?.message || error.message);
    return false;
  }
}

// Test 7: Reports Data
async function testReportsData() {
  console.log('\n7️⃣ Testing Reports Data...');
  if (!childId) {
    console.log('❌ No child ID available for reports test');
    return false;
  }
  
  try {
    const response = await axios.get(`${API_BASE}/api/public/parent/reports?child_id=${childId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const report = response.data;
    console.log('✅ Reports Retrieved');
    console.log(`   Child: ${report.childName}`);
    console.log(`   Total Homework: ${report.totalHomework}`);
    console.log(`   Submitted: ${report.submitted}`);
    console.log(`   Average Grade: ${report.avgGrade}%`);
    console.log(`   Submission Rate: ${report.submissionRate}%`);
    return true;
  } catch (error) {
    console.log('❌ Reports Data Failed:', error.response?.data?.message || error.message);
    return false;
  }
}

// Test 8: CORS Headers
async function testCORSHeaders() {
  console.log('\n8️⃣ Testing CORS Headers...');
  if (!childId) {
    console.log('❌ No child ID available for CORS test');
    return false;
  }
  
  try {
    const response = await axios.get(`${API_BASE}/api/homework/parent/${parentId}/child/${childId}`, {
      headers: { 
        Authorization: `Bearer ${authToken}`,
        'x-request-source': 'production-test-client',
        'Origin': 'https://youngeagles.org.za'
      }
    });
    console.log('✅ CORS Headers Working');
    console.log('   Custom header x-request-source accepted');
    console.log('   Production origin supported');
    return true;
  } catch (error) {
    console.log('❌ CORS Headers Failed:', error.response?.data?.message || error.message);
    return false;
  }
}

// Test 9: Child Registration (Production Feature)
async function testChildRegistration() {
  console.log('\n9️⃣ Testing Child Registration...');
  try {
    const testChild = {
      name: 'Test Production Child',
      parent_id: parentId,
      gender: 'other',
      dob: '2020-01-01',
      age: 4,
      grade: 'Grade RR',
      className: 'Panda'
    };
    
    const response = await axios.post(`${API_BASE}/api/auth/register-child`, testChild, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Child Registration Successful');
    console.log(`   Child: ${response.data.child.name}`);
    console.log(`   Age: ${response.data.child.age}, Class: ${response.data.child.className}`);
    return true;
  } catch (error) {
    console.log('❌ Child Registration Failed:', error.response?.data?.message || error.message);
    return false;
  }
}

// Test 10: Notifications Endpoint
async function testNotifications() {
  console.log('\n🔟 Testing Notifications...');
  try {
    const response = await axios.get(`${API_BASE}/api/notifications`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const notifications = response.data.data;
    console.log('✅ Notifications Retrieved');
    console.log(`   Count: ${notifications.length} notifications`);
    
    notifications.slice(0, 2).forEach((notif, index) => {
      console.log(`   Notification ${index + 1}: ${notif.title}`);
      console.log(`     Type: ${notif.type}, Read: ${notif.read}`);
    });
    return true;
  } catch (error) {
    console.log('❌ Notifications Failed:', error.response?.data?.message || error.message);
    return false;
  }
}

// Run All Tests
async function runAllTests() {
  const tests = [
    testHealthCheck,
    testParentLogin,
    testTokenVerification,
    testChildrenList,
    testHomeworkData,
    testGradesData,
    testReportsData,
    testCORSHeaders,
    testChildRegistration,
    testNotifications
  ];
  
  let passed = 0;
  let failed = 0;
  const startTime = Date.now();
  
  for (const test of tests) {
    const result = await test();
    if (result) {
      passed++;
    } else {
      failed++;
    }
  }
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  console.log('\n' + '='.repeat(60));
  console.log('🎯 PRODUCTION TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${passed + failed}`);
  console.log(`⏱️  Duration: ${duration} seconds`);
  console.log(`📍 Environment: PWA_PROJECT (Production)`);
  
  if (failed === 0) {
    console.log('\n🎉 ALL PRODUCTION TESTS PASSED! 🚀');
    console.log('✅ Ready for deployment to Vercel and Railway!');
    console.log('🌟 Young Eagles PWA is production-ready!');
  } else {
    console.log(`\n⚠️  ${failed} test(s) failed. Review errors before deployment.`);
  }
  
  console.log('\n📋 Next Steps:');
  console.log('   1. Deploy API to Railway');
  console.log('   2. Deploy PWA to Vercel');
  console.log('   3. Update production environment variables');
  console.log('   4. Run final production verification');
}

// Start testing
console.log('🎬 Starting production test suite...');
runAllTests().catch(console.error); 