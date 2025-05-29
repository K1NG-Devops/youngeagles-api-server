import express from 'express';
import { authMiddleware, isTeacher } from '../middleware/authMiddleware.js';
import { Homework } from '../models/homeworks.js'

const router = express.Router();

router.post('/upload', authMiddleware, isTeacher, async (req, res) => {
  const {
    title,
    dueDate,
    fileUrl,
    className,
    grade,
    uploadedBy,
  } = req.body;

  if (!title || !dueDate || !fileUrl || !className || !grade || !uploadedBy) {
    return res.status(400).json({ error: "All required fields must be provided." });
  }

  try {
    const newHomework = await Homework.create({
      title,
      due_date: dueDate,
      file_url: fileUrl,
      status: "Pending",
      uploaded_by_teacher_id: uploadedBy,
      class_name: className,
      grade,
      created_at: new Date(),
    });

    res.status(201).json({
      message: "Homework uploaded successfully",
      data: newHomework,
    });
  } catch (err) {
    console.error("Error uploading homework:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});


router.get('/for-parent/:parentId', authMiddleware, async (req, res) => {
  const { parentId } = req.params;

  try {
    // Step 1: Get class names of all children for this parent
    const [children] = await query(
      'SELECT class_name FROM skydekDB.children WHERE parent_id = ?',
      [parentId]
    );

    if (!children.length) {
      return res.status(404).json({ message: "No children linked to this parent." });
    }

    const classNames = children.map(child => child.class_name);

    // Step 2: Get homeworks for those classNames
    const [homeworks] = await query(
      'SELECT * FROM homeworks WHERE class_name IN (?) ORDER BY due_date DESC',
      [classNames]
    );

    res.json({ homeworks });
  } catch (err) {
    console.error("Fetch homework error:", err);
    res.status(500).json({ error: "Failed to fetch homework." });
  }
});