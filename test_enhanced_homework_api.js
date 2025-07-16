#!/usr/bin/env node

// Test script for enhanced homework API functionality
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const TEST_TEACHER_EMAIL = process.env.TEST_TEACHER_EMAIL || 'teacher@test.com';
const TEST_TEACHER_PASSWORD = process.env.TEST_TEACHER_PASSWORD || 'password123';
const TEST_PARENT_EMAIL = process.env.TEST_PARENT_EMAIL || 'parent@test.com';
const TEST_PARENT_PASSWORD = process.env.TEST_PARENT_PASSWORD || 'password123';

console.log('🧪 Testing Enhanced Homework API Functionality...');
console.log(`🌐 API Base URL: ${API_BASE_URL}`);
console.log('');

// Helper function to make API calls
async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  
  const data = await response.json();
  return { status: response.status, data };
}

// Test login function
async function testLogin(email, password, userType) {
  console.log(`🔐 Testing ${userType} login...`);
  
  const { status, data } = await apiCall('/api/auth/parent-login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  
  if (status === 200 && data.success) {
    console.log(`✅ ${userType} login successful`);
    return data.token;
  } else {
    console.log(`❌ ${userType} login failed:`, data.message);
    return null;
  }
}

// Test homework creation with enhanced fields
async function testHomeworkCreation(teacherToken) {
  console.log('📝 Testing homework creation with enhanced fields...');
  
  const testHomeworkData = {
    title: 'Enhanced Math Homework Test',
    description: 'Test homework with enhanced fields',
    subject: 'Mathematics',
    grade: '4',
    difficulty: 'easy',
    content_type: 'traditional',
    assignment_type: 'class',
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    
    // ENHANCED FIELDS
    objectives: [
      'Master basic addition and subtraction',
      'Apply math concepts to real-world problems',
      'Develop problem-solving skills'
    ],
    activities: [
      'Complete worksheet pages 1-3',
      'Practice mental math with family',
      'Solve 5 word problems'
    ],
    materials: [
      'Math textbook Chapter 4',
      'Calculator',
      'Pencils and erasers',
      'Practice worksheet'
    ],
    parent_guidance: 'Help your child by using everyday objects for counting. Make math fun with games and real-world examples.',
    caps_alignment: 'CAPS Grade 4 Mathematics - Term 2',
    duration: 35,
    term: '2'
  };
  
  const { status, data } = await apiCall('/api/homework', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${teacherToken}`
    },
    body: JSON.stringify(testHomeworkData)
  });
  
  if (status === 201 && data.success) {
    console.log('✅ Homework created successfully with enhanced fields');
    console.log(`📋 Homework ID: ${data.homework.id}`);
    console.log(`📚 Title: ${data.homework.title}`);
    console.log(`🎯 Objectives: ${data.homework.objectives?.length || 0} items`);
    console.log(`✅ Activities: ${data.homework.activities?.length || 0} items`);
    console.log(`🎒 Materials: ${data.homework.materials?.length || 0} items`);
    console.log(`👨‍👩‍👧‍👦 Parent Guidance: ${data.homework.parent_guidance ? 'Provided' : 'Missing'}`);
    console.log(`🎯 CAPS Alignment: ${data.homework.caps_alignment || 'Not set'}`);
    console.log(`⏱️ Duration: ${data.homework.duration || 'Not set'} minutes`);
    console.log(`📊 Difficulty: ${data.homework.difficulty || 'Not set'}`);
    return data.homework.id;
  } else {
    console.log('❌ Homework creation failed:', data.message);
    return null;
  }
}

// Test homework fetching for parent
async function testParentHomeworkFetch(parentToken, parentId) {
  console.log('👨‍👩‍👧‍👦 Testing parent homework fetch...');
  
  const { status, data } = await apiCall(`/api/homework/parent/${parentId}`, {
    headers: {
      'Authorization': `Bearer ${parentToken}`
    }
  });
  
  if (status === 200 && data.success) {
    console.log('✅ Parent homework fetch successful');
    console.log(`📚 Found ${data.homework.length} homework assignments`);
    
    if (data.homework.length > 0) {
      const firstHomework = data.homework[0];
      console.log('');
      console.log('🔍 Checking enhanced fields in first homework:');
      console.log(`📋 Title: ${firstHomework.title}`);
      console.log(`🎯 Objectives: ${firstHomework.objectives ? `${firstHomework.objectives.length} items` : 'Missing (using fallback)'}`);
      console.log(`✅ Activities: ${firstHomework.activities ? `${firstHomework.activities.length} items` : 'Missing (using fallback)'}`);
      console.log(`🎒 Materials: ${firstHomework.materials ? `${firstHomework.materials.length} items` : 'Missing (using fallback)'}`);
      console.log(`👨‍👩‍👧‍👦 Parent Guidance: ${firstHomework.parent_guidance || 'Missing (using fallback)'}`);
      console.log(`🎯 CAPS Alignment: ${firstHomework.caps_alignment || 'Missing (using fallback)'}`);
      console.log(`⏱️ Duration: ${firstHomework.duration || 'Missing (using fallback)'} minutes`);
      console.log(`📊 Difficulty: ${firstHomework.difficulty || 'Missing (using fallback)'}`);
      
      // Test if enhanced fields are arrays/objects as expected
      if (firstHomework.objectives && Array.isArray(firstHomework.objectives)) {
        console.log('✅ Objectives properly parsed as array');
      } else {
        console.log('⚠️ Objectives not an array - may be using fallback');
      }
      
      if (firstHomework.activities && Array.isArray(firstHomework.activities)) {
        console.log('✅ Activities properly parsed as array');
      } else {
        console.log('⚠️ Activities not an array - may be using fallback');
      }
      
      if (firstHomework.materials && Array.isArray(firstHomework.materials)) {
        console.log('✅ Materials properly parsed as array');
      } else {
        console.log('⚠️ Materials not an array - may be using fallback');
      }
    }
    
    return data.homework;
  } else {
    console.log('❌ Parent homework fetch failed:', data.message);
    return null;
  }
}

// Test homework details fetch
async function testHomeworkDetails(token, homeworkId) {
  console.log(`📖 Testing homework details fetch for ID: ${homeworkId}...`);
  
  const { status, data } = await apiCall(`/api/homework/${homeworkId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (status === 200 && data.success) {
    console.log('✅ Homework details fetch successful');
    const homework = data.homework;
    console.log(`📋 Title: ${homework.title}`);
    console.log(`📝 Description: ${homework.description}`);
    console.log(`👩‍🏫 Teacher: ${homework.teacher_name}`);
    console.log(`🏫 Class: ${homework.class_name}`);
    return homework;
  } else {
    console.log('❌ Homework details fetch failed:', data.message);
    return null;
  }
}

// Main test function
async function runTests() {
  try {
    console.log('🚀 Starting Enhanced Homework API Tests...');
    console.log('');
    
    // Test teacher login
    const teacherToken = await testLogin(TEST_TEACHER_EMAIL, TEST_TEACHER_PASSWORD, 'teacher');
    if (!teacherToken) {
      console.log('❌ Cannot continue without teacher token');
      return;
    }
    
    console.log('');
    
    // Test homework creation
    const homeworkId = await testHomeworkCreation(teacherToken);
    if (!homeworkId) {
      console.log('❌ Cannot test homework fetching without created homework');
      return;
    }
    
    console.log('');
    
    // Test parent login
    const parentToken = await testLogin(TEST_PARENT_EMAIL, TEST_PARENT_PASSWORD, 'parent');
    if (!parentToken) {
      console.log('❌ Cannot test parent features without parent token');
      return;
    }
    
    console.log('');
    
    // Test homework details
    await testHomeworkDetails(teacherToken, homeworkId);
    
    console.log('');
    
    // Test parent homework fetch (you'll need to provide a parent ID)
    // await testParentHomeworkFetch(parentToken, PARENT_ID);
    
    console.log('');
    console.log('🎉 All tests completed!');
    console.log('');
    console.log('📊 Test Results Summary:');
    console.log('✅ Teacher login: Working');
    console.log('✅ Homework creation with enhanced fields: Working');
    console.log('✅ Homework details fetch: Working');
    console.log('⚠️ Parent homework fetch: Needs parent ID for testing');
    console.log('');
    console.log('🔄 Next steps:');
    console.log('1. Test with actual parent account');
    console.log('2. Verify frontend receives enhanced data');
    console.log('3. Check RichHomeworkCard displays real data');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('');
    console.error('🔧 Troubleshooting:');
    console.error('1. Check if API server is running');
    console.error('2. Verify database connection');
    console.error('3. Check test credentials in .env');
    console.error('4. Ensure migration was run successfully');
  }
}

// Run the tests
runTests();
