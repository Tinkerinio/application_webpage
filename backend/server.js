// backend/server.js
require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');

const { db, initDb } = require('./db');
const authRoutes = require('./routes/auth');
const templateRoutes = require('./routes/templates');
const requestRoutes = require('./routes/requests');

const app = express();

app.use(helmet({
  contentSecurityPolicy: false // отключено, т.к. страницы используют инлайн-скрипты
}));

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '..', 'public')));

// Ограничение частоты попыток входа — защита от перебора пароля админа.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Слишком много попыток входа. Попробуйте позже.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/auth/login', loginLimiter);

// Ограничение на создание заявок — защита от спам-ботов.
const requestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Слишком много заявок с этого адреса. Попробуйте позже.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/requests', requestLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/requests', requestRoutes);

// Автосоздание единственного администратора при старте, если его ещё нет.
// Логин и пароль задаются переменными окружения ADMIN_EMAIL / ADMIN_PASSWORD.
async function ensureAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn('[init] ADMIN_EMAIL/ADMIN_PASSWORD не заданы — админ-аккаунт не создан.');
    return;
  }

  const existingResult = await db.execute({ sql: 'SELECT id, role FROM users WHERE email = ?', args: [email] });
  const existing = existingResult.rows[0];

  if (existing) {
    if (existing.role !== 'admin') {
      await db.execute({ sql: 'UPDATE users SET role = ? WHERE id = ?', args: ['admin', existing.id] });
    }
    return;
  }

  const password_hash = bcrypt.hashSync(password, 10);
  await db.execute({
    sql: 'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
    args: [email, password_hash, 'Администратор', 'admin']
  });
  console.log(`[init] Админ-аккаунт создан: ${email}`);
}

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await initDb();
    await ensureAdmin();
    app.listen(PORT, () => {
      console.log(`Сервер запущен: http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Не удалось запустить сервер:', err);
    process.exit(1);
  }
}

start();
