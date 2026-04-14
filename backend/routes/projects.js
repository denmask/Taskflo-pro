const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  const projects = await db.allAsync(`
    SELECT p.*, u.name as owner_name,
    (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
    (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'done') as done_count
    FROM projects p
    LEFT JOIN users u ON p.owner_id = u.id
    ORDER BY p.created_at DESC
  `);
  res.json(projects);
});

router.post('/', auth, async (req, res) => {
  const { name, description, color, deadline } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome obbligatorio' });
  const result = await db.runAsync(
    'INSERT INTO projects (name, description, color, deadline, owner_id) VALUES (?, ?, ?, ?, ?)',
    [name, description || '', color || '#6366f1', deadline || null, req.user.id]
  );
  const project = await db.getAsync('SELECT * FROM projects WHERE id = ?', [result.lastID]);
  res.json(project);
});

router.put('/:id', auth, async (req, res) => {
  const { name, description, color, status, deadline } = req.body;
  await db.runAsync(
    'UPDATE projects SET name=?, description=?, color=?, status=?, deadline=? WHERE id=?',
    [name, description, color, status, deadline, req.params.id]
  );
  const project = await db.getAsync('SELECT * FROM projects WHERE id=?', [req.params.id]);
  res.json(project);
});

router.delete('/:id', auth, async (req, res) => {
  await db.runAsync('DELETE FROM tasks WHERE project_id=?', [req.params.id]);
  await db.runAsync('DELETE FROM projects WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;