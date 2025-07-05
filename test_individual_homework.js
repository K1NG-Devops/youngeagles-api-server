import axios from 'axios';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();
// Database connection configuration
const dbConfig = {
  host: 'shuttle.proxy.rlwy.net',
  port: 49263,
  user: 'root',
  password: 'fhdgRvbocRQKcikxGTNsQUHVIMizngLb',
  database: 'skydek_DB',
  ssl: false
};

async function testIndividualHomeworkCreation() {
  let connection;
  
  try {
    // Connect to database
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected to database');
    
    // Get Daniel Baker's information
    const [children] = await connection.execute(
      'SELECT id, first_name, last_name, class_id FROM children WHERE first_name = ? AND last_name = ?',
      ['Daniel', 'Baker']
    );
    
    if (children.length === 0) {
      console.log('Daniel Baker not found in database');
      return;
    }
    
    const daniel = children[0];
    console.log('Found Daniel Baker:', daniel);
    
    // Get his class information
    const [classes] = await connection.execute(
      'SELECT id, class_name FROM classes WHERE id = ?',
      [daniel.class_id]
    );
    
    if (classes.length === 0) {
      console.log('Class not found for Daniel Baker');
      return;
    }
    
    const danielClass = classes[0];
    console.log('Daniel\'s class:', danielClass);
    
    // Get teacher information (assuming we need teacher_id for homework creation)
    const [teachers] = await connection.execute(
      'SELECT id FROM teachers LIMIT 1'
    );
    
    if (teachers.length === 0) {
      console.log('No teachers found in database');
      return;
    }
    
    const teacher = teachers[0];
    console.log('Using teacher:', teacher);
    
    // Create individual homework assignment
    const homeworkData = {
      title: 'Test Individual Assignment for Daniel',
      description: 'This is a test individual homework assignment for Daniel Baker only',
      teacher_id: teacher.id,
      class_id: daniel.class_id,
      assignment_type: 'individual',
      selectedChildren: [daniel.id],
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
    };
    
    console.log('Creating homework with data:', homeworkData);
    
    // Make API call to create homework
    try {
      const response = await axios.post('http://localhost:3000/api/homework', homeworkData, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('API Response:', response.data);
      
      // Verify the homework was created correctly
      const [homework] = await connection.execute(
        'SELECT * FROM homework WHERE title = ? ORDER BY id DESC LIMIT 1',
        [homeworkData.title]
      );
      
      if (homework.length > 0) {
        const createdHomework = homework[0];
        console.log('Created homework in database:', createdHomework);
        
        // Check if individual assignment was created
        const [individualAssignments] = await connection.execute(
          'SELECT * FROM homework_individual_assignments WHERE homework_id = ?',
          [createdHomework.id]
        );
        
        console.log('Individual assignments created:', individualAssignments);
        
        // Verify assignment_type is set correctly
        if (createdHomework.assignment_type === 'individual') {
          console.log('✅ SUCCESS: Homework assignment_type is correctly set to "individual"');
        } else {
          console.log('❌ ERROR: Homework assignment_type is not set correctly. Expected "individual", got:', createdHomework.assignment_type);
        }
        
        // Verify class_id is set correctly
        if (createdHomework.class_id === daniel.class_id) {
          console.log('✅ SUCCESS: Homework class_id is correctly set to Daniel\'s class');
        } else {
          console.log('❌ ERROR: Homework class_id is not set correctly. Expected:', daniel.class_id, 'got:', createdHomework.class_id);
        }
        
        // Verify individual assignment exists
        if (individualAssignments.length > 0) {
          const assignment = individualAssignments.find(a => a.child_id === daniel.id);
          if (assignment) {
            console.log('✅ SUCCESS: Individual assignment created for Daniel Baker');
          } else {
            console.log('❌ ERROR: Individual assignment not found for Daniel Baker');
          }
        } else {
          console.log('❌ ERROR: No individual assignments created');
        }
        
      } else {
        console.log('❌ ERROR: Homework not found in database after creation');
      }
      
    } catch (apiError) {
      console.log('API Error:', apiError.response ? apiError.response.data : apiError.message);
    }
    
  } catch (error) {
    console.error('Database Error:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

// Run the test
testIndividualHomeworkCreation().catch(console.error);
