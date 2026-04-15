function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Token mancante' });

  const token = header.split(' ')[1];
  if (!token || !token.startsWith('dev-token-')) {
    return res.status(401).json({ error: 'Token non valido' });
  }

  const userId = parseInt(token.split('-')[2]);
  if (!userId) return res.status(401).json({ error: 'Token non valido' });

  req.user = { id: userId };
  next();
}

module.exports = auth;