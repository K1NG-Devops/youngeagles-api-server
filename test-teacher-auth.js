#!/usr/bin/env node

import https from 'https';

const API_BASE_URL = 'https://youngeagles-api-server.up.railway.app';

// Test teacher credentials from the database
const teacherCredentials = {
  email: 'teacher@youngeagles.org.za',
  password: 'Teacher@123'
};

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Teacher Auth Test',
        ...options.headers
      }
    };

    console.log(`🔍 ${options.method || 'GET'} ${url}`);
    
    const req = https.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function testTeacherAuth() {
  console.log('🧪 Testing Teacher Authentication & Profile');
  console.log('==========================================');
  
  try {
    // Step 1: Teacher Login
    console.log('\n1️⃣ Teacher Login');
    const loginResponse = await makeRequest(`${API_BASE_URL}/api/auth/teacher-login`, {
      method: 'POST',
      body: teacherCredentials
    });
    
    console.log(`   Status: ${loginResponse.status}`);
    if (loginResponse.status === 200) {
      console.log('   ✅ Login successful!');
      console.log(`   👤 Teacher: ${loginResponse.data.user?.name}`);
      console.log(`   🔑 Token: ${loginResponse.data.accessToken ? 'Generated' : 'Missing'}`);
      
      const token = loginResponse.data.accessToken;
      
      if (token) {
        // Step 2: Test Teacher Profile with Token
        console.log('\n2️⃣ Teacher Profile');
        const profileResponse = await makeRequest(`${API_BASE_URL}/api/teacher/profile`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        console.log(`   Status: ${profileResponse.status}`);
        if (profileResponse.status === 200) {
          console.log('   ✅ Profile retrieved successfully!');
          console.log('   📄 Profile Data:');
          console.log(`      Name: ${profileResponse.data.teacher?.name}`);
          console.log(`      Email: ${profileResponse.data.teacher?.email}`);
          console.log(`      Verified: ${profileResponse.data.teacher?.isVerified}`);
          console.log(`      Classes: ${profileResponse.data.stats?.totalClasses}`);
          console.log(`      Students: ${profileResponse.data.stats?.totalStudents}`);
        } else {
          console.log('   ❌ Profile request failed');
          console.log(`   📄 Response: ${JSON.stringify(profileResponse.data).substring(0, 200)}`);
        }
        
        // Step 3: Test other teacher endpoints
        console.log('\n3️⃣ Other Teacher Endpoints');
        const endpoints = [
          '/api/teacher/dashboard',
          '/api/teacher/classes',
          '/api/teacher/stats'
        ];
        
        for (const endpoint of endpoints) {
          const response = await makeRequest(`${API_BASE_URL}${endpoint}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          console.log(`   ${endpoint}: ${response.status} ${response.status === 200 ? '✅' : '❌'}`);
        }
        
      } else {
        console.log('   ❌ No token received from login');
      }
      
    } else {
      console.log('   ❌ Login failed');
      console.log(`   📄 Response: ${JSON.stringify(loginResponse.data)}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testTeacherAuth().then(() => {
  console.log('\n🎉 Test completed!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
}); 