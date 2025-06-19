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
const { parent_id } = req.params;
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
    
    // Return more specific error information in development
    const isDevelopment = process.env.NODE_ENV === 'development';
    res.status(500).json({ 
      error: 'Internal server error',
      ...(isDevelopment && { 
        details: error.message,
        code: error.code 
      })
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
    const homeworks = await query(
      'SELECT * FROM homeworks WHERE uploaded_by_teacher_id = ? ORDER BY created_at DESC',
      [teacherId],
      'skydek_DB'
    );
    console.log('📚 Found homeworks:', homeworks.length);
    
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
    }
    res.json({ homeworks });
  } catch (err) {
    console.error('Error fetching homeworks for teacher:', err);
    res.status(500).json({ message: 'Server error.' });
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
