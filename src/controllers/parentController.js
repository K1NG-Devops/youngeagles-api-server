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

// GET /parent/reports?child_id=123
export const getParentReport = async (req, res) => {
  const parentId = req.user.id;
  const childId = req.query.child_id;
  if (!childId) {
    return res.status(400).json({ message: 'child_id is required' });
  }
  try {
    // Get child info
    const [child] = await query('SELECT id, name FROM children WHERE id = ? AND parent_id = ?', [childId, parentId]);
    if (!child) {
      return res.status(404).json({ message: 'Child not found for this parent.' });
    }
    // Get homework stats
    const [totalHomework] = await query('SELECT COUNT(*) as count FROM homeworks WHERE child_id = ?', [childId]);
    const [submitted] = await query('SELECT COUNT(*) as count FROM homework_submissions WHERE child_id = ? AND submitted = 1', [childId]);
    const [graded] = await query('SELECT COUNT(*) as count FROM homework_submissions WHERE child_id = ? AND grade IS NOT NULL', [childId]);
    const [avgGradeRow] = await query('SELECT AVG(grade) as avgGrade FROM homework_submissions WHERE child_id = ? AND grade IS NOT NULL', [childId]);
    const avgGrade = avgGradeRow && avgGradeRow.avgGrade ? avgGradeRow.avgGrade.toFixed(2) : null;
    const submissionRate = totalHomework.count > 0 ? (submitted.count / totalHomework.count) * 100 : 0;
    // Get recent grades
    const recentGrades = await query(
      'SELECT h.title, s.grade, s.graded_at as date FROM homework_submissions s JOIN homeworks h ON s.homework_id = h.id WHERE s.child_id = ? AND s.grade IS NOT NULL ORDER BY s.graded_at DESC LIMIT 5',
      [childId]
    );
    res.json({
      childId: child.id,
      childName: child.name,
      totalHomework: totalHomework.count,
      submitted: submitted.count,
      graded: graded.count,
      avgGrade,
      submissionRate: Number(submissionRate.toFixed(1)),
      recentGrades: recentGrades.map(g => ({
        title: g.title,
        grade: g.grade,
        date: g.date
      }))
    });
  } catch (err) {
    console.error('Error generating parent report:', err);
    res.status(500).json({ message: 'Server error.' });
  }
}; 