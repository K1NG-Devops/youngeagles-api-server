import express from 'express';
import { execute, query } from '../db.js';

const router = express.Router();

router.post('/upload', async (req, res) => {
  const { title, dueDate, fileURL, uploadedBy, className, grade } = req.body;

  if (!title || !dueDate || !fileURL || !uploadedBy || !className || !grade) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const sql = `
      INSERT INTO homeworks (title, due_date, file_url, uploaded_by_teacher_id, class_name, grade)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const result = await execute(sql, [title, dueDate, fileURL, uploadedBy, className, grade]);
    res.status(201).json({ message: 'Homework uploaded successfully', id: result.insertId });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Server error during upload' });
  }
});

router.get('/list', async (req, res) => {
  const { className, grade } = req.query;

  if (!className || !grade) {
    return res.status(400).json({ error: 'Missing className or grade in query' });
  }

  try {
    const sql = `
      SELECT id, title, due_date AS dueDate, file_url AS fileURL, status
      FROM homeworks
      WHERE class_name = ? AND grade = ?
      ORDER BY due_date ASC
    `;
    const rows = await query(sql, [className, grade]);
    res.status(200).json(rows);
  } catch (err) {
    console.error('Fetch error:', err);
    res.status(500).json({ error: 'Server error during fetch' });
  }
});

export default router;
