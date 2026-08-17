// backend/routes/auth.js
// Публичной регистрации НЕТ — единственный админ-аккаунт создаётся автоматически
// на сервере из переменных окружения (см. backend/server.js -> ensureAdmin()).
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login  { email, password }
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email и пароль обязательны' });
  }

  try {
    const result = await db.execute({
      sql: 'SELECT * FROM users WHERE email = ?',
      args: [email]
    });
    const row = result.rows[0];

    if (!row || !bcrypt.compareSync(password, row.password_hash)) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const user = { id: Number(row.id), email: row.email, role: row.role, name: row.name };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user });
  } catch (err) {
    console.error('[auth/login]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
