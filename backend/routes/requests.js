// backend/routes/requests.js
const express = require('express');
const { db } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// POST /api/requests — создать заявку. БЕЗ авторизации: любой посетитель сайта
// может сразу отправить заявку, не регистрируясь.
// Форма собирает только: submitter_name (имя), description (описание работы), contact (связь).
// title формируется автоматически из начала описания — используется как заголовок в админке.
router.post('/', async (req, res) => {
  const { submitter_name, description, contact } = req.body;

  if (!description || !contact) {
    return res.status(400).json({
      error: 'Обязательные поля: description, contact'
    });
  }

  const title = description.length > 60 ? description.slice(0, 60).trim() + '…' : description;

  try {
    const result = await db.execute({
      sql: `INSERT INTO requests (user_id, template_id, submitter_name, title, description, deadline, budget, contact)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [null, null, submitter_name || null, title, description, null, null, contact]
    });
    res.status(201).json({ id: Number(result.lastInsertRowid) });
  } catch (err) {
    console.error('[requests/create]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/requests — все заявки (только админ), с опциональным фильтром по статусу
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  const { status } = req.query;
  try {
    const result = status
      ? await db.execute({ sql: 'SELECT * FROM requests WHERE status = ? ORDER BY created_at DESC', args: [status] })
      : await db.execute('SELECT * FROM requests ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('[requests/list]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PATCH /api/requests/:id/status — сменить статус заявки (только админ)
router.patch('/:id/status', requireAuth, requireAdmin, async (req, res) => {
  const { status } = req.body;
  const allowed = ['new', 'in_progress', 'done', 'rejected'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `status должен быть одним из: ${allowed.join(', ')}` });
  }
  try {
    await db.execute({
      sql: 'UPDATE requests SET status = ? WHERE id = ?',
      args: [status, req.params.id]
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[requests/status]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
