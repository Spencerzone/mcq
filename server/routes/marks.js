const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function ownsTest(teacherId, testId) {
  return db.prepare(`
    SELECT t.* FROM tests t
    JOIN classes c ON c.id = t.class_id
    WHERE t.id = ? AND c.teacher_id = ?
  `).get(testId, teacherId);
}

// Get all responses for a test (with student info)
router.get('/test/:testId', (req, res) => {
  const test = ownsTest(req.teacher.id, req.params.testId);
  if (!test) return res.status(404).json({ error: 'Not found' });

  const students = db.prepare('SELECT * FROM students WHERE class_id = ? ORDER BY name').all(test.class_id);
  const responses = db.prepare('SELECT * FROM responses WHERE test_id = ?').all(req.params.testId);
  const responseMap = Object.fromEntries(responses.map(r => [r.student_id, JSON.parse(r.answers)]));

  res.json({
    test: { ...test, answer_key: JSON.parse(test.answer_key) },
    students: students.map(s => ({
      ...s,
      answers: responseMap[s.id] || Array(test.num_questions).fill(null)
    }))
  });
});

// Upsert answers for a student in a test
router.put('/test/:testId/student/:studentId', (req, res) => {
  const test = ownsTest(req.teacher.id, req.params.testId);
  if (!test) return res.status(404).json({ error: 'Not found' });

  const { answers } = req.body;
  if (!Array.isArray(answers)) return res.status(400).json({ error: 'answers must be an array' });

  db.prepare(`
    INSERT INTO responses (test_id, student_id, answers)
    VALUES (?, ?, ?)
    ON CONFLICT(test_id, student_id) DO UPDATE SET answers = excluded.answers
  `).run(req.params.testId, req.params.studentId, JSON.stringify(answers));

  res.json({ ok: true });
});

module.exports = router;
