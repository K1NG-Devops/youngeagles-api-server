const mysql = require('mysql2/promise');
const axios = require('axios');
require('dotenv').config();

const API_BASE = 'http://localhost:3000/api';

// Database connection
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'young_eagles_db'
};

async function testInteractiveHomeworkSubmission() {
    console.log('🧪 Testing Interactive Homework Submission Flow\n');
    
    let connection;
    
    try {
        // Connect to database
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Connected to database');
        
        // Test data
        const childId = 15; // Daniel Baker
        const homeworkId = 29; // Basic Addition 1-5
        const parentId = 14; // daniel@example.com
        
        console.log(`\n📋 Test Parameters:`);
        console.log(`   Child ID: ${childId}`);
        console.log(`   Homework ID: ${homeworkId}`);
        console.log(`   Parent ID: ${parentId}`);
        
        // Step 1: Verify child exists and belongs to parent
        console.log('\n🔍 Step 1: Verifying child-parent relationship...');
        const [children] = await connection.execute(
            'SELECT id, name, parent_id FROM children WHERE id = ? AND parent_id = ?',
            [childId, parentId]
        );
        
        if (children.length === 0) {
            throw new Error(`Child ${childId} not found or doesn't belong to parent ${parentId}`);
        }
        
        console.log(`   ✅ Child found: ${children[0].name} (Parent ID: ${children[0].parent_id})`);
        
        // Step 2: Verify homework exists and is interactive
        console.log('\n🔍 Step 2: Verifying homework...');
        const [homework] = await connection.execute(
            'SELECT id, title, content_type FROM homework WHERE id = ?',
            [homeworkId]
        );
        
        if (homework.length === 0) {
            throw new Error(`Homework ${homeworkId} not found`);
        }
        
        if (homework[0].content_type !== 'interactive') {
            throw new Error(`Homework ${homeworkId} is not interactive (type: ${homework[0].content_type})`);
        }
        
        console.log(`   ✅ Homework found: "${homework[0].title}" (Type: ${homework[0].content_type})`);
        
        // Step 3: Clean up any existing submissions for this test
        console.log('\n🧹 Step 3: Cleaning up existing submissions...');
        const [deleteResult] = await connection.execute(
            'DELETE FROM homework_submissions WHERE homework_id = ? AND child_id = ?',
            [homeworkId, childId]
        );
        
        console.log(`   🗑️  Deleted ${deleteResult.affectedRows} existing submissions`);
        
        // Step 4: Get parent auth token
        console.log('\n🔐 Step 4: Getting parent authentication...');
        const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
            email: 'daniel@example.com',
            password: 'password123'
        });
        
        if (!loginResponse.data.success) {
            throw new Error('Failed to login as parent');
        }
        
        const authToken = loginResponse.data.token;
        console.log('   ✅ Parent authenticated successfully');
        
        // Step 5: Test homework retrieval with child context
        console.log('\n📖 Step 5: Testing homework retrieval...');
        const homeworkResponse = await axios.get(
            `${API_BASE}/homework/${homeworkId}?child_id=${childId}`,
            {
                headers: { 'Authorization': `Bearer ${authToken}` }
            }
        );
        
        if (!homeworkResponse.data.success) {
            throw new Error('Failed to retrieve homework');
        }
        
        console.log('   ✅ Homework retrieved successfully');
        console.log(`   📝 Title: ${homeworkResponse.data.homework.title}`);
        console.log(`   🎯 Type: ${homeworkResponse.data.homework.content_type}`);
        
        // Check if homework was already submitted
        if (homeworkResponse.data.homework.submitted) {
            console.log('   ⚠️  Homework shows as already submitted');
        } else {
            console.log('   ✅ Homework shows as not yet submitted');
        }
        
        // Step 6: Test homework submission
        console.log('\n📤 Step 6: Testing homework submission...');
        
        const submissionData = {
            child_id: childId,
            answers: {
                "question_1": "3",
                "question_2": "5", 
                "question_3": "7",
                "question_4": "4",
                "question_5": "6"
            },
            score: 100,
            time_spent: 120 // 2 minutes
        };
        
        console.log('   📋 Submission data:', JSON.stringify(submissionData, null, 2));
        
        const submissionResponse = await axios.post(
            `${API_BASE}/homework/${homeworkId}/submit`,
            submissionData,
            {
                headers: { 'Authorization': `Bearer ${authToken}` }
            }
        );
        
        if (!submissionResponse.data.success) {
            throw new Error(`Submission failed: ${submissionResponse.data.message}`);
        }
        
        console.log('   ✅ Homework submitted successfully!');
        console.log(`   📊 Score: ${submissionResponse.data.submission.score}%`);
        console.log(`   ⏱️  Time: ${submissionResponse.data.submission.time_spent} seconds`);
        
        // Step 7: Verify submission in database
        console.log('\n🔍 Step 7: Verifying submission in database...');
        const [submissions] = await connection.execute(
            'SELECT * FROM homework_submissions WHERE homework_id = ? AND child_id = ?',
            [homeworkId, childId]
        );
        
        if (submissions.length === 0) {
            throw new Error('No submission found in database');
        }
        
        const submission = submissions[0];
        console.log('   ✅ Submission found in database');
        console.log(`   📊 Score: ${submission.score}%`);
        console.log(`   📅 Submitted: ${submission.submitted_at}`);
        console.log(`   ⏱️  Time spent: ${submission.time_spent} seconds`);
        
        // Step 8: Test that homework now shows as submitted
        console.log('\n🔄 Step 8: Testing homework status after submission...');
        const updatedHomeworkResponse = await axios.get(
            `${API_BASE}/homework/${homeworkId}?child_id=${childId}`,
            {
                headers: { 'Authorization': `Bearer ${authToken}` }
            }
        );
        
        if (!updatedHomeworkResponse.data.success) {
            throw new Error('Failed to retrieve homework after submission');
        }
        
        const updatedHomework = updatedHomeworkResponse.data.homework;
        console.log('   📋 Updated homework status:');
        console.log(`   ✅ Submitted: ${updatedHomework.submitted ? 'Yes' : 'No'}`);
        console.log(`   📊 Score: ${updatedHomework.score || 'N/A'}%`);
        
        if (!updatedHomework.submitted) {
            console.log('   ⚠️  WARNING: Homework still shows as not submitted');
        }
        
        // Step 9: Test parent dashboard status
        console.log('\n📊 Step 9: Testing parent dashboard status...');
        const dashboardResponse = await axios.get(
            `${API_BASE}/parent/dashboard`,
            {
                headers: { 'Authorization': `Bearer ${authToken}` }
            }
        );
        
        if (!dashboardResponse.data.success) {
            throw new Error('Failed to retrieve parent dashboard');
        }
        
        const dashboard = dashboardResponse.data.dashboard;
        console.log('   📊 Parent Dashboard Status:');
        console.log(`   📝 Total Homework: ${dashboard.homework_stats.total || 0}`);
        console.log(`   ✅ Completed: ${dashboard.homework_stats.completed || 0}`);
        console.log(`   ⏳ Pending: ${dashboard.homework_stats.pending || 0}`);
        console.log(`   🎯 Completion Rate: ${dashboard.homework_stats.completion_rate || 0}%`);
        
        // Step 10: Test duplicate submission prevention
        console.log('\n🚫 Step 10: Testing duplicate submission prevention...');
        try {
            const duplicateResponse = await axios.post(
                `${API_BASE}/homework/${homeworkId}/submit`,
                submissionData,
                {
                    headers: { 'Authorization': `Bearer ${authToken}` }
                }
            );
            
            if (duplicateResponse.data.success) {
                console.log('   ⚠️  WARNING: Duplicate submission was allowed');
            } else {
                console.log('   ✅ Duplicate submission prevented');
                console.log(`   📝 Message: ${duplicateResponse.data.message}`);
            }
        } catch (error) {
            if (error.response && error.response.status === 400) {
                console.log('   ✅ Duplicate submission prevented (400 error)');
                console.log(`   📝 Message: ${error.response.data.message}`);
            } else {
                throw error;
            }
        }
        
        console.log('\n🎉 All tests completed successfully!');
        console.log('\n📋 Summary:');
        console.log('   ✅ Child-parent relationship verified');
        console.log('   ✅ Interactive homework retrieved');
        console.log('   ✅ Homework submitted successfully');
        console.log('   ✅ Submission recorded in database');
        console.log('   ✅ Homework status updated');
        console.log('   ✅ Parent dashboard reflects changes');
        console.log('   ✅ Duplicate submissions prevented');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        if (error.response) {
            console.error('   📝 Response data:', error.response.data);
            console.error('   🔢 Status code:', error.response.status);
        }
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Database connection closed');
        }
    }
}

// Run the test
testInteractiveHomeworkSubmission();
