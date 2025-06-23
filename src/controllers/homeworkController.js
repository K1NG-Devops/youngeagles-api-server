import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { query, execute } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const assignHomework = async (req, res) => {
  const { title, instructions, ageGroup, dueDate, className, grade, type, items } = req.body;
  const filePath = req.file ? `/uploads/homework/${req.file.filename}` : null;

  // Validate required fields
  if (!title || !dueDate || !filePath || !className || !grade) {
    return res.status(400).json({ error: "All required fields must be provided (title, dueDate, file, className, grade)." });
  }

  // Validate teacher is assigned to this class
  try {
    const teacherClass = await query(
      'SELECT className, grade FROM users WHERE id = ? AND role = "teacher"',
      [req.user.id],
      'railway'
    );
    
    if (teacherClass.length === 0) {
      return res.status(403).json({ error: "Teacher not found or not authorized." });
    }
    
    const teacher = teacherClass[0];
    if (teacher.className !== className || teacher.grade !== grade) {
      return res.status(403).json({ 
        error: `You are not authorized to assign homework to ${className} ${grade}. You are assigned to ${teacher.className} ${teacher.grade}.`
      });
    }
  } catch (error) {
    console.error('Error validating teacher assignment:', error);
    return res.status(500).json({ error: 'Error validating teacher assignment' });
  }

  // Format due date
  const formattedDueDate = new Date(dueDate).toISOString().split('T')[0];

  try {
    const sql = `
      INSERT INTO homeworks (title, due_date, file_url, instructions, status, uploaded_by_teacher_id, class_name, grade, type, items, created_at)
      VALUES (?, ?, ?, ?, 'Pending', ?, ?, ?, ?, ?, NOW())
    `;
    const params = [title, formattedDueDate, filePath, instructions || null, req.user.id, className, grade, type || null, items ? JSON.stringify(items) : null];

    const result = await execute(sql, params, 'skydek_DB');
    
    const newHomework = {
      id: result.insertId,
      title,
      instructions,
      fileUrl: filePath,
      ageGroup,
      dueDate: formattedDueDate,
      teacher: req.user.id,
      className,
      grade,
      type,
      items
    };

    res.status(201).json({ message: 'Homework assigned successfully.', data: newHomework });
  } catch (error) {
    console.error('Error assigning homework:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getHomeworkForParent = async (req, res) => {
// Get parent_id from either query params or route params
const parent_id = req.query.parent_id || req.params.parent_id;
const { child_id } = req.query; // Required child filter

  try {
    console.log('Fetching homework for parent:', parent_id, 'child_id:', child_id);
    
    // Validate child_id parameter more strictly
    if (!child_id || child_id.trim() === '' || child_id === 'undefined' || child_id === 'null') {
      return res.status(400).json({ 
        message: 'Child ID must be specified and valid.',
        received: { parent_id, child_id }
      });
    }
    // Fetch child details based on the selected child_id
    const children = await query(
      'SELECT id, name, className, grade FROM children WHERE parent_id = ? AND id = ?',
      [parent_id, child_id],
      'skydek_DB'
    );

    console.log('Children fetched:', children);

    if (children.length === 0) {
      return res.status(404).json({ message: 'No children found for this parent.' });
    }

    let targetChildren = children;
    
    // If a specific child is requested, filter for that child
    if (child_id) {
      targetChildren = children.filter(child => child.id.toString() === child_id.toString());
      if (targetChildren.length === 0) {
        return res.status(404).json({ message: 'Child not found for this parent.' });
      }
    }

    const classNames = targetChildren.map(child => child.className).filter(Boolean);
    console.log('Target class names:', classNames);

    if (classNames.length === 0) {
      return res.status(404).json({ message: 'No classes found for the specified children.' });
    }

    const placeholders = classNames.map(() => '?').join(', ');
    const sql = `
      SELECT h.*
      FROM homeworks h
      WHERE h.class_name IN (${placeholders})
      ORDER BY h.due_date DESC
    `;

    console.log('Executing homework query with SQL:', sql);
    const homeworks = await query(sql, classNames, 'skydek_DB');

    // Parse items JSON and fetch teacher names for each homework
    for (let hw of homeworks) {
      if (hw.items && typeof hw.items === 'string') {
        try { hw.items = JSON.parse(hw.items); } catch (e) { hw.items = null; }
      }
      
      // Fetch teacher name from railway database
      if (hw.uploaded_by_teacher_id) {
        try {
          const [teacher] = await query(
            'SELECT name FROM users WHERE id = ?',
            [hw.uploaded_by_teacher_id],
            'railway'
          );
          hw.uploaded_by_teacher_name = teacher ? teacher.name : `Teacher ID: ${hw.uploaded_by_teacher_id}`;
        } catch (err) {
          console.error('Error fetching teacher name:', err);
          hw.uploaded_by_teacher_name = `Teacher ID: ${hw.uploaded_by_teacher_id}`;
        }
      } else {
        hw.uploaded_by_teacher_name = 'Unknown Teacher';
      }
      
      // Save the teacher's file URL separately (handle both file_url and fileUrl)
      hw.teacher_file_url = hw.file_url || hw.fileUrl || null;
      
      // Always check for submissions by the specific child only (since child_id is now required)
      const [submission] = await query(
        'SELECT id, file_url, child_id, submitted_at FROM submissions WHERE homework_id = ? AND parent_id = ? AND child_id = ? LIMIT 1',
        [hw.id, parent_id, child_id],
        'skydek_DB'
      );
      
      // Set submission status and details
      hw.submitted = !!submission;
      hw.submission_file_url = submission ? submission.file_url : null;
      hw.submission_id = submission ? submission.id : null;
      hw.submission_child_id = submission ? submission.child_id : null;
      hw.submitted_at = submission ? submission.submitted_at : null;
      
      // Get completion answer for the specific child
      const [completion] = await query(
        'SELECT completion_answer, created_at, updated_at FROM homework_completions WHERE homework_id = ? AND parent_id = ? AND child_id = ? LIMIT 1',
        [hw.id, parent_id, child_id],
        'skydek_DB'
      );
      
      hw.completion_answer = completion ? completion.completion_answer : '';
      hw.completion_created_at = completion ? completion.created_at : null;
      hw.completion_updated_at = completion ? completion.updated_at : null;
      
      // Keep original teacher file URL preserved
      hw.teacher_file_url = hw.file_url || hw.fileUrl || null;
      
      // Set file_url to submission file for consistency with frontend expectations
      hw.file_url = hw.submission_file_url;
      
      console.log(`Homework ${hw.id} for child ${child_id}: submitted=${hw.submitted}, has_completion=${!!hw.completion_answer}`);
      
    }

    console.log('Homeworks fetched:', homeworks);
    return res.status(200).json({ 
      homeworks,
      children: targetChildren,
      filtered_by_child: !!child_id
    });

  } catch (error) {
    console.error('🔥 Controller Error:', error); // Enhanced logging
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const submitHomework = async (req, res) => {
  console.log('📝 Submit homework request received:', req.body);
  const { 
    homeworkId, 
    parentId, 
    childId, 
    childName, 
    fileURL, // Note: frontend sends fileURL 
    comment, 
    completion_answer, 
    activity_result, 
    isInteractive 
  } = req.body;
  
  // Log the extracted values for debugging
  console.log('📊 Extracted values:', {
    homeworkId, 
    parentId, 
    childId, 
    childName, 
    fileURL, 
    comment, 
    completion_answer, 
    activity_result, 
    isInteractive
  });
  
  // Validate required fields
  if (!homeworkId || !parentId) {
    console.log('❌ Validation failed: homeworkId and parentId are required');
    return res.status(400).json({ message: "Homework ID and Parent ID are required" });
  }
  
  // For non-interactive homework, require either file or completion answer
  if (!isInteractive && !fileURL && !completion_answer) {
    console.log('❌ Validation failed: File or completion answer required for non-interactive homework');
    return res.status(400).json({ message: "Either file upload or completion answer is required" });
  }
  
  try {
    console.log('🔄 Attempting to insert submission into database...');
    
    // Insert the homework submission including child_id for proper differentiation
    // Use empty string for file_url if null to avoid NOT NULL constraint
    const sql = `INSERT INTO submissions (homework_id, parent_id, child_id, file_url, comment, submitted_at) VALUES (?, ?, ?, ?, ?, NOW())`;
    const result = await execute(sql, [homeworkId, parentId, childId || null, fileURL || '', comment || ''], 'skydek_DB');
    
    console.log('✅ Submission inserted successfully:', result);
    
    // Store completion answers in the homework_completions table with child_id
    if (completion_answer || activity_result) {
      const finalAnswer = completion_answer || (activity_result ? JSON.stringify(activity_result) : null);
      const completionSql = `
        INSERT INTO homework_completions (homework_id, parent_id, child_id, completion_answer)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
        completion_answer = VALUES(completion_answer)
      `;
      await execute(completionSql, [homeworkId, parentId, childId || null, finalAnswer], 'skydek_DB');
      console.log('✅ Homework completion record updated');
    }
    
    res.status(201).json({ 
      message: "Homework submitted successfully",
      submissionId: result.insertId
    });
  } catch (error) {
    console.error('🔥 Error submitting homework:');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error code:', error.code);
    console.error('SQL values used:', [homeworkId, parentId, fileURL, comment, completion_answer]);
    
    res.status(500).json({ 
      error: 'Internal server error'
    });
  }
};

// Delete homework submissions
export const deleteSubmissions = async (req, res) => {
  const { submissionId } = req.params;

  try {
    const sql = 'DELETE FROM submissions WHERE id = ?';
    const result = await execute(sql, [submissionId], 'skydek_DB');

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    res.status(200).json({ message: 'Submission deleted successfully' });
  } catch (error) {
    console.error('🔥 Error deleting submission:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getSubmission = async (req, res) => {
  const { homeworkId, parentId } = req.params;
  try {
    const sql = `SELECT * FROM submissions WHERE homework_id = ? AND parent_id = ? LIMIT 1`;
    const [submission] = await query(sql, [homeworkId, parentId], 'skydek_DB');
    if (!submission) {
      return res.status(404).json({ message: "No submission found" });
    }
    res.status(200).json({ submission });
  } catch (error) {
    console.error('🔥 Error fetching submission:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getHomeworksForTeacher = async (req, res) => {
  try {
    const { teacherId } = req.params;
    console.log('🔍 Fetching homeworks for teacher ID:', teacherId);
    
    // First get teacher's class to filter homework appropriately
    const teacherRows = await query(
      'SELECT className, name FROM staff WHERE id = ? AND role = "teacher"',
      [teacherId],
      'skydek_DB'
    );
    
    if (teacherRows.length === 0) {
      return res.status(404).json({ message: 'Teacher not found' });
    }
    
    const teacher = teacherRows[0];
    console.log('👨‍🏫 Teacher info:', teacher);
    
    // Get homeworks uploaded by this teacher
    const homeworks = await query(
      'SELECT * FROM homeworks WHERE uploaded_by_teacher_id = ? ORDER BY created_at DESC',
      [teacherId],
      'skydek_DB'
    );
    console.log('📚 Found homeworks:', homeworks.length);
    
    // Enhance homework data with additional info
    const enhancedHomeworks = await Promise.all(homeworks.map(async (hw) => {
      // Parse items JSON if exists
      if (hw.items && typeof hw.items === 'string') {
        try { 
          hw.items = JSON.parse(hw.items); 
        } catch (e) { 
          hw.items = null; 
        }
      }
      
      // Add teacher name
      hw.uploaded_by_teacher_name = teacher.name;
      
      // Get submission count for this homework
      const submissionCount = await query(
        'SELECT COUNT(*) as count FROM homework_submissions WHERE homework_id = ?',
        [hw.id],
        'skydek_DB'
      );
      
      hw.submissionCount = submissionCount[0]?.count || 0;
      
      // Get student count in teacher's class for calculating completion rate
      const studentCount = await query(
        'SELECT COUNT(*) as count FROM children WHERE className = ?',
        [teacher.className || ''],
        'skydek_DB'
      );
      
      hw.totalStudents = studentCount[0]?.count || 0;
      hw.completionRate = hw.totalStudents > 0 ? 
        Math.round((hw.submissionCount / hw.totalStudents) * 100) : 0;
      
      return hw;
    }));
    
    res.json({ 
      success: true,
      homeworks: enhancedHomeworks,
      teacher: {
        id: teacherId,
        name: teacher.name,
        className: teacher.className
      },
      totalHomeworks: enhancedHomeworks.length
    });
    
  } catch (err) {
    console.error('Error fetching homeworks for teacher:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error.',
      error: err.message 
    });
  }
};

export const deleteHomework = async (req, res) => {
  const { homeworkId } = req.params;
  try {
    const result = await execute('DELETE FROM homeworks WHERE id = ?', [homeworkId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Homework not found' });
    }
    res.json({ message: 'Homework deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const updateHomework = async (req, res) => {
  const { homeworkId } = req.params;
  const { title, instructions, due_date, type, items } = req.body;
  try {
    const result = await execute(
      'UPDATE homeworks SET title = ?, instructions = ?, due_date = ?, type = ?, items = ? WHERE id = ?',
      [title, instructions, due_date, type || null, items ? JSON.stringify(items) : null, homeworkId],
      'skydek_DB'
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Homework not found' });
    }
    res.json({ message: 'Homework updated successfully' });
  } catch (err) {
    console.error('Error updating homework:', err);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// Get all submissions for a specific homework (for teachers)
export const getSubmissionsForHomework = async (req, res) => {
  const { homeworkId } = req.params;
  try {
    const teacherId = req.user.id;
    
    // First verify the homework exists and belongs to the teacher
    const [homework] = await query(
      'SELECT * FROM homeworks WHERE id = ? AND uploaded_by_teacher_id = ?',
      [homeworkId, teacherId],
      'skydek_DB'
    );
    
    if (!homework) {
      return res.status(404).json({ message: 'Homework not found or unauthorized' });
    }
    
    // Get teacher's assigned class to ensure we only show submissions from their class
    const teacherRows = await query(
      "SELECT className, grade FROM users WHERE id = ?",
      [teacherId],
      'railway'
    );
    
    if (teacherRows.length === 0) {
      return res.status(404).json({ message: "Teacher not found." });
    }
    
    const teacherClass = teacherRows[0];
    console.log('🏫 Teacher checking submissions for class:', teacherClass.className);
    
    // Get submissions for this homework ONLY from children in teacher's class
    const submissions = await query(`
      SELECT 
        s.*,
        c.name as student_name,
        c.className as student_class,
        hc.completion_answer
      FROM submissions s
      LEFT JOIN children c ON s.child_id = c.id
      LEFT JOIN homework_completions hc ON hc.homework_id = s.homework_id AND hc.parent_id = s.parent_id AND hc.child_id = s.child_id
      WHERE s.homework_id = ? AND c.className = ?
      ORDER BY s.submitted_at DESC
    `, [homeworkId, teacherClass.className], 'skydek_DB');
    
    console.log(`📋 Found ${submissions.length} submissions from ${teacherClass.className} class`);
    
    // Get all students in the teacher's class to show who hasn't submitted
    const allStudents = await query(
      'SELECT * FROM children WHERE className = ?',
      [teacherClass.className],
      'skydek_DB'
    );
    
    // Mark which students have submitted (using child_id for proper matching)
    const submittedChildIds = submissions.map(s => s.child_id).filter(Boolean);
    const studentsWithStatus = allStudents.map(student => ({
      ...student,
      hasSubmitted: submittedChildIds.includes(student.id),
      submission: submissions.find(s => s.child_id === student.id) || null
    }));
    
    res.json({
      homework,
      submissions,
      studentsWithStatus,
      totalStudents: allStudents.length,
      submittedCount: submissions.length,
      pendingCount: allStudents.length - submissions.length,
      teacherClass: teacherClass.className
    });
  } catch (err) {
    console.error('Error fetching submissions:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

// Get all submissions across all homework for a teacher (dashboard view)
export const getAllSubmissionsForTeacher = async (req, res) => {
  try {
    const teacherId = req.user.id;
    
    // Step 1: Get teacher's assigned class
    const teacherRows = await query(
      "SELECT className, grade FROM users WHERE id = ?",
      [teacherId],
      'railway'
    );
    
    if (teacherRows.length === 0) {
      return res.status(404).json({ message: "Teacher not found." });
    }
    
    const teacherClass = teacherRows[0];
    console.log('🏫 Teacher assigned to class:', teacherClass.className, teacherClass.grade);
    
    // Step 2: Get submissions for homework created by this teacher AND for children in teacher's class
    const submissions = await query(`
      SELECT 
        s.*,
        h.title as homework_title,
        h.due_date,
        h.class_name,
        c.name as student_name,
        c.className as student_class,
        hc.completion_answer
      FROM submissions s
      JOIN homeworks h ON s.homework_id = h.id
      LEFT JOIN children c ON s.child_id = c.id
      LEFT JOIN homework_completions hc ON hc.homework_id = s.homework_id AND hc.parent_id = s.parent_id AND hc.child_id = s.child_id
      WHERE h.uploaded_by_teacher_id = ? 
        AND c.className = ?
      ORDER BY s.submitted_at DESC
    `, [teacherId, teacherClass.className], 'skydek_DB');
    
    console.log('📋 Found submissions for teacher class:', submissions.length);
    
    res.json({ 
      submissions,
      teacherClass: teacherClass.className,
      teacherGrade: teacherClass.grade
    });
  } catch (err) {
    console.error('Error fetching all submissions:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

// Debug endpoint to troubleshoot specific homework and submission issues
export const debugHomeworkSubmission = async (req, res) => {
  const { homeworkId, parentId, childId } = req.query;
  
  try {
    console.log('🔍 Debug request for:', { homeworkId, parentId, childId });
    
    // Get homework details
    const [homework] = await query(
      'SELECT * FROM homeworks WHERE id = ?',
      [homeworkId],
      'skydek_DB'
    );
    
    // Get all submissions for this homework
    const allSubmissions = await query(
      'SELECT * FROM submissions WHERE homework_id = ?',
      [homeworkId],
      'skydek_DB'
    );
    
    // Get submissions for this specific parent
    const parentSubmissions = await query(
      'SELECT * FROM submissions WHERE homework_id = ? AND parent_id = ?',
      [homeworkId, parentId],
      'skydek_DB'
    );
    
    // Get submissions for this specific child
    const childSubmissions = childId ? await query(
      'SELECT * FROM submissions WHERE homework_id = ? AND parent_id = ? AND child_id = ?',
      [homeworkId, parentId, childId],
      'skydek_DB'
    ) : [];
    
    // Get all completion records for this homework
    const allCompletions = await query(
      'SELECT * FROM homework_completions WHERE homework_id = ?',
      [homeworkId],
      'skydek_DB'
    );
    
    // Get child details
    const childDetails = childId ? await query(
      'SELECT * FROM children WHERE id = ? AND parent_id = ?',
      [childId, parentId],
      'skydek_DB'
    ) : [];
    
    res.json({
      debug_info: {
        homework,
        allSubmissions: allSubmissions.length,
        parentSubmissions: parentSubmissions.length,
        childSubmissions: childSubmissions.length,
        allCompletions: allCompletions.length,
        childDetails: childDetails.length > 0 ? childDetails[0] : null
      },
      detailed_data: {
        homework,
        allSubmissions,
        parentSubmissions,
        childSubmissions,
        allCompletions,
        childDetails
      }
    });
  } catch (err) {
    console.error('Error in debug endpoint:', err);
    res.status(500).json({ error: 'Debug endpoint error', message: err.message });
  }
};

// **NEW ADVANCED HOMEWORK FUNCTIONS**

// Create advanced homework with skills tracking and multi-modal instructions
export const createAdvancedHomework = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const {
      title,
      subject,
      estimatedTime,
      difficultyLevel,
      selectedSkills,
      customObjectives,
      description,
      parentGuidance,
      childInstructions,
      assessmentCriteria,
      dueDate,
      assignedClasses
    } = req.body;

    // Handle file uploads
    const audioInstructions = req.files?.audioInstructions?.[0];
    const visualAids = req.files?.visualAids || [];

    // Validate required fields
    if (!title || !subject || !dueDate || !assignedClasses?.length) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['title', 'subject', 'dueDate', 'assignedClasses']
      });
    }

    // Verify teacher is authorized for assigned classes
    const teacherClass = await query(
      'SELECT className, grade FROM users WHERE id = ? AND role = "teacher"',
      [teacherId],
      'railway'
    );

    if (teacherClass.length === 0) {
      return res.status(403).json({ error: 'Teacher not found or not authorized' });
    }

    const teacher = teacherClass[0];
    const unauthorizedClasses = assignedClasses.filter(cls => cls !== teacher.className);
    
    if (unauthorizedClasses.length > 0) {
      return res.status(403).json({
        error: `Not authorized to assign homework to: ${unauthorizedClasses.join(', ')}`,
        authorizedClass: teacher.className
      });
    }

    // Upload audio file if provided
    let audioUrl = null;
    if (audioInstructions) {
      // Handle audio file upload (implement your file upload logic here)
      audioUrl = `/uploads/audio/${audioInstructions.filename}`;
    }

    // Process visual aids
    const visualAidsData = visualAids.map(file => ({
      filename: file.filename,
      originalname: file.originalname,
      url: `/uploads/visual-aids/${file.filename}`,
      mimetype: file.mimetype
    }));

    // Format due date
    const formattedDueDate = new Date(dueDate).toISOString().split('T')[0];

    // Create homework record
    const homeworkSql = `
      INSERT INTO homeworks (
        title, subject, difficulty_level, estimated_duration, selected_skills,
        custom_objectives, instructions, parent_guidance, child_instructions,
        audio_instructions_url, visual_aids, assessment_criteria, due_date,
        status, uploaded_by_teacher_id, class_name, grade, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?, NOW())
    `;

    const homeworkParams = [
      title,
      subject,
      difficultyLevel || 1,
      estimatedTime || 15,
      JSON.stringify(selectedSkills || []),
      JSON.stringify(customObjectives || []),
      description || null,
      parentGuidance || null,
      childInstructions || null,
      audioUrl,
      JSON.stringify(visualAidsData),
      JSON.stringify(assessmentCriteria || {}),
      formattedDueDate,
      teacherId,
      teacher.className,
      teacher.grade
    ];

    const result = await execute(homeworkSql, homeworkParams, 'skydek_DB');
    const homeworkId = result.insertId;

    // Get all students in the assigned classes to create skill progress tracking
    const students = await query(
      'SELECT id FROM children WHERE className IN (?)',
      [assignedClasses],
      'skydek_DB'
    );

    // Initialize skill progress tracking for each student
    if (selectedSkills && selectedSkills.length > 0 && students.length > 0) {
      const skillProgressInserts = [];
      
      for (const student of students) {
        for (const skillKey of selectedSkills) {
          // Get skill ID from skill key
          const [skillData] = await query(
            `SELECT s.id FROM skills s 
             JOIN skill_categories sc ON s.category_id = sc.id 
             WHERE CONCAT(sc.name, '_', s.skill_key) = ?`,
            [skillKey],
            'skydek_DB'
          );
          
          if (skillData) {
            skillProgressInserts.push([
              student.id,
              skillData.id,
              homeworkId,
              1, // initial proficiency level
              new Date().toISOString().split('T')[0],
              'emerging'
            ]);
          }
        }
      }

      if (skillProgressInserts.length > 0) {
        const skillProgressSql = `
          INSERT INTO student_skill_progress 
          (student_id, skill_id, homework_id, proficiency_level, demonstration_date, mastery_status)
          VALUES ${skillProgressInserts.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')}
        `;
        
        await execute(skillProgressSql, skillProgressInserts.flat(), 'skydek_DB');
      }
    }

    // Send notifications to parents (reuse existing notification system)
    const teacherName = teacher.name || 'Your teacher';
    // await sendHomeworkNotification(teacher.className, title, teacherName, homeworkId);

    res.status(201).json({
      success: true,
      message: 'Advanced homework created successfully',
      homework: {
        id: homeworkId,
        title,
        subject,
        difficultyLevel,
        estimatedTime,
        selectedSkills,
        dueDate: formattedDueDate,
        audioUrl,
        visualAids: visualAidsData,
        studentsAffected: students.length
      }
    });

  } catch (error) {
    console.error('Error creating advanced homework:', error);
    res.status(500).json({
      error: 'Failed to create advanced homework',
      message: error.message
    });
  }
};

// Get detailed homework with skills and assessment data
export const getAdvancedHomeworkDetails = async (req, res) => {
  try {
    const { homeworkId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Get homework details
    const [homework] = await query(
      `SELECT h.*, u.name as teacher_name 
       FROM homeworks h 
       LEFT JOIN users u ON h.uploaded_by_teacher_id = u.id 
       WHERE h.id = ?`,
      [homeworkId],
      'skydek_DB'
    );

    if (!homework) {
      return res.status(404).json({ error: 'Homework not found' });
    }

    // Parse JSON fields
    homework.selected_skills = homework.selected_skills ? JSON.parse(homework.selected_skills) : [];
    homework.custom_objectives = homework.custom_objectives ? JSON.parse(homework.custom_objectives) : [];
    homework.visual_aids = homework.visual_aids ? JSON.parse(homework.visual_aids) : [];
    homework.assessment_criteria = homework.assessment_criteria ? JSON.parse(homework.assessment_criteria) : {};

    // Get skill details for selected skills
    if (homework.selected_skills.length > 0) {
      const skillDetails = await query(
        `SELECT s.*, sc.name as category_name, sc.title as category_title, sc.icon as category_icon
         FROM skills s
         JOIN skill_categories sc ON s.category_id = sc.id
         WHERE CONCAT(sc.name, '_', s.skill_key) IN (${homework.selected_skills.map(() => '?').join(',')})`,
        homework.selected_skills,
        'skydek_DB'
      );
      homework.skill_details = skillDetails;
    }

    // Get student progress data if user is teacher
    if (userRole === 'teacher' && userId == homework.uploaded_by_teacher_id) {
      const progressData = await query(
        `SELECT ssp.*, s.name as skill_name, sc.title as category_title, c.name as student_name
         FROM student_skill_progress ssp
         JOIN skills s ON ssp.skill_id = s.id
         JOIN skill_categories sc ON s.category_id = sc.id
         JOIN children c ON ssp.student_id = c.id
         WHERE ssp.homework_id = ?
         ORDER BY c.name, sc.title, s.name`,
        [homeworkId],
        'skydek_DB'
      );
      homework.student_progress = progressData;
    }

    // Get submissions count
    const [submissionStats] = await query(
      `SELECT 
         COUNT(*) as total_submissions,
         COUNT(CASE WHEN submitted_at IS NOT NULL THEN 1 END) as completed_submissions
       FROM submissions 
       WHERE homework_id = ?`,
      [homeworkId],
      'skydek_DB'
    );
    homework.submission_stats = submissionStats;

    res.json({
      success: true,
      homework
    });

  } catch (error) {
    console.error('Error fetching advanced homework details:', error);
    res.status(500).json({
      error: 'Failed to fetch homework details',
      message: error.message
    });
  }
};

// Update skill progress for a student
export const updateSkillProgress = async (req, res) => {
  try {
    const {
      studentId,
      skillId,
      homeworkId,
      proficiencyLevel,
      masteryStatus,
      teacherNotes,
      parentNotes,
      evidenceUrls
    } = req.body;

    const userId = req.user.id;
    const userRole = req.user.role;

    // Validate required fields
    if (!studentId || !skillId) {
      return res.status(400).json({
        error: 'Missing required fields: studentId, skillId'
      });
    }

    // Check authorization
    if (userRole === 'teacher') {
      // Verify teacher is authorized for this student's class
      const [student] = await query(
        'SELECT className FROM children WHERE id = ?',
        [studentId],
        'skydek_DB'
      );
      
      const [teacher] = await query(
        'SELECT className FROM users WHERE id = ? AND role = "teacher"',
        [userId],
        'railway'
      );

      if (!student || !teacher || student.className !== teacher.className) {
        return res.status(403).json({ error: 'Not authorized to update this student\'s progress' });
      }
    } else if (userRole === 'parent') {
      // Verify parent owns this child
      const [child] = await query(
        'SELECT id FROM children WHERE id = ? AND parent_id = ?',
        [studentId, userId],
        'skydek_DB'
      );

      if (!child) {
        return res.status(403).json({ error: 'Not authorized to update this child\'s progress' });
      }
    }

    // Update or insert skill progress
    const updateSql = `
      INSERT INTO student_skill_progress 
      (student_id, skill_id, homework_id, proficiency_level, mastery_status, 
       teacher_notes, parent_notes, evidence_urls, demonstration_date, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), NOW())
      ON DUPLICATE KEY UPDATE
        proficiency_level = VALUES(proficiency_level),
        mastery_status = VALUES(mastery_status),
        teacher_notes = CASE WHEN ? = 'teacher' THEN VALUES(teacher_notes) ELSE teacher_notes END,
        parent_notes = CASE WHEN ? = 'parent' THEN VALUES(parent_notes) ELSE parent_notes END,
        evidence_urls = VALUES(evidence_urls),
        demonstration_date = CURDATE(),
        updated_at = NOW()
    `;

    await execute(updateSql, [
      studentId,
      skillId,
      homeworkId,
      proficiencyLevel || 1,
      masteryStatus || 'emerging',
      userRole === 'teacher' ? teacherNotes : null,
      userRole === 'parent' ? parentNotes : null,
      JSON.stringify(evidenceUrls || []),
      userRole,
      userRole
    ], 'skydek_DB');

    res.json({
      success: true,
      message: 'Skill progress updated successfully'
    });

  } catch (error) {
    console.error('Error updating skill progress:', error);
    res.status(500).json({
      error: 'Failed to update skill progress',
      message: error.message
    });
  }
};

// Get student skill progress
export const getStudentSkillProgress = async (req, res) => {
  try {
    const { studentId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check authorization
    if (userRole === 'parent') {
      const [child] = await query(
        'SELECT id FROM children WHERE id = ? AND parent_id = ?',
        [studentId, userId],
        'skydek_DB'
      );
      if (!child) {
        return res.status(403).json({ error: 'Not authorized to view this child\'s progress' });
      }
    } else if (userRole === 'teacher') {
      const [student] = await query(
        'SELECT className FROM children WHERE id = ?',
        [studentId],
        'skydek_DB'
      );
      const [teacher] = await query(
        'SELECT className FROM users WHERE id = ? AND role = "teacher"',
        [userId],
        'railway'
      );
      if (!student || !teacher || student.className !== teacher.className) {
        return res.status(403).json({ error: 'Not authorized to view this student\'s progress' });
      }
    }

    // Get comprehensive skill progress
    const skillProgress = await query(
      `SELECT 
         ssp.*,
         s.name as skill_name,
         s.description as skill_description,
         s.difficulty_level as skill_difficulty,
         sc.name as category_name,
         sc.title as category_title,
         sc.icon as category_icon,
         sc.color as category_color,
         h.title as homework_title,
         h.due_date as homework_due_date
       FROM student_skill_progress ssp
       JOIN skills s ON ssp.skill_id = s.id
       JOIN skill_categories sc ON s.category_id = sc.id
       LEFT JOIN homeworks h ON ssp.homework_id = h.id
       WHERE ssp.student_id = ?
       ORDER BY ssp.updated_at DESC, sc.name, s.name`,
      [studentId],
      'skydek_DB'
    );

    // Group by category
    const progressByCategory = {};
    skillProgress.forEach(progress => {
      if (!progressByCategory[progress.category_name]) {
        progressByCategory[progress.category_name] = {
          title: progress.category_title,
          icon: progress.category_icon,
          color: progress.category_color,
          skills: []
        };
      }
      
      // Parse JSON fields
      progress.evidence_urls = progress.evidence_urls ? JSON.parse(progress.evidence_urls) : [];
      
      progressByCategory[progress.category_name].skills.push(progress);
    });

    // Calculate overall statistics
    const totalSkills = skillProgress.length;
    const masteredSkills = skillProgress.filter(p => p.mastery_status === 'mastery').length;
    const proficientSkills = skillProgress.filter(p => ['proficient', 'advanced', 'mastery'].includes(p.mastery_status)).length;
    const averageProficiency = totalSkills > 0 ? 
      skillProgress.reduce((sum, p) => sum + p.proficiency_level, 0) / totalSkills : 0;

    res.json({
      success: true,
      studentId,
      totalSkills,
      masteredSkills,
      proficientSkills,
      averageProficiency: Math.round(averageProficiency * 100) / 100,
      progressByCategory,
      allProgress: skillProgress
    });

  } catch (error) {
    console.error('Error fetching student skill progress:', error);
    res.status(500).json({
      error: 'Failed to fetch skill progress',
      message: error.message
    });
  }
};

// Generate weekly report for a student
export const generateWeeklyReport = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { weekStart, weekEnd } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Set default week if not provided
    const defaultWeekStart = weekStart || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const defaultWeekEnd = weekEnd || new Date().toISOString().split('T')[0];

    // Check authorization
    if (userRole === 'parent') {
      const [child] = await query(
        'SELECT id, name FROM children WHERE id = ? AND parent_id = ?',
        [studentId, userId],
        'skydek_DB'
      );
      if (!child) {
        return res.status(403).json({ error: 'Not authorized to view this child\'s report' });
      }
    }

    // Get homework data for the week
    const homeworkData = await query(
      `SELECT h.*, s.submitted_at, s.file_url as submission_file,
              ha.completion_score, ha.accuracy_score, ha.creativity_score, 
              ha.effort_score, ha.overall_score, ha.time_spent
       FROM homeworks h
       LEFT JOIN submissions s ON h.id = s.homework_id AND s.child_id = ?
       LEFT JOIN homework_assessments ha ON h.id = ha.homework_id AND ha.student_id = ?
       WHERE h.due_date BETWEEN ? AND ?
       ORDER BY h.due_date`,
      [studentId, studentId, defaultWeekStart, defaultWeekEnd],
      'skydek_DB'
    );

    // Get skill progress for the week
    const skillProgress = await query(
      `SELECT ssp.*, s.name as skill_name, sc.title as category_title
       FROM student_skill_progress ssp
       JOIN skills s ON ssp.skill_id = s.id
       JOIN skill_categories sc ON s.category_id = sc.id
       WHERE ssp.student_id = ? 
         AND ssp.demonstration_date BETWEEN ? AND ?
       ORDER BY ssp.updated_at DESC`,
      [studentId, defaultWeekStart, defaultWeekEnd],
      'skydek_DB'
    );

    // Calculate statistics
    const totalHomeworks = homeworkData.length;
    const completedHomeworks = homeworkData.filter(h => h.submitted_at).length;
    const averageAccuracy = homeworkData.length > 0 ? 
      homeworkData.reduce((sum, h) => sum + (h.accuracy_score || 0), 0) / homeworkData.length : 0;
    const totalTimeSpent = homeworkData.reduce((sum, h) => sum + (h.time_spent || 0), 0);

    // Group skills by category
    const skillsByCategory = {};
    skillProgress.forEach(skill => {
      if (!skillsByCategory[skill.category_title]) {
        skillsByCategory[skill.category_title] = [];
      }
      skillsByCategory[skill.category_title].push(skill);
    });

    // Identify strengths and areas for improvement
    const strengths = skillProgress.filter(s => s.proficiency_level >= 4).map(s => s.skill_name);
    const improvements = skillProgress.filter(s => s.proficiency_level <= 2).map(s => s.skill_name);

    // Generate recommendations
    const recommendations = [];
    if (completedHomeworks < totalHomeworks) {
      recommendations.push("Encourage consistent homework completion");
    }
    if (averageAccuracy < 70) {
      recommendations.push("Focus on accuracy and attention to detail");
    }
    if (improvements.length > 0) {
      recommendations.push(`Extra practice needed in: ${improvements.slice(0, 3).join(', ')}`);
    }

    // Check if report already exists
    const [existingReport] = await query(
      'SELECT * FROM weekly_reports WHERE student_id = ? AND week_start = ?',
      [studentId, defaultWeekStart],
      'skydek_DB'
    );

    const reportData = {
      student_id: studentId,
      week_start: defaultWeekStart,
      week_end: defaultWeekEnd,
      homeworks_assigned: totalHomeworks,
      homeworks_completed: completedHomeworks,
      average_accuracy: averageAccuracy,
      total_time_spent: totalTimeSpent,
      skills_practiced: JSON.stringify(skillProgress.map(s => s.skill_name)),
      skills_mastered: JSON.stringify(skillProgress.filter(s => s.mastery_status === 'mastery').map(s => s.skill_name)),
      areas_for_improvement: JSON.stringify(improvements),
      strengths_identified: JSON.stringify(strengths),
      teacher_recommendations: JSON.stringify(recommendations),
      academic_growth_metrics: JSON.stringify({
        completion_rate: totalHomeworks > 0 ? (completedHomeworks / totalHomeworks) * 100 : 0,
        accuracy_trend: averageAccuracy,
        skill_development: skillsByCategory
      })
    };

    if (existingReport) {
      // Update existing report
      await execute(
        `UPDATE weekly_reports SET 
         homeworks_assigned = ?, homeworks_completed = ?, average_accuracy = ?,
         total_time_spent = ?, skills_practiced = ?, skills_mastered = ?,
         areas_for_improvement = ?, strengths_identified = ?, teacher_recommendations = ?,
         academic_growth_metrics = ?, updated_at = NOW()
         WHERE id = ?`,
        [
          reportData.homeworks_assigned, reportData.homeworks_completed, reportData.average_accuracy,
          reportData.total_time_spent, reportData.skills_practiced, reportData.skills_mastered,
          reportData.areas_for_improvement, reportData.strengths_identified, reportData.teacher_recommendations,
          reportData.academic_growth_metrics, existingReport.id
        ],
        'skydek_DB'
      );
    } else {
      // Create new report
      await execute(
        `INSERT INTO weekly_reports 
         (student_id, week_start, week_end, homeworks_assigned, homeworks_completed, 
          average_accuracy, total_time_spent, skills_practiced, skills_mastered,
          areas_for_improvement, strengths_identified, teacher_recommendations, 
          academic_growth_metrics, generated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          reportData.student_id, reportData.week_start, reportData.week_end,
          reportData.homeworks_assigned, reportData.homeworks_completed, reportData.average_accuracy,
          reportData.total_time_spent, reportData.skills_practiced, reportData.skills_mastered,
          reportData.areas_for_improvement, reportData.strengths_identified, reportData.teacher_recommendations,
          reportData.academic_growth_metrics
        ],
        'skydek_DB'
      );
    }

    res.json({
      success: true,
      report: {
        weekStart: defaultWeekStart,
        weekEnd: defaultWeekEnd,
        summary: {
          totalHomeworks,
          completedHomeworks,
          completionRate: totalHomeworks > 0 ? Math.round((completedHomeworks / totalHomeworks) * 100) : 0,
          averageAccuracy: Math.round(averageAccuracy),
          totalTimeSpent
        },
        skillsDevelopment: {
          skillsByCategory,
          totalSkillsPracticed: skillProgress.length,
          skillsMastered: skillProgress.filter(s => s.mastery_status === 'mastery').length
        },
        insights: {
          strengths,
          improvements,
          recommendations
        },
        homeworkData,
        skillProgress
      }
    });

  } catch (error) {
    console.error('Error generating weekly report:', error);
    res.status(500).json({
      error: 'Failed to generate weekly report',
      message: error.message
    });
  }
};
