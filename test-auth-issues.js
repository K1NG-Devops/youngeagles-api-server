#!/usr/bin/env node

import axios from 'axios';

const BASE_URL = 'https://youngeagles-api-server.up.railway.app';

console.log('🔍 Testing Authentication Issues');
console.log('='.repeat(50));

async function testTeacherLogin() {
  console.log('\n👩‍🏫 Testing Teacher Login...');
  
  try {
    const response = await axios.post(`${BASE_URL}/api/auth/teacher-login`, {
      email: 'teacher@youngeagles.org.za',
      password: 'Teacher@123'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Teacher login successful!');
    console.log('📋 Response:', JSON.stringify(response.data, null, 2));
    return response.data.accessToken;
    
  } catch (error) {
    console.log('❌ Teacher login failed');
    console.log('📋 Status:', error.response?.status);
    console.log('📋 Error:', error.response?.data);
    return null;
  }
}

async function testAdminLogin() {
  console.log('\n👨‍💼 Testing Admin Login...');
  
  try {
    const response = await axios.post(`${BASE_URL}/api/auth/admin-login`, {
      email: 'admin@youngeagles.org.za',
      password: '#Admin@2012'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Admin login successful!');
    console.log('📋 Response:', JSON.stringify(response.data, null, 2));
    return response.data.accessToken;
    
  } catch (error) {
    console.log('❌ Admin login failed');
    console.log('📋 Status:', error.response?.status);
    console.log('📋 Error:', error.response?.data);
    return null;
  }
}

async function testFirebaseLogin() {
  console.log('\n🔥 Testing Firebase Login (simulated)...');
  
  // Test different payload formats to see what the frontend might be sending
  const testPayloads = [
    {
      name: 'Standard Firebase Format',
      data: {
        idToken: 'mock-firebase-token-12345',
        email: 'oliviamakunyane@gmail.com',
        name: 'Olivia Makunyane',
        uid: 'firebase-uid-123'
      }
    },
    {
      name: 'Alternative Token Field',
      data: {
        token: 'mock-firebase-token-12345',
        email: 'oliviamakunyane@gmail.com',
        name: 'Olivia Makunyane'
      }
    },
    {
      name: 'Frontend Likely Format',
      data: {
        firebaseToken: 'mock-firebase-token-12345',
        user_email: 'oliviamakunyane@gmail.com',
        user_name: 'Olivia Makunyane'
      }
    }
  ];
  
  for (const test of testPayloads) {
    console.log(`\n🧪 Testing ${test.name}...`);
    
    try {
      const response = await axios.post(`${BASE_URL}/api/auth/firebase-login`, test.data, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Firebase login successful!');
      console.log('📋 Response:', JSON.stringify(response.data, null, 2));
      return response.data.accessToken;
      
    } catch (error) {
      console.log('❌ Firebase login failed');
      console.log('📋 Status:', error.response?.status);
      console.log('📋 Error:', JSON.stringify(error.response?.data, null, 2));
    }
  }
  
  return null;
}

async function testHealthCheck() {
  console.log('\n💓 Testing Health Check...');
  
  try {
    const response = await axios.get(`${BASE_URL}/api/health`);
    console.log('✅ Health check successful!');
    console.log('📋 Status:', response.data.status);
    console.log('📋 Database:', response.data.database);
  } catch (error) {
    console.log('❌ Health check failed');
    console.log('📋 Error:', error.message);
  }
}

async function runTests() {
  await testHealthCheck();
  
  const adminToken = await testAdminLogin();
  const teacherToken = await testTeacherLogin();
  await testFirebaseLogin();
  
  console.log('\n📊 Summary:');
  console.log('Admin Login:', adminToken ? '✅ Working' : '❌ Failed');
  console.log('Teacher Login:', teacherToken ? '✅ Working' : '❌ Failed');
  
  if (!teacherToken) {
    console.log('\n🔧 Possible fixes for teacher login:');
    console.log('1. Run: node seedTeacher.js');
    console.log('2. Check if teacher account exists in database');
    console.log('3. Verify password hashing is working correctly');
  }
  
  console.log('\n🔧 For Firebase login issues:');
  console.log('1. Check what fields the frontend is actually sending');
  console.log('2. The endpoint now supports multiple field name formats');
  console.log('3. Add console.log in frontend to see exact payload being sent');
}

runTests().catch(console.error); 