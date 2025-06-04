import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { query, execute } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const assignHomework = (req, res) => {
  const { title, instructions, ageGroup, dueDate } = req.body;
  const filePath = req.file ? `/uploads/homework/${req.file.filename}` : null;

  const newHomework = {
    id: homeworkList.length + 1,
    title,
    instructions,
    fileUrl: filePath,
    ageGroup,
    dueDate,
    teacher: req.user.id
  };

  homeworkList.push(newHomework);
  res.status(201).json({ message: 'Homework assigned successfully.', data: newHomework });
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

    // For each homework, check if this parent has submitted
    for (let hw of homeworks) {
      // Save the teacher's file URL separately (handle both file_url and fileUrl)
      hw.teacher_file_url = hw.file_url || hw.fileUrl || null;
      // Now check for parent's submission
      const [submission] = await query(
        'SELECT id, file_url FROM submissions WHERE homework_id = ? AND parent_id = ? LIMIT 1',
        [hw.id, parent_id],
        'skydek_DB'
      );
      hw.submitted = !!submission;
      hw.file_url = submission ? submission.file_url : null;
      hw.submission_id = submission ? submission.id : null;
    }

    console.log('Homeworks fetched:', homeworks);
    return res.status(200).json({ homeworks });

  } catch (error) {
    console.error('🔥 Controller Error:', error); // Enhanced logging
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const submitHomework = async (req, res) => {
  const { homeworkId, parentId, fileUrl, comment } = req.body;
  if (!fileUrl) {
    return res.status(400).json({ message: "File URL is required" });
  }
  try {
    const sql = `INSERT INTO submissions (homework_id, parent_id, file_url, comment) VALUES (?, ?, ?, ?)`;
    await execute(sql, [homeworkId, parentId, fileUrl, comment], 'skydek_DB');
    res.status(201).json({ message: "Homework submitted successfully" });
  } catch (error) {
    console.error('🔥 Error submitting homework:', error);
    res.status(500).json({ error: 'Internal server error' });
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
    const homeworks = await query(
      'SELECT * FROM homeworks WHERE uploadedBy = ?',
      [teacherId]
    );
    res.json({ homeworks });
  } catch (err) {
    console.error('Error fetching homeworks for teacher:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};