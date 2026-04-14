const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/stats/summary', auth, async (req, res) => {
  const total = (await db.getAsync('SELECT COUNT(*) as n FROM tasks')).n;
  const done = (await db.getAsync("SELECT COUNT(*) as n FROM tasks WHERE status='done'")).n;
  const inprogress = (await db.getAsync("SELECT COUNT(*) as n FROM tasks WHERE status='in_progress'")).n;
  const overdue = (await db.getAsync("SELECT COUNT(*) as n FROM tasks WHERE due_date < date('now') AND status != 'done'")).n;
  const totalMinutesRow = await db.getAsync('SELECT SUM(minutes) as m FROM time_logs');
  const totalMinutes = totalMinutesRow.m || 0;
  const byProject = await db.allAsync(`
    SELECT p.name, p.color, COUNT(t.id) as total,
    SUM(CASE WHEN t.status='done' THEN 1 ELSE 0 END) as done
    FROM projects p LEFT JOIN tasks t ON t.project_id=p.id GROUP BY p.id
  `);
  const byDay = await db.allAsync(`
    SELECT date(logged_at) as day, SUM(minutes) as minutes
    FROM time_logs WHERE logged_at >= date('now','-7 days')
    GROUP BY day ORDER BY day
  `);
  res.json({ total, done, inprogress, overdue, totalMinutes, byProject, byDay });
});

router.get('/', auth, async (req, res) => {
  const { project_id, status, assigned_to } = req.query;
  let sql = `
    SELECT t.*, u.name as assignee_name, u.avatar_color as assignee_color,
    p.name as project_name, p.color as project_color
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE 1=1
  `;
  const params = [];
  if (project_id) { sql += ' AND t.project_id = ?'; params.push(project_id); }
  if (status) { sql += ' AND t.status = ?'; params.push(status); }
  if (assigned_to) { sql += ' AND t.assigned_to = ?'; params.push(assigned_to); }
  sql += ' ORDER BY t.position ASC, t.created_at DESC';
  res.json(await db.allAsync(sql, params));
});

router.post('/', auth, async (req, res) => {
  const { title, description, project_id, assigned_to, priority, due_date, estimated_minutes, tags } = req.body;
  if (!title) return res.status(400).json({ error: 'Titolo obbligatorio' });
  const result = await db.runAsync(`
    INSERT INTO tasks (title, description, project_id, assigned_to, created_by, priority, due_date, estimated_minutes, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [title, description || '', project_id || null, assigned_to || null, req.user.id,
    priority || 'medium', due_date || null, estimated_minutes || 0, JSON.stringify(tags || [])]);
  const task = await db.getAsync(`
    SELECT t.*, u.name as assignee_name, p.name as project_name
    FROM tasks t LEFT JOIN users u ON t.assigned_to=u.id LEFT JOIN projects p ON t.project_id=p.id
    WHERE t.id=?`, [result.lastID]);
  res.json(task);
});

router.put('/:id', auth, async (req, res) => {
  const { title, description, status, priority, assigned_to, due_date, estimated_minutes, tags, position } = req.body;
  await db.runAsync(`
    UPDATE tasks SET title=?, description=?, status=?, priority=?, assigned_to=?,
    due_date=?, estimated_minutes=?, tags=?, position=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `, [title, description, status, priority, assigned_to, due_date, estimated_minutes,
    JSON.stringify(tags || []), position || 0, req.params.id]);
  const task = await db.getAsync('SELECT * FROM tasks WHERE id=?', [req.params.id]);
  res.json(task);
});

router.delete('/:id', auth, async (req, res) => {
  await db.runAsync('DELETE FROM time_logs WHERE task_id=?', [req.params.id]);
  await db.runAsync('DELETE FROM comments WHERE task_id=?', [req.params.id]);
  await db.runAsync('DELETE FROM tasks WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

router.post('/:id/log', auth, async (req, res) => {
  const { minutes, note } = req.body;
  await db.runAsync(
    'INSERT INTO time_logs (task_id, user_id, minutes, note) VALUES (?, ?, ?, ?)',
    [req.params.id, req.user.id, minutes, note || '']
  );
  await db.runAsync(
    'UPDATE tasks SET logged_minutes = logged_minutes + ?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [minutes, req.params.id]
  );
  res.json({ ok: true });
});

module.exports = router;