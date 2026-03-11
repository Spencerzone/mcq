const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });
router.use(requireAuth);

function ownsClass(teacherId, classId) {
  return db.prepare('SELECT id FROM classes WHERE id = ? AND teacher_id = ?').get(classId, teacherId);
}

router.get('/', (req, res) => {
  if (!ownsClass(req.teacher.id, req.params.classId)) return res.status(404).json({ error: 'Not found' });
  const students = db.prepare('SELECT * FROM students WHERE class_id = ? ORDER BY name').all(req.params.classId);
  res.json(students);
});

router.post('/', (req, res) => {
  if (!ownsClass(req.teacher.id, req.params.classId)) return res.status(404).json({ error: 'Not found' });
  const { name, student_ref } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const result = db.prepare('INSERT INTO students (class_id, name, student_ref) VALUES (?, ?, ?)').run(req.params.classId, name, student_ref || null);
  res.json({ id: result.lastInsertRowid, class_id: Number(req.params.classId), name, student_ref: student_ref || null });
});

// Bulk import: array of { name, student_ref }
router.post('/import', (req, res) => {
  if (!ownsClass(req.teacher.id, req.params.classId)) return res.status(404).json({ error: 'Not found' });
  const { students } = req.body;
  if (!Array.isArray(students)) return res.status(400).json({ error: 'students must be an array' });
  const insert = db.prepare('INSERT INTO students (class_id, name, student_ref) VALUES (?, ?, ?)');
  const insertMany = db.transaction((rows) => rows.map(s => {
    const r = insert.run(req.params.classId, s.name, s.student_ref || null);
    return { id: r.lastInsertRowid, class_id: Number(req.params.classId), name: s.name, student_ref: s.student_ref || null };
  }));
  const created = insertMany(students.filter(s => s.name));
  res.json(created);
});

router.put('/:studentId', (req, res) => {
  if (!ownsClass(req.teacher.id, req.params.classId)) return res.status(404).json({ error: 'Not found' });
  const { name, student_ref } = req.body;
  db.prepare('UPDATE students SET name = ?, student_ref = ? WHERE id = ? AND class_id = ?').run(name, student_ref || null, req.params.studentId, req.params.classId);
  res.json({ ok: true });
});

router.delete('/:studentId', (req, res) => {
  if (!ownsClass(req.teacher.id, req.params.classId)) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM students WHERE id = ? AND class_id = ?').run(req.params.studentId, req.params.classId);
  res.json({ ok: true });
});

module.exports = router;
