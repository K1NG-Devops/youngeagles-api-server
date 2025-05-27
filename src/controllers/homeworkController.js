import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simulated homework storage - Replace with DB logic
const homeworkList = [];

/**
 * Assign homework - teacher uploads homework
 */
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

/**
 * Get homework for parents based on child's age group
 */
export const getHomeworkForParent = (req, res) => {
  const { ageGroup } = req.query;
  const parentHomework = homeworkList.filter(hw => hw.ageGroup === ageGroup);
  res.json(parentHomework);
};

/**
 * Submit homework by parent
 */
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
