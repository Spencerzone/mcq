const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function ownsClass(teacherId, classId) {
  return db.prepare('SELECT id FROM classes WHERE id = ? AND teacher_id = ?').get(classId, teacherId);
}

function ownsTest(teacherId, testId) {
  return db.prepare(`
    SELECT t.* FROM tests t
    JOIN classes c ON c.id = t.class_id
    WHERE t.id = ? AND c.teacher_id = ?
  `).get(testId, teacherId);
}

// Get all tests for a class
router.get('/class/:classId', (req, res) => {
  if (!ownsClass(req.teacher.id, req.params.classId)) return res.status(404).json({ error: 'Not found' });
  const tests = db.prepare('SELECT * FROM tests WHERE class_id = ?').all(req.params.classId);
  res.json(tests.map(t => ({ ...t, answer_key: JSON.parse(t.answer_key) })));
});

// Get single test
router.get('/:id', (req, res) => {
  const test = ownsTest(req.teacher.id, req.params.id);
  if (!test) return res.status(404).json({ error: 'Not found' });
  res.json({ ...test, answer_key: JSON.parse(test.answer_key) });
});

router.post('/', (req, res) => {
  const { class_id, name, num_questions } = req.body;
  if (!class_id || !name || !num_questions) return res.status(400).json({ error: 'class_id, name, num_questions required' });
  if (!ownsClass(req.teacher.id, class_id)) return res.status(404).json({ error: 'Class not found' });
  const answerKey = JSON.stringify(Array(Number(num_questions)).fill(null));
  const result = db.prepare('INSERT INTO tests (class_id, name, num_questions, answer_key) VALUES (?, ?, ?, ?)').run(class_id, name, num_questions, answerKey);
  res.json({ id: result.lastInsertRowid, class_id, name, num_questions, answer_key: JSON.parse(answerKey) });
});

router.put('/:id', (req, res) => {
  const test = ownsTest(req.teacher.id, req.params.id);
  if (!test) return res.status(404).json({ error: 'Not found' });
  const { name, num_questions, answer_key } = req.body;
  const newName = name ?? test.name;
  const newN = num_questions ?? test.num_questions;
  const newKey = answer_key !== undefined ? JSON.stringify(answer_key) : test.answer_key;
  db.prepare('UPDATE tests SET name = ?, num_questions = ?, answer_key = ? WHERE id = ?').run(newName, newN, newKey, req.params.id);
  res.json({ ...test, name: newName, num_questions: newN, answer_key: JSON.parse(newKey) });
});

router.delete('/:id', (req, res) => {
  if (!ownsTest(req.teacher.id, req.params.id)) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM tests WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
