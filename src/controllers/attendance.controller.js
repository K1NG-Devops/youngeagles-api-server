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
    search,
    start,
    end,
    page = 1,
    limit = 20,
    includeMissing = false,
    status,
    format,
    groupBy
  } = req.query;

  if (!teacherId) {
    return res.status(400).json({ message: 'Missing teacherId parameter' });
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    // Step 1: Get attendance records from railway.attendance
    let attendanceQuery = `
      SELECT id, child_id, date, status, late
      FROM attendance
      WHERE teacher_id = ?
    `;
    const attendanceParams = [teacherId];

    if (start && end) {
      attendanceQuery += ` AND date BETWEEN ? AND ?`;
      attendanceParams.push(start, end);
    }

    if (status) {
      attendanceQuery += ` AND status = ?`;
      attendanceParams.push(status);
    }

    attendanceQuery += ` ORDER BY date DESC LIMIT ? OFFSET ?`;
    attendanceParams.push(parseInt(limit), offset);

    const attendanceRecords = await query(attendanceQuery, attendanceParams, 'railway');

    // Extract unique child IDs from attendance records for fetching children info
    const childIds = [...new Set(attendanceRecords.map(r => r.child_id))];

    // Step 2: Get children info from skydek_DB.children
    let childrenMap = {};
    if (childIds.length > 0) {
      // Optional: Add search filter to children query if search param is provided
      let childrenQuery = `SELECT id, name, className FROM children WHERE id IN (?)`;
      const childrenParams = [childIds];

      if (search) {
        childrenQuery += ` AND name LIKE ?`;
        childrenParams.push(`%${search}%`);
      }

      const children = await query(childrenQuery, childrenParams, 'skydek_DB');

      // Map children by id for easy lookup
      childrenMap = children.reduce((acc, child) => {
        acc[child.id] = child;
        return acc;
      }, {});
    }

    // Step 3: Merge attendance records with children info
    let data = attendanceRecords.map(record => ({
      ...record,
      child_name: childrenMap[record.child_id]?.name || 'Unknown',
      className: childrenMap[record.child_id]?.className || 'Unknown',
    }));

    // Step 4: Handle includeMissing - children assigned but no attendance marked
    if (includeMissing === 'true' && start && end) {
      // Fetch all children assigned to teacher within date range, 
      // using className or teacherId logic (adjust this as needed!)
      // Since children don't have teacher_id, assume you have a way to get assigned children, 
      // e.g., by teacher's className or another join you must implement externally.

      // For now, let's assume you have a function or a method to get assigned children IDs:
      // This is a placeholder; you'll need your own logic here.

      // Example: getAssignedChildren(teacherId) returns array of children IDs assigned to teacher
      // Let's assume assignedChildren is fetched from skydek_DB

      const assignedChildrenQuery = `SELECT id, name FROM children WHERE className IN (
        SELECT className FROM teachers WHERE id = ?
      )`;
      const [assignedChildren] = await query(assignedChildrenQuery, [teacherId], 'skydek_DB');

      const assignedChildrenMap = assignedChildren.reduce((acc, child) => {
        acc[child.id] = child;
        return acc;
      }, {});

      // Find children with no attendance in the date range
      const attendanceChildSet = new Set(childIds);
      const missingRecords = assignedChildren
        .filter(child => !attendanceChildSet.has(child.id))
        .map(child => ({
          child_id: child.id,
          child_name: child.name,
          date: null,
          status: "Not marked",
          late: null,
          className: child.className || 'Unknown',
        }));

      data = [...data, ...missingRecords];
    }

    // Step 5: Grouping data if requested
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
    } else if (groupBy === 'date') {
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

    // Step 6: Export to CSV if requested
    if (format === 'csv') {
      const parser = new Parser();
      // Flatten data for CSV export, whether grouped or not
      const csvData = data.flatMap(d =>
        d.records ? d.records.map(r => ({
          ...r,
          child_id: d.child_id,
          child_name: d.child_name,
          date: r.date || d.date
        })) : d
      );
      const csv = parser.parse(csvData);
      res.header('Content-Type', 'text/csv');
      res.attachment(`attendance_teacher_${teacherId}.csv`);
      return res.send(csv);
    }

    // Step 7: Return JSON by default with pagination info
    res.status(200).json({
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: attendanceRecords.length === parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({ message: 'Database error' });
  }
};
