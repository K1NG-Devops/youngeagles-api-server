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

    console.log('Homeworks fetched:', homeworks);
    return res.status(200).json({ homeworks });

  } catch (error) {
    console.error('🔥 Controller Error:', error); // Enhanced logging
    return res.status(500).json({ error: 'Internal server error' });
  }
};



export const submitHomework = (req, res) => {
  const { homeworkId, childName } = req.body;
  const filePath = req.file ? `/uploads/submissions/${req.file.filename}` : null;

  if (!filePath) {
    return res.status(400).json({ message: "Submission file is required" });
  }

  res.status(201).json({
    message: "Homework submitted successfully",
    submission: {
      homeworkId,
      parent: req.user.id,
      childName,
      fileUrl: filePath,
      submittedAt: new Date()
    }
  });
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
