const express = require('express');
const router = express.Router();
const db = require('../db');

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) 
    return res.status(400).json({ error: 'Tutti i campi sono obbligatori' });

  try {
    const existing = await db.getAsync('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) return res.status(409).json({ error: 'Email già registrata' });

    const colors = ['#0f172a', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const result = await db.runAsync(
      'INSERT INTO users (name, email, password, avatar_color) VALUES (?, ?, ?, ?)',
      [name, email, password, color]
    );

    const user = { id: result.lastID, name, email, avatar_color: color };
    res.json({ token: 'dev-token-' + user.id, user });
  } catch (err) {
    res.status(500).json({ error: 'Errore durante la registrazione' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await db.getAsync('SELECT * FROM users WHERE email = ? AND password = ?', [email, password]);
    if (!user) return res.status(401).json({ error: 'Credenziali non valide' });

    res.json({ 
      token: 'dev-token-' + user.id, 
      user: { id: user.id, name: user.name, email: user.email, avatar_color: user.avatar_color } 
    });
  } catch (err) {
    res.status(500).json({ error: 'Errore durante il login' });
  }
});

router.get('/me', async (req, res) => {
  // Mock di protezione per sviluppo veloce
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Non autorizzato' });
  
  const userId = token.split('-')[2];
  const user = await db.getAsync('SELECT id, name, email, avatar_color FROM users WHERE id = ?', [userId]);
  res.json(user);
});

router.get('/', async (req, res) => {
  const users = await db.allAsync('SELECT id, name, email, avatar_color FROM users');
  res.json(users);
});

module.exports = router;