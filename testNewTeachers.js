import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001';

// Test data for the new teachers
const teachers = [
  {
    name: 'Dimakatso Mogashoa',
    email: 'dimakatso.mogashoa@youngeagles.org.za',
    password: '#Katso@yehc103',
    className: 'Panad Class'
  },
  {
    name: 'Seipati Kgalema', 
    email: 'seipati.kgalema@youngeagles.org.za',
    password: '#Seipati@yehc102',
    className: 'Curious Cubs'
  }
];

async function testTeacherLogin(teacher) {
  try {
    console.log(`\n👩‍🏫 Testing login for: ${teacher.name}`);
    
    const response = await fetch(`${API_BASE}/api/auth/teacher/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: teacher.email,
        password: teacher.password
      })
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Login successful');
      console.log(`📧 Email: ${data.user.email}`);
      console.log(`👤 Name: ${data.user.name}`);
      console.log(`🏷️ Role: ${data.user.role}`);
      return data.accessToken;
    } else {
      console.log('❌ Login failed:', data.message);
      return null;
    }
  } catch (error) {
    console.log('❌ Login error:', error.message);
    return null;
  }
}

async function testTeacherProfile(token, teacherName) {
  try {
    console.log(`\n📋 Testing profile endpoint for: ${teacherName}`);
    
    const response = await fetch(`${API_BASE}/api/teacher/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Profile fetch successful');
      console.log(`👤 Name: ${data.profile?.name || 'N/A'}`);
      console.log(`📧 Email: ${data.profile?.email || 'N/A'}`);
      console.log(`🏫 Class: ${data.profile?.className || 'N/A'}`);
      console.log(`🎓 Qualification: ${data.profile?.qualification || 'N/A'}`);
      console.log(`🔬 Specialization: ${data.profile?.specialization || 'N/A'}`);
    } else {
      console.log('❌ Profile fetch failed:', data.message);
    }
  } catch (error) {
    console.log('❌ Profile error:', error.message);
  }
}

async function testProfileUpdate(token, teacherName) {
  try {
    console.log(`\n🔧 Testing profile update for: ${teacherName}`);
    
    const updateData = {
      name: teacherName,
      phone: '+27123456789',
      bio: 'Updated bio via API test',
      experience_years: 5,
      emergency_contact_name: 'Emergency Contact',
      emergency_contact_phone: '+27987654321'
    };
    
    const response = await fetch(`${API_BASE}/api/teacher/profile`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData)
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Profile update successful');
      console.log(`📱 Phone: ${data.profile?.phone || 'N/A'}`);
      console.log(`📝 Bio: ${data.profile?.bio || 'N/A'}`);
      console.log(`📅 Experience: ${data.profile?.experience_years || 'N/A'} years`);
    } else {
      console.log('❌ Profile update failed:', data.message);
    }
  } catch (error) {
    console.log('❌ Profile update error:', error.message);
  }
}

async function runTests() {
  console.log('🧪 Starting teacher authentication and profile tests...');
  console.log('='.repeat(60));
  
  for (const teacher of teachers) {
    // Test login
    const token = await testTeacherLogin(teacher);
    
    if (token) {
      // Test profile fetch
      await testTeacherProfile(token, teacher.name);
      
      // Test profile update
      await testProfileUpdate(token, teacher.name);
    }
    
    console.log('-'.repeat(60));
  }
  
  console.log('\n🎉 All tests completed!');
}

// Run tests
runTests().catch(console.error);
