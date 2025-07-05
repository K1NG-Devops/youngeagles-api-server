import express from 'express';
import { verifyTokenMiddleware } from '../utils/security.js';
import { query } from '../db.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'uploads', 'homework_submissions');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'submission-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// Get homework for a parent's children
router.get('/parent/:parentId', verifyTokenMiddleware, async (req, res) => {
  try {
    const { parentId } = req.params;
    const { childId } = req.query; // Optional child filter

    // Verify the requesting user is the parent or admin
    if (req.user.userType !== 'admin' && req.user.id !== parseInt(parentId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    console.log(`🔍 Fetching homework for parent ${parentId}${childId ? ` and child ${childId}` : ''}`);

    // Enhanced query to get homework for children with proper individual assignment handling
    let sql = `
      SELECT DISTINCT
        h.*,
        c.first_name as child_name,
        c.last_name as child_last_name,
        cl.name as class_name,
        s.name as teacher_name,
        s.email as teacher_email,
        CASE 
          WHEN h.due_date < NOW() AND (hs.id IS NULL) THEN 'overdue'
          WHEN hs.id IS NOT NULL THEN 'submitted'
          ELSE 'pending'
        END as status,
        hs.submitted_at,
        hs.grade,
        hs.feedback as teacher_feedback,
        hs.file_url as attachment_url,
        hs.feedback as submission_text,
        h.assignment_type,
        CASE 
          WHEN h.assignment_type = 'individual' THEN 'individual'
          ELSE 'class'
        END as assignment_scope
      FROM children c
      JOIN classes cl ON cl.id = c.class_id
      JOIN homework h ON (
        (h.class_id = cl.id AND h.assignment_type = 'class') OR
        (h.assignment_type = 'individual' AND EXISTS (
          SELECT 1 FROM homework_individual_assignments hia 
          WHERE hia.homework_id = h.id AND hia.child_id = c.id
        ))
      )
      LEFT JOIN staff s ON s.id = h.teacher_id
      LEFT JOIN homework_submissions hs ON hs.homework_id = h.id AND hs.child_id = c.id
      WHERE c.parent_id = ? AND h.status = 'active'
    `;

    const params = [parentId];

    // Add child filter if specified
    if (childId) {
      sql += ' AND c.id = ?';
      params.push(childId);
    }

    // Add order by
    sql += ' ORDER BY h.due_date DESC, h.created_at DESC, c.first_name';

    console.log(`📊 Executing homework query for parent ${parentId}`);
    const homework = await query(sql, params);
    console.log(`📚 Found ${homework.length} homework assignments for parent ${parentId}`);

    // Get children list for the parent (for the selector)
    const children = await query(`
      SELECT 
        c.id,
        c.first_name,
        c.last_name,
        cl.name as class_name
      FROM children c
      LEFT JOIN classes cl ON cl.id = c.class_id
      WHERE c.parent_id = ?
      ORDER BY c.first_name
    `, [parentId]);

    res.json({
      success: true,
      homework,
      children
    });

  } catch (error) {
    console.error('Error fetching homework:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get homework for a specific class (teacher only)
router.get('/class/:classId', verifyTokenMiddleware, async (req, res) => {
  try {
    const { classId } = req.params;

    // Verify the requesting user is the teacher of this class or admin
    if (req.user.userType !== 'admin') {
      // For teachers, check if they are assigned to this class
      if (req.user.userType === 'teacher') {
        const [teacher] = await query(
          'SELECT className FROM staff WHERE id = ? AND role = ?',
          [req.user.id, 'teacher']
        );
        
        if (!teacher || !teacher.className) {
          return res.status(403).json({ error: 'Teacher not assigned to any class' });
        }

        // Get class info to verify teacher assignment
        const [classInfo] = await query(
          'SELECT name FROM classes WHERE id = ?',
          [classId]
      );

        if (!classInfo || classInfo.name !== teacher.className) {
          return res.status(403).json({ error: 'Access denied - not your class' });
        }
      } else {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Get all homework for the class - Fixed table names
    const homework = await query(`
      SELECT 
        h.*,
        cl.name as class_name,
        s.name as teacher_name,
        COUNT(DISTINCT hs.id) as submissions_count,
        COUNT(DISTINCT c.id) as total_students
      FROM homework h
      LEFT JOIN classes cl ON cl.id = h.class_id
      LEFT JOIN staff s ON s.id = h.teacher_id
      LEFT JOIN children c ON c.class_id = h.class_id
      LEFT JOIN homework_submissions hs ON hs.homework_id = h.id AND hs.child_id = c.id
      WHERE h.class_id = ?
      GROUP BY h.id
      ORDER BY h.due_date DESC
    `, [classId]);

    res.json({
      success: true,
      homework
    });

  } catch (error) {
    console.error('Error fetching class homework:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get homework for a specific teacher
router.get('/teacher/:teacherId', verifyTokenMiddleware, async (req, res) => {
  try {
    const { teacherId } = req.params;

    // Verify the requesting user is the teacher themselves or admin
    if (req.user.userType !== 'admin' && (req.user.userType !== 'teacher' || req.user.id !== parseInt(teacherId))) {
      return res.status(403).json({ error: 'Access denied - you can only view your own homework' });
    }

    // Get teacher info to get their assigned class
    const [teacher] = await query(
      'SELECT id, name, email, className, role FROM staff WHERE id = ? AND role = ?',
      [teacherId, 'teacher']
    );

    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    if (!teacher.className) {
      return res.status(404).json({ error: 'Teacher not assigned to any class' });
    }

    // Get the class ID for the teacher's assigned class
    const [classInfo] = await query(
      'SELECT id FROM classes WHERE name = ?',
      [teacher.className]
    );

    if (!classInfo) {
      return res.status(404).json({ error: 'Teacher assigned class not found' });
    }

    // Get all homework created by this teacher for their class
    const homework = await query(`
      SELECT 
        h.*,
        cl.name as class_name,
        s.name as teacher_name,
        COUNT(DISTINCT hs.id) as submissions_count,
        COUNT(DISTINCT c.id) as total_students,
        COUNT(DISTINCT CASE WHEN hs.id IS NOT NULL THEN hs.id END) as submitted_count,
        COUNT(DISTINCT CASE WHEN h.due_date < NOW() AND hs.id IS NULL THEN c.id END) as overdue_count
      FROM homework h
      LEFT JOIN classes cl ON cl.id = h.class_id
      LEFT JOIN staff s ON s.id = h.teacher_id
      LEFT JOIN children c ON c.class_id = h.class_id
      LEFT JOIN homework_submissions hs ON hs.homework_id = h.id AND hs.child_id = c.id
      WHERE h.teacher_id = ? AND h.class_id = ?
      GROUP BY h.id
      ORDER BY h.due_date DESC
    `, [teacherId, classInfo.id]);

    // Get teacher's class statistics
    const [stats] = await query(`
      SELECT 
        COUNT(DISTINCT c.id) as total_students,
        COUNT(DISTINCT h.id) as total_homework,
        COUNT(DISTINCT hs.id) as total_submissions
      FROM classes cl
      LEFT JOIN children c ON c.class_id = cl.id
      LEFT JOIN homework h ON h.class_id = cl.id AND h.teacher_id = ?
      LEFT JOIN homework_submissions hs ON hs.homework_id = h.id
      WHERE cl.id = ?
    `, [teacherId, classInfo.id]);

    res.json({
      success: true,
      teacher: {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        className: teacher.className
      },
      homework,
      stats: stats || {
        total_students: 0,
        total_homework: 0,
        total_submissions: 0
      }
    });

  } catch (error) {
    console.error('Error fetching teacher homework:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get homework details with submissions
router.get('/:homeworkId', verifyTokenMiddleware, async (req, res) => {
  try {
    const { homeworkId } = req.params;

    // Get homework details - Fixed table names
    const [homework] = await query(`
      SELECT 
        h.*,
        cl.name as class_name,
        s.name as teacher_name,
        s.email as teacher_email
      FROM homework h
      LEFT JOIN classes cl ON cl.id = h.class_id
      LEFT JOIN staff s ON s.id = h.teacher_id
      WHERE h.id = ?
    `, [homeworkId]);

    if (!homework) {
      return res.status(404).json({ error: 'Homework not found' });
    }

    // Get submissions for this homework - Fixed table and column names
    const submissions = await query(`
      SELECT 
        hs.*,
        c.first_name,
        c.last_name,
        u.name as parent_name,
        hs.file_url as file_name,
        hs.file_url,
        hs.submitted_at
      FROM homework_submissions hs
      JOIN children c ON hs.child_id = c.id
      JOIN users u ON c.parent_id = u.id
      WHERE hs.homework_id = ?
      ORDER BY hs.submitted_at DESC
    `, [homeworkId]);

    // Add submissions to homework object
    homework.submissions = submissions;

    res.json({
      success: true,
      homework
    });

  } catch (error) {
    console.error('Error fetching homework details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Submit homework
router.post('/:homeworkId/submit', verifyTokenMiddleware, upload.array('files', 5), async (req, res) => {
  try {
    const { homeworkId } = req.params;
    const { child_id, comments } = req.body;

    // Validate required fields
    if (!child_id) {
      return res.status(400).json({
        success: false,
        message: 'Child ID is required'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one file is required for submission'
      });
    }

    // Verify homework exists
    const [homework] = await query(`
      SELECT 
        h.*,
        cl.name as class_name,
        s.name as teacher_name
      FROM homework h
      LEFT JOIN classes cl ON cl.id = h.class_id
      LEFT JOIN staff s ON s.id = h.teacher_id
      WHERE h.id = ?
    `, [homeworkId]);

    if (!homework) {
      return res.status(404).json({
        success: false,
        message: 'Homework assignment not found'
      });
    }

    // Verify child exists and belongs to the requesting parent (if parent)
    const [child] = await query(`
      SELECT c.*, cl.name as class_name
      FROM children c
      LEFT JOIN classes cl ON cl.id = c.class_id
      WHERE c.id = ?
    `, [child_id]);

    if (!child) {
      return res.status(404).json({
        success: false,
        message: 'Child not found'
      });
    }

    // Check if user has permission to submit for this child
    if (req.user.userType === 'parent' && child.parent_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only submit homework for your own children'
      });
    }

    // Check if already submitted
    const [existingSubmission] = await query(`
      SELECT id FROM homework_submissions 
      WHERE homework_id = ? AND child_id = ?
    `, [homeworkId, child_id]);

    if (existingSubmission) {
      return res.status(400).json({
        success: false,
        message: 'Homework has already been submitted for this child'
      });
    }

    // Prepare file URLs
    const fileUrls = req.files.map(file => `/uploads/homework_submissions/${file.filename}`);
    const mainFileUrl = fileUrls[0]; // Use first file as main file URL

    // Insert submission record
    const submissionResult = await query(`
      INSERT INTO homework_submissions (
        homework_id, 
        child_id, 
        submitted_at, 
        file_url, 
        feedback,
        status
      ) VALUES (?, ?, NOW(), ?, ?, 'submitted')
    `, [
      homeworkId,
      child_id,
      mainFileUrl,
      comments || null
    ]);

    const submissionId = submissionResult.insertId;

    // Get submission details for response
    const [submission] = await query(`
      SELECT 
        hs.*,
        c.first_name,
        c.last_name,
        h.title as homework_title
      FROM homework_submissions hs
      JOIN children c ON hs.child_id = c.id
      JOIN homework h ON hs.homework_id = h.id
      WHERE hs.id = ?
    `, [submissionId]);

    res.json({
      success: true,
      message: 'Homework submitted successfully',
      submission: {
        id: submissionId,
        homework_id: homeworkId,
        child_id: child_id,
        submitted_at: submission.submitted_at,
        file_url: mainFileUrl,
        files: fileUrls,
        comments: comments,
        status: 'submitted',
        child_name: `${submission.first_name} ${submission.last_name}`,
        homework_title: submission.homework_title
      }
    });

  } catch (error) {
    console.error('Error submitting homework:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit homework',
      error: error.message
    });
  }
});

// Create new homework assignment (teacher only)
router.post('/', verifyTokenMiddleware, async (req, res) => {
  try {
    const {
      title,
      description,
      instructions,
      due_date,
      class_id,
      classId, // Also accept classId for compatibility
      child_ids,
      selectedChildren, // Also accept selectedChildren for individual assignments
      assignment_type,
      subject,
      grade,
      difficulty,
      estimated_duration,
      learning_objectives,
      required_materials,
      assessment_criteria
    } = req.body;

    // Verify user is a teacher
    if (req.user.userType !== 'teacher') {
      return res.status(403).json({ error: 'Access denied - teachers only' });
    }

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Title and description are required'
      });
    }

    // Get teacher's assigned class for validation
    const [teacher] = await query(
      'SELECT id, name, className FROM staff WHERE id = ? AND role = ?',
      [req.user.id, 'teacher']
    );

    if (!teacher) {
      return res.status(403).json({ error: 'Teacher not found' });
    }

    if (!teacher.className) {
      return res.status(400).json({
        success: false,
        message: 'Teacher is not assigned to any class. Please contact admin.'
      });
    }

    // Get the teacher's class ID
    const [teacherClass] = await query(
      'SELECT id FROM classes WHERE name = ?',
      [teacher.className]
    );

    if (!teacherClass) {
      return res.status(400).json({
        success: false,
        message: 'Teacher assigned class not found in database'
      });
    }

    const teacherClassId = teacherClass.id;
    console.log(`👩‍🏫 Teacher ${teacher.name} creating homework for class ${teacher.className} (ID: ${teacherClassId})`);

    // Determine assignment type and validate accordingly
    const actualAssignmentType = assignment_type || (selectedChildren && selectedChildren.length > 0 ? 'individual' : 'class');
    const actualChildIds = child_ids || selectedChildren || [];
    const actualClassId = class_id || classId || teacherClassId;

    console.log(`📝 Creating ${actualAssignmentType} homework: "${title}" by teacher ${req.user.id}`);
    console.log(`📍 Using class_id: ${actualClassId}`);
    console.log(`👥 Selected children: ${actualChildIds.length} students`);

    // Validate assignment type
    if (actualAssignmentType === 'individual' && actualChildIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one student must be selected for individual assignments'
      });
    }

    // For individual assignments, verify the children belong to teacher's class
    if (actualAssignmentType === 'individual' && actualChildIds.length > 0) {
      const childrenInClass = await query(
        `SELECT id, first_name, last_name FROM children 
         WHERE id IN (${actualChildIds.map(() => '?').join(',')}) AND class_id = ?`,
        [...actualChildIds, teacherClassId]
      );
      
      if (childrenInClass.length !== actualChildIds.length) {
        return res.status(400).json({
          success: false,
          message: 'Some selected students do not belong to your class'
        });
      }
      
      console.log(`✅ Verified ${childrenInClass.length} children belong to teacher's class`);
    }

    // Set default due date if not provided (7 days from now)
    const finalDueDate = due_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

    // For individual assignments, always use teacher's class
    let finalClassId = actualClassId;
    if (actualAssignmentType === 'individual') {
      finalClassId = teacherClassId;
      console.log(`📍 Using teacher's class_id ${finalClassId} for individual assignment`);
    }

    // Insert homework record with proper validation
    const result = await query(`
      INSERT INTO homework (
        title,
        description,
        instructions,
        teacher_id,
        class_id,
        assignment_type,
        due_date,
        subject,
        grade,
        difficulty,
        estimated_duration,
        status,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW())
    `, [
      title,
      description || '',
      instructions || '',
      req.user.id,
      finalClassId,
      actualAssignmentType,
      finalDueDate,
      subject || '',
      grade || '',
      difficulty || 'medium',
      estimated_duration || 30
    ]);

    const homeworkId = result.insertId;
    console.log(`✅ Homework created with ID: ${homeworkId}`);

    // For individual assignments, create homework_individual_assignments entries
    if (actualAssignmentType === 'individual' && actualChildIds.length > 0) {
      console.log(`👥 Creating individual assignments for ${actualChildIds.length} children`);
      
      // Create individual assignment table if it doesn't exist
      try {
        await query(`
          CREATE TABLE IF NOT EXISTS homework_individual_assignments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            homework_id INT NOT NULL,
            child_id INT NOT NULL,
            status ENUM('assigned', 'submitted', 'graded') DEFAULT 'assigned',
            assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_homework_id (homework_id),
            INDEX idx_child_id (child_id),
            UNIQUE KEY unique_assignment (homework_id, child_id)
          )
        `);
      } catch (tableError) {
        console.log('Individual assignments table already exists');
      }

      // Insert individual assignments
      for (const childId of actualChildIds) {
        try {
          await query(
            `INSERT INTO homework_individual_assignments (homework_id, child_id, status, assigned_at) 
             VALUES (?, ?, 'assigned', NOW())
             ON DUPLICATE KEY UPDATE status = 'assigned', assigned_at = NOW()`,
            [homeworkId, childId]
          );
          console.log(`✅ Assigned homework ${homeworkId} to child ${childId}`);
        } catch (insertError) {
          console.error(`❌ Error assigning to child ${childId}:`, insertError.message);
        }
      }
      
      console.log(`✅ Created ${actualChildIds.length} individual assignments for homework ${homeworkId}`);
    }

    // Get child names for response (for individual assignments)
    let assignedChildren = [];
    if (actualAssignmentType === 'individual' && actualChildIds.length > 0) {
      const children = await query(
        `SELECT id, first_name, last_name, className FROM children WHERE id IN (${actualChildIds.map(() => '?').join(',')})`,
        actualChildIds
      );
      assignedChildren = children.map(child => ({
        id: child.id,
        name: `${child.first_name} ${child.last_name}`,
        className: child.className
      }));
    }

    // Log the successful creation
    console.log(`🎉 Successfully created ${actualAssignmentType} homework "${title}"`);
    console.log(`📋 Homework ID: ${homeworkId}`);
    console.log(`👩‍🏫 Teacher: ${teacher.name} (ID: ${req.user.id})`);
    console.log(`🏫 Class: ${teacher.className} (ID: ${finalClassId})`);
    if (actualAssignmentType === 'individual') {
      console.log(`👥 Assigned to: ${assignedChildren.length} students`);
    }

    res.status(201).json({
      success: true,
      homework: {
        id: homeworkId,
        title,
        description,
        instructions,
        teacher_id: req.user.id,
        teacher_name: teacher.name,
        class_id: finalClassId,
        class_name: teacher.className,
        due_date: finalDueDate,
        subject,
        grade,
        difficulty,
        estimated_duration,
        assignment_type: actualAssignmentType,
        status: 'active',
        assigned_children: assignedChildren,
        created_at: new Date().toISOString()
      },
      message: `Homework "${title}" created successfully${actualAssignmentType === 'individual' ? ` for ${assignedChildren.length} students` : ` for ${teacher.className} class`}`
    });

  } catch (error) {
    console.error('Error creating homework:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      message: error.message 
    });
  }
});

export default router;
