// backend/db/index.js
// Хранилище — Turso (libSQL, облачная SQLite-совместимая БД, бесплатный тариф).
// Данные хранятся не на диске сервера, а в облаке Turso — поэтому не теряются
// при перезапуске, засыпании или обновлении сайта на бесплатном хостинге.
const { createClient } = require('@libsql/client');

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.warn(
    '[db] TURSO_DATABASE_URL / TURSO_AUTH_TOKEN не заданы. ' +
    'Локально это можно временно не задавать только если вы используете локальную БД для разработки — ' +
    'но для продакшена они обязательны.'
  );
}

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

// Создаёт таблицы при первом запуске и наполняет шаблоны, если их ещё нет.
// Вызывается один раз при старте сервера (см. backend/server.js).
async function initDb() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name          TEXT,
      role          TEXT NOT NULL DEFAULT 'user', -- 'user' | 'admin'
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS templates (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      title        TEXT NOT NULL,
      category     TEXT NOT NULL,
      hint         TEXT,
      default_text TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS requests (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
      template_id    INTEGER REFERENCES templates(id) ON DELETE SET NULL,
      submitter_name TEXT,
      title          TEXT NOT NULL,
      category       TEXT,
      description    TEXT NOT NULL,
      deadline       TEXT,
      budget         TEXT,
      contact        TEXT NOT NULL,
      status         TEXT NOT NULL DEFAULT 'new',
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const countResult = await db.execute('SELECT COUNT(*) AS c FROM templates');
  const count = Number(countResult.rows[0].c);
  if (count === 0) {
    const seed = [
      {
        title: 'Разовая доставка',
        category: 'Доставка',
        hint: 'Что и откуда-куда нужно доставить, вес/габариты',
        default_text: 'Нужно доставить [что] из [откуда] в [куда]. Вес/размер: ...'
      },
      {
        title: 'Мелкий ремонт / монтаж',
        category: 'Ремонт',
        hint: 'Что именно нужно починить/собрать, есть ли инструменты',
        default_text: 'Нужно починить/собрать [что]. Инструменты: [есть/нет].'
      },
      {
        title: 'Репетитор / консультация',
        category: 'Обучение',
        hint: 'Предмет, уровень, формат (онлайн/очно), количество занятий',
        default_text: 'Ищу репетитора по [предмет], уровень [школа/вуз/др.], формат [онлайн/очно].'
      },
      {
        title: 'Уборка помещения',
        category: 'Уборка',
        hint: 'Тип помещения, площадь, разовая или регулярная уборка',
        default_text: 'Нужна уборка [квартиры/офиса], площадь ~[м2]. Разово или регулярно: ...'
      }
    ];
    for (const t of seed) {
      await db.execute({
        sql: 'INSERT INTO templates (title, category, hint, default_text) VALUES (?, ?, ?, ?)',
        args: [t.title, t.category, t.hint, t.default_text]
      });
    }
  }
}

module.exports = { db, initDb };
