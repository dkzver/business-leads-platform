const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 10000;
if (!process.env.APP_PASSWORD) { console.error('APP_PASSWORD is required. Set it as a secret environment variable.'); process.exit(1); }
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required. Configure a Render PostgreSQL database.');
  process.exit(1);
}
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  if (req.path === '/api/health') return next();
  const header = req.headers.authorization || '';
  const encoded = header.startsWith('Basic ') ? header.slice(6) : '';
  let password = '';
  try { password = Buffer.from(encoded, 'base64').toString('utf8').split(':').slice(1).join(':'); } catch {}
  if (password && password === process.env.APP_PASSWORD) return next();
  res.set('WWW-Authenticate', 'Basic realm="Business Leads", charset="UTF-8"');
  res.status(401).send('Требуется пароль для доступа к Business Leads.');
});
app.use(express.static(path.join(__dirname, 'public')));

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS companies (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      country TEXT DEFAULT '',
      city TEXT DEFAULT '',
      category TEXT NOT NULL DEFAULT 'Автосервис',
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      website TEXT DEFAULT '',
      source TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Новый',
      notes TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS companies_name_idx ON companies (LOWER(name));
    CREATE INDEX IF NOT EXISTS companies_city_idx ON companies (LOWER(city));
  `);
}

app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true }); }
  catch { res.status(503).json({ ok: false }); }
});

app.get('/api/companies', async (req, res) => {
  try {
    const { q = '', country = '', city = '', category = '', status = '' } = req.query;
    const values = [];
    const where = [];
    const add = (sql, value) => { values.push(value); where.push(sql.replace('?', '$' + values.length)); };
    if (q) add("(name ILIKE ? OR phone ILIKE ? OR email ILIKE ? OR website ILIKE ?)", `%${q}%`);
    // Search fields independently so one search term covers all contact fields.
    if (q) {
      values.pop(); where.pop();
      values.push(`%${q}%`);
      const n = '$' + values.length;
      where.push(`(name ILIKE ${n} OR phone ILIKE ${n} OR email ILIKE ${n} OR website ILIKE ${n} OR city ILIKE ${n})`);
    }
    if (country) add('country ILIKE ?', `%${country}%`);
    if (city) add('city ILIKE ?', `%${city}%`);
    if (category) add('category = ?', category);
    if (status) add('status = ?', status);
    const sql = 'SELECT * FROM companies ' + (where.length ? 'WHERE ' + where.join(' AND ') : '') + ' ORDER BY created_at DESC';
    const result = await pool.query(sql, values);
    res.json(result.rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Не удалось загрузить компании' }); }
});

app.post('/api/companies', async (req, res) => {
  try {
    const d = req.body || {};
    if (!String(d.name || '').trim()) return res.status(400).json({ error: 'Укажите название компании' });
    const duplicate = await pool.query(
      'SELECT id FROM companies WHERE LOWER(name)=LOWER($1) AND LOWER(city)=LOWER($2) LIMIT 1',
      [String(d.name).trim(), String(d.city || '').trim()]
    );
    if (duplicate.rowCount) return res.status(409).json({ error: 'Такая компания в этом городе уже есть' });
    const result = await pool.query(
      `INSERT INTO companies (name,country,city,category,phone,email,website,source,status,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [d.name.trim(),d.country||'',d.city||'',d.category||'Автосервис',d.phone||'',d.email||'',d.website||'',d.source||'',d.status||'Новый',d.notes||'']
    );
    res.status(201).json(result.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Не удалось сохранить компанию' }); }
});

app.put('/api/companies/:id', async (req, res) => {
  try {
    const d = req.body || {};
    if (!String(d.name || '').trim()) return res.status(400).json({ error: 'Укажите название компании' });
    const result = await pool.query(
      `UPDATE companies SET name=$1,country=$2,city=$3,category=$4,phone=$5,email=$6,website=$7,source=$8,status=$9,notes=$10,updated_at=NOW()
       WHERE id=$11 RETURNING *`,
      [d.name.trim(),d.country||'',d.city||'',d.category||'Автосервис',d.phone||'',d.email||'',d.website||'',d.source||'',d.status||'Новый',d.notes||'',req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Компания не найдена' });
    res.json(result.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Не удалось обновить компанию' }); }
});

app.delete('/api/companies/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM companies WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Компания не найдена' });
    res.status(204).end();
  } catch (e) { console.error(e); res.status(500).json({ error: 'Не удалось удалить компанию' }); }
});

initDb().then(() => {
  app.listen(port, '0.0.0.0', () => console.log('Business Leads Platform listening on ' + port));
}).catch(err => { console.error('Database initialization failed:', err); process.exit(1); });

process.on('SIGTERM', async () => { await pool.end(); process.exit(0); });
