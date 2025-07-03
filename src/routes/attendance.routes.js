import express from 'express';
import { query } from '../db.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get teacher's class attendance for a specific date
router.get('/class/:date?', authenticateToken, async (req, res) => {
  try {
    const teacherId = req.user.id;
    const date = req.params.date || new Date().toISOString().split('T')[0]; // Default to today

    // Verify user is a teacher
    if (req.user.userType !== 'teacher') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied - teachers only' 
      });
    }

    // Get teacher's class assignment
    const [teacher] = await query(
      'SELECT className FROM staff WHERE id = ? AND role = ?',
      [teacherId, 'teacher']
    );

    if (!teacher || !teacher.className) {
      return res.status(404).json({ 
        success: false, 
        error: 'No class assigned to teacher' 
      });
    }

    // Get all students in teacher's class with their attendance status for the date
    const students = await query(`
      SELECT 
        c.id,
        c.name,
        c.grade,
        c.age,
        c.className,
        COALESCE(a.status, 'unmarked') as attendance_status,
        a.marked_at,
        a.notes
      FROM children c
      LEFT JOIN attendance a ON c.id = a.child_id AND DATE(a.attendance_date) = ?
      WHERE c.className = ?
      ORDER BY c.name ASC
    `, [date, teacher.className]);

    res.json({
      success: true,
      date,
      className: teacher.className,
      students,
      totalStudents: students.length,
      attendanceStats: {
        present: students.filter(s => s.attendance_status === 'present').length,
        absent: students.filter(s => s.attendance_status === 'absent').length,
        late: students.filter(s => s.attendance_status === 'late').length,
        unmarked: students.filter(s => s.attendance_status === 'unmarked').length
      }
    });

  } catch (error) {
    console.error('Error fetching class attendance:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch attendance' 
    });
  }
});

// Mark attendance for a student (only for teacher's own class)
router.post('/mark', authenticateToken, async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { childId, date, status, notes } = req.body;

    // Validate required fields
    if (!childId || !date || !status) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: childId, date, status' 
      });
    }

    // Validate status
    const validStatuses = ['present', 'absent', 'late'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid status. Must be: present, absent, or late' 
      });
    }

    // Verify user is a teacher
    if (req.user.userType !== 'teacher') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied - teachers only' 
      });
    }

    // Get teacher's class assignment
    const [teacher] = await query(
      'SELECT className FROM staff WHERE id = ? AND role = ?',
      [teacherId, 'teacher']
    );

    if (!teacher || !teacher.className) {
      return res.status(404).json({ 
        success: false, 
        error: 'No class assigned to teacher' 
      });
    }

    // Verify the child belongs to teacher's class
    const [child] = await query(
      'SELECT id, name, className FROM children WHERE id = ?',
      [childId]
    );

    if (!child) {
      return res.status(404).json({ 
        success: false, 
        error: 'Student not found' 
      });
    }

    if (child.className !== teacher.className) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied - student not in your class' 
      });
    }

    // Mark attendance (insert or update)
    await query(`
      INSERT INTO attendance (child_id, attendance_date, status, notes, teacher_id, recorded_by, marked_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        status = VALUES(status),
        notes = VALUES(notes),
        teacher_id = VALUES(teacher_id),
        recorded_by = VALUES(recorded_by),
        marked_at = NOW()
    `, [childId, date, status, notes || null, teacherId, teacherId]);

    res.json({ 
      success: true, 
      message: `Attendance marked as ${status} for ${child.name}`,
      data: {
        childId,
        childName: child.name,
        date,
        status,
        notes
      }
    });

  } catch (error) {
    console.error('Error marking attendance:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to mark attendance' 
    });
  }
});

// Bulk mark attendance for multiple students
router.post('/bulk-mark', authenticateToken, async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { date, attendanceRecords } = req.body;

    // Validate required fields
    if (!date || !Array.isArray(attendanceRecords) || attendanceRecords.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: date and attendanceRecords array' 
      });
    }

    // Verify user is a teacher
    if (req.user.userType !== 'teacher') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied - teachers only' 
      });
    }

    // Get teacher's class assignment
    const [teacher] = await query(
      'SELECT className FROM staff WHERE id = ? AND role = ?',
      [teacherId, 'teacher']
    );

    if (!teacher || !teacher.className) {
      return res.status(404).json({ 
        success: false, 
        error: 'No class assigned to teacher' 
      });
    }

    const validStatuses = ['present', 'absent', 'late'];
    const results = [];
    const errors = [];

    for (const record of attendanceRecords) {
      try {
        const { childId, status, notes } = record;

        // Validate each record
        if (!childId || !status || !validStatuses.includes(status)) {
          errors.push({
            childId,
            error: 'Invalid childId or status'
          });
          continue;
        }

        // Verify the child belongs to teacher's class
        const [child] = await query(
          'SELECT id, name, className FROM children WHERE id = ?',
          [childId]
        );

        if (!child || child.className !== teacher.className) {
          errors.push({
            childId,
            error: 'Student not found or not in your class'
          });
          continue;
        }

        // Mark attendance
        await query(`
          INSERT INTO attendance (child_id, attendance_date, status, notes, teacher_id, recorded_by, marked_at)
          VALUES (?, ?, ?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
            status = VALUES(status),
            notes = VALUES(notes),
            teacher_id = VALUES(teacher_id),
            recorded_by = VALUES(recorded_by),
            marked_at = NOW()
        `, [childId, date, status, notes || null, teacherId, teacherId]);

        results.push({
          childId,
          childName: child.name,
          status,
          success: true
        });

      } catch (recordError) {
        console.error(`Error processing attendance for child ${record.childId}:`, recordError);
        errors.push({
          childId: record.childId,
          error: 'Processing error'
        });
      }
    }

    res.json({
      success: true,
      message: `Bulk attendance processed: ${results.length} successful, ${errors.length} errors`,
      results,
      errors,
      summary: {
        total: attendanceRecords.length,
        successful: results.length,
        failed: errors.length
      }
    });

  } catch (error) {
    console.error('Error bulk marking attendance:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process bulk attendance' 
    });
  }
});

// Get attendance history for teacher's class
router.get('/history/:startDate/:endDate', authenticateToken, async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { startDate, endDate } = req.params;

    // Verify user is a teacher
    if (req.user.userType !== 'teacher') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied - teachers only' 
      });
    }

    // Get teacher's class assignment
    const [teacher] = await query(
      'SELECT className FROM staff WHERE id = ? AND role = ?',
      [teacherId, 'teacher']
    );

    if (!teacher || !teacher.className) {
      return res.status(404).json({ 
        success: false, 
        error: 'No class assigned to teacher' 
      });
    }

    // Get attendance history for teacher's class
    const attendance = await query(`
      SELECT 
        a.attendance_date as date,
        a.status,
        a.notes,
        a.marked_at,
        c.id as child_id,
        c.name as child_name,
        c.grade
      FROM attendance a
      JOIN children c ON a.child_id = c.id
      WHERE c.className = ? 
        AND DATE(a.attendance_date) BETWEEN ? AND ?
      ORDER BY a.attendance_date DESC, c.name ASC
    `, [teacher.className, startDate, endDate]);

    res.json({
      success: true,
      className: teacher.className,
      startDate,
      endDate,
      attendance,
      totalRecords: attendance.length
    });

  } catch (error) {
    console.error('Error fetching attendance history:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch attendance history' 
    });
  }
});

// Get attendance statistics for teacher's class
router.get('/stats/:month?', authenticateToken, async (req, res) => {
  try {
    const teacherId = req.user.id;
    const month = req.params.month || new Date().toISOString().substr(0, 7); // Default to current month (YYYY-MM)

    // Verify user is a teacher
    if (req.user.userType !== 'teacher') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied - teachers only' 
      });
    }

    // Get teacher's class assignment
    const [teacher] = await query(
      'SELECT className FROM staff WHERE id = ? AND role = ?',
      [teacherId, 'teacher']
    );

    if (!teacher || !teacher.className) {
      return res.status(404).json({ 
        success: false, 
        error: 'No class assigned to teacher' 
      });
    }

    // Get attendance stats for the month
    const stats = await query(`
      SELECT 
        c.id as child_id,
        c.name as child_name,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as days_present,
        COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as days_absent,
        COUNT(CASE WHEN a.status = 'late' THEN 1 END) as days_late,
        COUNT(a.id) as total_marked_days,
        ROUND((COUNT(CASE WHEN a.status = 'present' THEN 1 END) / COUNT(a.id)) * 100, 2) as attendance_percentage
      FROM children c
      LEFT JOIN attendance a ON c.id = a.child_id AND DATE_FORMAT(a.attendance_date, '%Y-%m') = ?
      WHERE c.className = ?
      GROUP BY c.id, c.name
      ORDER BY c.name ASC
    `, [month, teacher.className]);

    // Calculate class averages
    const totalStudents = stats.length;
    const classStats = stats.reduce((acc, student) => {
      acc.totalPresent += student.days_present;
      acc.totalAbsent += student.days_absent;
      acc.totalLate += student.days_late;
      acc.totalMarkedDays += student.total_marked_days;
      return acc;
    }, { totalPresent: 0, totalAbsent: 0, totalLate: 0, totalMarkedDays: 0 });

    const classAttendanceRate = classStats.totalMarkedDays > 0 
      ? Math.round((classStats.totalPresent / classStats.totalMarkedDays) * 100 * 100) / 100
      : 0;

    res.json({
      success: true,
      className: teacher.className,
      month,
      studentStats: stats,
      classStats: {
        totalStudents,
        averageAttendanceRate: classAttendanceRate,
        totalPresent: classStats.totalPresent,
        totalAbsent: classStats.totalAbsent,
        totalLate: classStats.totalLate,
        totalMarkedDays: classStats.totalMarkedDays
      }
    });

  } catch (error) {
    console.error('Error fetching attendance stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch attendance statistics' 
    });
  }
});

export default router;
