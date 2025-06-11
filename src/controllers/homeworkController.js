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

  try {
    console.log('Fetching class names for parent:', parent_id);
    
    const children = await query(
      'SELECT className FROM children WHERE parent_id = ?',
      [parent_id],
      'skydek_DB'
    );

    console.log('Children fetched:', children);

    const classNames = children.map(child => child.className).filter(Boolean);
    console.log('Extracted classNames:', classNames);

    if (classNames.length === 0) {
      return res.status(404).json({ message: 'No children or class names found for this parent.' });
    }

    const placeholders = classNames.map(() => '?').join(', ');
    const sql = `
      SELECT * FROM homeworks
      WHERE class_name IN (${placeholders})
      ORDER BY due_date DESC
    `;

    console.log('Executing homework query with SQL:', sql);
    const homeworks = await query(sql, classNames, 'skydek_DB');

    // Parse items JSON for each homework
    for (let hw of homeworks) {
      if (hw.items && typeof hw.items === 'string') {
        try { hw.items = JSON.parse(hw.items); } catch (e) { hw.items = null; }
      }
      // Save the teacher's file URL separately (handle both file_url and fileUrl)
      hw.teacher_file_url = hw.file_url || hw.fileUrl || null;
      
      // Check for parent's submission
      const [submission] = await query(
        'SELECT id, file_url FROM submissions WHERE homework_id = ? AND parent_id = ? LIMIT 1',
        [hw.id, parent_id],
        'skydek_DB'
      );
      hw.submitted = !!submission;
      hw.file_url = submission ? submission.file_url : null;
      hw.submission_id = submission ? submission.id : null;
      
      // Get completion answer if available
      const [completion] = await query(
        'SELECT completion_answer FROM homework_completions WHERE homework_id = ? AND parent_id = ? LIMIT 1',
        [hw.id, parent_id],
        'skydek_DB'
      );
      hw.completion_answer = completion ? completion.completion_answer : '';
    }

    console.log('Homeworks fetched:', homeworks);
    return res.status(200).json({ homeworks });

  } catch (error) {
    console.error('🔥 Controller Error:', error); // Enhanced logging
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const submitHomework = async (req, res) => {
  console.log('📝 Submit homework request received:', req.body);
  const { homeworkId, parentId, fileUrl, comment } = req.body;
  
  // Log the extracted values for debugging
  console.log('📊 Extracted values:', { homeworkId, parentId, fileUrl, comment });
  
  if (!fileUrl) {
    console.log('❌ Validation failed: File URL is required');
    return res.status(400).json({ message: "File URL is required" });
  }
  
  try {
    console.log('🔄 Attempting to insert submission into database...');
    const sql = `INSERT INTO submissions (homework_id, parent_id, file_url, comment) VALUES (?, ?, ?, ?)`;
    const result = await execute(sql, [homeworkId, parentId, fileUrl, comment], 'skydek_DB');
    console.log('✅ Submission inserted successfully:', result);
    res.status(201).json({ message: "Homework submitted successfully" });
  } catch (error) {
    console.error('🔥 Error submitting homework:');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error code:', error.code);
    console.error('SQL values used:', [homeworkId, parentId, fileUrl, comment]);
    
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
    // Parse items JSON for each homework
    for (let hw of homeworks) {
      if (hw.items && typeof hw.items === 'string') {
        try { hw.items = JSON.parse(hw.items); } catch (e) { hw.items = null; }
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
    // First verify the homework exists and belongs to the teacher
    const [homework] = await query(
      'SELECT * FROM homeworks WHERE id = ? AND uploaded_by_teacher_id = ?',
      [homeworkId, req.user.id],
      'skydek_DB'
    );
    
    if (!homework) {
      return res.status(404).json({ message: 'Homework not found or unauthorized' });
    }
    
    // Get all submissions for this homework with parent/student details
    const submissions = await query(`
      SELECT 
        s.*,
        c.first_name as student_name,
        c.last_name as student_last_name,
        c.className,
        hc.completion_answer
      FROM submissions s
      LEFT JOIN children c ON s.parent_id = c.parent_id
      LEFT JOIN homework_completions hc ON hc.homework_id = s.homework_id AND hc.parent_id = s.parent_id
      WHERE s.homework_id = ?
      ORDER BY s.submitted_at DESC
    `, [homeworkId], 'skydek_DB');
    
    // Get all students in the class to show who hasn't submitted
    const allStudents = await query(
      'SELECT * FROM children WHERE className = ?',
      [homework.class_name],
      'skydek_DB'
    );
    
    // Mark which students have submitted
    const submittedParentIds = submissions.map(s => s.parent_id);
    const studentsWithStatus = allStudents.map(student => ({
      ...student,
      hasSubmitted: submittedParentIds.includes(student.parent_id),
      submission: submissions.find(s => s.parent_id === student.parent_id) || null
    }));
    
    res.json({
      homework,
      submissions,
      studentsWithStatus,
      totalStudents: allStudents.length,
      submittedCount: submissions.length,
      pendingCount: allStudents.length - submissions.length
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
    
    const submissions = await query(`
      SELECT 
        s.*,
        h.title as homework_title,
        h.due_date,
        h.class_name,
        c.first_name as student_name,
        c.last_name as student_last_name,
        hc.completion_answer
      FROM submissions s
      JOIN homeworks h ON s.homework_id = h.id
      LEFT JOIN children c ON s.parent_id = c.parent_id
      LEFT JOIN homework_completions hc ON hc.homework_id = s.homework_id AND hc.parent_id = s.parent_id
      WHERE h.uploaded_by_teacher_id = ?
      ORDER BY s.submitted_at DESC
    `, [teacherId], 'skydek_DB');
    
    res.json({ submissions });
  } catch (err) {
    console.error('Error fetching all submissions:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};
