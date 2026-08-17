// backend/routes/templates.js
const express = require('express');
const { db } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/templates — публичный список
router.get('/', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM templates ORDER BY category, title');
    res.json(result.rows);
  } catch (err) {
    console.error('[templates/list]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/templates — создать шаблон (только админ)
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { title, category, hint, default_text } = req.body;
  if (!title || !category) {
    return res.status(400).json({ error: 'title и category обязательны' });
  }
  try {
    const result = await db.execute({
      sql: 'INSERT INTO templates (title, category, hint, default_text) VALUES (?, ?, ?, ?)',
      args: [title, category, hint || null, default_text || null]
    });
    res.status(201).json({ id: Number(result.lastInsertRowid) });
  } catch (err) {
    console.error('[templates/create]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/templates/:id — удалить шаблон (только админ)
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM templates WHERE id = ?', args: [req.params.id] });
    res.status(204).end();
  } catch (err) {
    console.error('[templates/delete]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
