const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const classes = db.prepare('SELECT * FROM classes WHERE teacher_id = ?').all(req.teacher.id);
  res.json(classes);
});

router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const result = db.prepare('INSERT INTO classes (teacher_id, name) VALUES (?, ?)').run(req.teacher.id, name);
  res.json({ id: result.lastInsertRowid, teacher_id: req.teacher.id, name });
});

router.put('/:id', (req, res) => {
  const { name } = req.body;
  const cls = db.prepare('SELECT * FROM classes WHERE id = ? AND teacher_id = ?').get(req.params.id, req.teacher.id);
  if (!cls) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE classes SET name = ? WHERE id = ?').run(name, req.params.id);
  res.json({ ...cls, name });
});

router.delete('/:id', (req, res) => {
  const cls = db.prepare('SELECT * FROM classes WHERE id = ? AND teacher_id = ?').get(req.params.id, req.teacher.id);
  if (!cls) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM classes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
