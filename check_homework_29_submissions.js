import { initDatabase, query, close } from './src/db.js';

async function checkHomework29Submissions() {
  try {
    console.log('🔌 Connecting to database...');
    
    // Initialize database
    const connected = await initDatabase();
    if (!connected) {
      console.log('❌ Failed to connect to database');
      return false;
    }
    
    console.log('✅ Database connected successfully!');
    
    // Check homework_individual_assignments for homework ID 29
    console.log('\n🔍 Checking individual assignments for homework ID 29...');
    
    const individualAssignments = await query(`
      SELECT 
        hia.id,
        hia.homework_id,
        hia.child_id,
        hia.status,
        hia.assigned_at,
        c.first_name,
        c.last_name,
        h.title as homework_title,
        h.content_type
      FROM homework_individual_assignments hia
      JOIN children c ON hia.child_id = c.id
      JOIN homework h ON hia.homework_id = h.id
      WHERE hia.homework_id = 29
      ORDER BY hia.assigned_at DESC
    `);
    
    if (individualAssignments.length === 0) {
      console.log('ℹ️  No individual assignments found for homework ID 29');
    } else {
      console.log(`\n📊 Found ${individualAssignments.length} individual assignment(s) for homework ID 29:`);
      console.log('Assignment ID | Student | Status | Assigned At | Homework Title');
      console.log('--------------|---------|--------|-------------|---------------');
      
      individualAssignments.forEach(assignment => {
        const studentName = `${assignment.first_name} ${assignment.last_name}`;
        const assignedAt = new Date(assignment.assigned_at).toLocaleString();
        
        console.log(`${assignment.id.toString().padStart(12)} | ${studentName.substring(0, 15).padEnd(15)} | ${assignment.status.padEnd(8)} | ${assignedAt.substring(0, 16).padEnd(16)} | ${assignment.homework_title}`);
      });
      
      // Check for specific statuses
      const statusCounts = {
        assigned: individualAssignments.filter(a => a.status === 'assigned').length,
        submitted: individualAssignments.filter(a => a.status === 'submitted').length,
        graded: individualAssignments.filter(a => a.status === 'graded').length
      };
      
      console.log('\n📈 Status Summary:');
      console.log(`  Assigned: ${statusCounts.assigned}`);
      console.log(`  Submitted: ${statusCounts.submitted}`);
      console.log(`  Graded: ${statusCounts.graded}`);
    }
    
    // Check homework_submissions for homework ID 29
    console.log('\n🔍 Checking homework submissions for homework ID 29...');
    
    const submissions = await query(`
      SELECT 
        hs.id,
        hs.homework_id,
        hs.child_id,
        hs.status,
        hs.submitted_at,
        hs.graded_at,
        hs.score,
        hs.submission_type,
        hs.answers_data,
        hs.created_at,
        c.first_name,
        c.last_name,
        h.title as homework_title,
        h.content_type
      FROM homework_submissions hs
      JOIN children c ON hs.child_id = c.id
      JOIN homework h ON hs.homework_id = h.id
      WHERE hs.homework_id = 29
      ORDER BY hs.created_at DESC
    `);
    
    if (submissions.length === 0) {
      console.log('ℹ️  No homework submissions found for homework ID 29');
    } else {
      console.log(`\n📊 Found ${submissions.length} homework submission(s) for homework ID 29:`);
      console.log('Submission ID | Student | Status | Submitted At | Score | Type');
      console.log('--------------|---------|--------|-------------|-------|------');
      
      submissions.forEach(submission => {
        const studentName = `${submission.first_name} ${submission.last_name}`;
        const submittedAt = submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : 'Not submitted';
        const score = submission.score !== null ? submission.score : 'Not graded';
        const type = submission.submission_type || 'N/A';
        
        console.log(`${submission.id.toString().padStart(12)} | ${studentName.substring(0, 15).padEnd(15)} | ${submission.status.padEnd(8)} | ${submittedAt.substring(0, 16).padEnd(16)} | ${score.toString().padEnd(5)} | ${type}`);
      });
      
      // Check for interactive submissions
      const interactiveSubmissions = submissions.filter(s => s.submission_type === 'interactive');
      if (interactiveSubmissions.length > 0) {
        console.log('\n🎮 Interactive submissions found:');
        interactiveSubmissions.forEach(sub => {
          console.log(`  - Submission ${sub.id}: ${sub.first_name} ${sub.last_name} (Status: ${sub.status})`);
          if (sub.answers_data) {
            console.log(`    Has answers data: Yes (${sub.answers_data.length} characters)`);
          }
        });
      }
      
      // Check for potential status inconsistencies
      const inconsistentSubmissions = submissions.filter(s => 
        (s.status === 'pending' && s.submitted_at !== null && s.graded_at === null) ||
        (s.status === 'graded' && s.score === null)
      );
      
      if (inconsistentSubmissions.length > 0) {
        console.log('\n⚠️  Potential status inconsistencies found:');
        inconsistentSubmissions.forEach(sub => {
          console.log(`  - Submission ${sub.id}: Status is '${sub.status}' but grading/score inconsistent`);
        });
      }
    }
    
    // Summary
    console.log('\n📝 Summary for Homework ID 29:');
    console.log(`  - Individual Assignments: ${individualAssignments.length}`);
    console.log(`  - Homework Submissions: ${submissions.length}`);
    console.log(`  - Homework Content Type: ${individualAssignments.length > 0 ? individualAssignments[0].content_type : 'Unknown'}`);
    
    return true;
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
    return false;
  } finally {
    await close();
  }
}

// Run the script
console.log('🔧 Checking submissions and assignments for homework ID 29...');

checkHomework29Submissions()
  .then(success => {
    if (success) {
      console.log('\n✅ Check completed successfully!');
      process.exit(0);
    } else {
      console.log('\n❌ Check failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
