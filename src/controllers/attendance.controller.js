import { Parser } from 'json2csv';
import { query } from "../db.js";

// Mark or update attendance in bulk
export const markAttendance = async (req, res) => {
  console.log("Incoming attendance records:", req.body);
  const records = req.body;

  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ message: 'Attendance data must be a non-empty array' });
  }

  try {
    for (const record of records) {
      const { teacherId, childId, date, status, late } = record;

      if (!teacherId || !childId || !date || !status) {
        return res.status(400).json({ message: 'Missing required fields in one or more records' });
      }

      await query(
        `INSERT INTO attendance (teacher_id, child_id, date, status, late)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status), late = VALUES(late)`,
        [teacherId, childId, date, status, late || false],
        'railway'
      );
    }

    res.status(201).json({ message: 'Attendance marked or updated for all records' });
  } catch (error) {
    console.error('Error saving batch attendance:', error);
    res.status(500).json({ message: 'Database error' });
  }
};


export const getAttendanceByTeacher = async (req, res) => {
  const { teacherId } = req.params;
  const {
    start,
    end,
    page = 1,
    limit = 20,
    includeMissing = false,
    status, // present, absent, etc.
    format, // json or csv
    groupBy // child or date
  } = req.query;

  if (!teacherId) {
    return res.status(400).json({ message: 'Missing teacherId parameter' });
  }

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
  const queryParams = [teacherId];

  if (start && end) {
    queryStr += ` AND a.date BETWEEN ? AND ?`;
    queryParams.push(start, end);
  }

  if (status) {
    queryStr += ` AND a.status = ?`;
    queryParams.push(status);
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
        [teacherId, teacherId, start, end],
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

    // Grouping
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
      const csv = parser.parse(data.flatMap(d => d.records ? d.records.map(r => ({
        ...r,
        child_id: d.child_id,
        child_name: d.child_name,
        date: r.date || d.date
      })) : d));
      res.header('Content-Type', 'text/csv');
      res.attachment(`attendance_teacher_${teacherId}.csv`);
      return res.send(csv);
    }

    // Return JSON by default
    res.status(200).json({
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: records.length === parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({ message: 'Database error' });
  }
};
