import { query } from '../db.js';

export const getChildrenForParent = async (req, res) => {
  try {
    const parentId = req.user.id;
    if (!parentId) {
      return res.status(400).json({ message: 'Parent ID missing from token.' });
    }
    const children = await query(
      'SELECT id, name, className, grade, dob FROM children WHERE parent_id = ?',
      [parentId]
    );
    res.json({ children });
  } catch (err) {
    console.error('Error fetching children for parent:', err);
    res.status(500).json({ message: 'Server error.' });
  }
}; 