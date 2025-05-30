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
  console.log('✅ Hitting /for-parent with ID:', parent_id);

  try {
    const [children] = await query(
      'SELECT className FROM children WHERE parent_id = ?',
      [parent_id],
      'railway'
    );
    console.log('🎯 Fetched Children:', children);

    if (!children.length) {
      return res.json({ homeworks: [] });
    }

    const classNames = children.map(c => c.className);
    const placeholders = classNames.map(() => '?').join(', ');
    const sql = `SELECT * FROM homeworks WHERE class_name IN (${placeholders}) ORDER BY due_date DESC`;
    const [homeworks] = await query(sql, classNames, 'railway');

    res.json({ homeworks });
  } catch (err) {
    console.error('🔥 Error fetching homework:', err);
    res.status(500).json({ error: 'Server error' });
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
