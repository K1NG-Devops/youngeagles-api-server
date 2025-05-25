import { Parser } from 'json2csv';
import { query } from "../db.js";

// Helper to get teacher ID from params, query, or body
const getTeacherId = (req) => {
  return req.params.teacher_id || req.query.teacherId || req.body.teacherId;
};

// Mark or update attendance in bulk
export const markAttendance = async (req, res) => {
  console.log("Incoming attendance records:", req.body);
  const records = req.body;

  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ message: 'Attendance data must be a non-empty array' });
  }

  try {
    for (const record of records) {
      const teacher_id = record.teacherId || record.teacher_id;
      const { childId, date, status, late } = record;

      if (!teacher_id || !childId || !date || !status) {
        return res.status(400).json({ message: 'Missing required fields in one or more records' });
      }

      await query(
        `INSERT INTO attendance (teacher_id, child_id, date, status, late)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status), late = VALUES(late)`,
        [teacher_id, childId, date, status, late || false],
        'railway'
      );
    }

    return res.status(201).json({ message: 'Attendance marked or updated for all records' });
  } catch (error) {
    console.error('Error saving batch attendance:', error);
    return res.status(500).json({ message: 'Database error' });
  }
};

export const getAttendanceByTeacher = async (req, res) => {
  const teacher_id = getTeacherId(req);

  if (!teacher_id) {
    return res.status(400).json({ message: 'Missing teacherId parameter' });
  }

  const {
    search,
    start,
    end,
    page = 1,
    limit = 20,
    includeMissing = false,
    status,  // e.g. present, absent
    format,  // json or csv
    groupBy  // 'child' or 'date'
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  let queryStr = `
    SELECT 
      a.id, 
      a.child_id, 
      c.full_name AS child_name, 
      a.date, 
      a.status, 
      a.late
    FROM attendance a
    JOIN children c ON a.child_id = c.id
    WHERE a.teacher_id = ?
  `;
  const queryParams = [teacher_id];

  if (start && end) {
    queryStr += ` AND a.date BETWEEN ? AND ?`;
    queryParams.push(start, end);
  }

  if (status) {
    queryStr += ` AND a.status = ?`;
    queryParams.push(status);
  }

  if (search) {
    queryStr += ` AND c.full_name LIKE ?`;
    queryParams.push(`%${search}%`);
  }

  queryStr += ` ORDER BY a.date DESC LIMIT ? OFFSET ?`;
  queryParams.push(parseInt(limit), offset);

  try {
    const [records] = await query(queryStr, queryParams, 'railway');

    let missingRecords = [];
    if (includeMissing === 'true' && start && end) {
      const [missing] = await query(
        `
        SELECT 
          c.id AS child_id,
          c.full_name AS child_name
        FROM children c
        WHERE c.teacher_id = ?
          AND c.id NOT IN (
            SELECT child_id FROM attendance
            WHERE teacher_id = ? AND date BETWEEN ? AND ?
          )
      `,
        [teacher_id, teacher_id, start, end],
        'railway'
      );

      missingRecords = missing.map(child => ({
        child_id: child.child_id,
        child_name: child.child_name,
        date: null,
        status: "Not marked",
        late: null,
      }));
    }

    let data = [...records, ...missingRecords];

    // Group by child
    if (groupBy === 'child') {
      data = Object.values(data.reduce((acc, item) => {
        if (!acc[item.child_id]) acc[item.child_id] = { ...item, records: [] };
        acc[item.child_id].records.push({
          date: item.date,
          status: item.status,
          late: item.late
        });
        return acc;
      }, {}));
    }

    // Group by date
    if (groupBy === 'date') {
      data = Object.values(data.reduce((acc, item) => {
        if (!acc[item.date]) acc[item.date] = { date: item.date, records: [] };
        acc[item.date].records.push({
          child_id: item.child_id,
          child_name: item.child_name,
          status: item.status,
          late: item.late
        });
        return acc;
      }, {}));
    }

    // Export to CSV
    if (format === 'csv') {
      const parser = new Parser();
      const csv = parser.parse(data.flatMap(d =>
        d.records ? d.records.map(r => ({
          ...r,
          child_id: d.child_id,
          child_name: d.child_name,
          date: r.date || d.date
        })) : d
      ));
      res.header('Content-Type', 'text/csv');
      res.attachment(`attendance_teacher_${teacher_id}.csv`);
      return res.send(csv);
    }

    // Return JSON response
    return res.status(200).json({
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: records.length === parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Error fetching attendance:', error);
    return res.status(500).json({ message: 'Database error' });
  }
};
