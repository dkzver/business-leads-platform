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

app.patch('/api/companies/:id/status', async (req, res) => {
  try {
    const allowed = ['Новый','Письмо подготовлено','Связались','Ответили','Не подходит'];
    const status = String((req.body || {}).status || '');
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Недопустимый статус' });
    const result = await pool.query(
      'UPDATE companies SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING *',
      [status, req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Компания не найдена' });
    res.json(result.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Не удалось изменить статус' }); }
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


const seedLeads = [
  // Cleaning prospects
  {name:"Cleanface",country:"Казахстан",city:"Алматы",category:"Клининг",phone:"+7 708 624-30-05; +7 707 104-01-31",email:"idir.cleanface@yandex.kz",website:"https://cleanface.kz/",source:"https://cleanface.kz/",notes:"Локальная клининговая компания. Размер команды не подтверждён; проверить перед обращением."},
  {name:"ART Cleaning",country:"Казахстан",city:"Алматы",category:"Клининг",phone:"+7 707 607 70 40",email:"info@art-cl.kz",website:"https://art-cl.kz/",source:"https://art-cl.kz/contacts/",notes:"B2B-клининг; размер команды не подтверждён."},
  {name:"CleanCity",country:"Казахстан",city:"Астана",category:"Клининг",phone:"+7 702 782 60 95",email:"info@cleancity.kz",website:"https://www.cleancity.kz/",source:"https://www.cleancity.kz/contacts",notes:"Клининговые услуги для организаций; масштаб не подтверждён."},
  {name:"Expert Clean",country:"Казахстан",city:"Астана",category:"Клининг",phone:"+7 775 058 88 48; +7 778 190 00 30",email:"expertclean2023@gmail.com",website:"https://expertclean.kz/",source:"https://expertclean.kz/",notes:"Локальная компания; размер команды не подтверждён."},
  {name:"BEKA CLEANING",country:"Казахстан",city:"Астана",category:"Клининг",phone:"+7 705 580 3828",email:"bekaclean@mail.ru",website:"https://bekaclean.kz/",source:"https://bekaclean.kz/",notes:"Локальная клининговая компания; масштаб не подтверждён."},
  {name:"Cleanwell",country:"Казахстан",city:"Алматы",category:"Клининг",phone:"+7 701 761-29-36",email:"info@cleanwell.kz",website:"https://www.cleanwell.kz/",source:"https://www.cleanwell.kz/",notes:"Уборка квартир и офисов; размер команды не подтверждён."},
  {name:"A Cleaning",country:"Казахстан",city:"Алматы",category:"Клининг",phone:"+7 702 509 55 59",website:"https://acleanings.kz/",source:"https://acleanings.kz/",notes:"Локальная клининговая компания; размер команды не подтверждён."},
  {name:"Zolushka",country:"Казахстан",city:"Алматы",category:"Клининг",phone:"+7 707 354-11-72",website:"https://www.zolushka.kz/",source:"https://yandex.kz/maps/ru/org/zolushka/1194906102/",notes:"Локальные клининговые услуги; размер команды не подтверждён."},
  {name:"BioClean",country:"Казахстан",city:"Астана",category:"Клининг",phone:"+7 776 688-51-31",source:"https://yandex.kz/maps/ru/org/bioclean/106935892274/",notes:"Небольшой локальный профиль в картах; сайт/email не найдены."},
  {name:"Clean and Fast",country:"Казахстан",city:"Алматы",category:"Клининг",phone:"+7 747 773-85-43",website:"https://cleanfast.kz/",source:"https://xn--80aaa0anw0aiz.xn--24-6kci4amthgkj1f.xn--80asehdb/алматы/бизнес/клининг",notes:"Локальная клининговая компания; размер команды не подтверждён."},
  {name:"CleanLines",country:"Россия",city:"Екатеринбург",category:"Клининг",phone:"+7 343 226-98-18",email:"info@cleanlines.ru",website:"https://www.cleanlines.ru/",source:"https://www.cleanlines.ru/contacts/",notes:"Региональная клининговая компания; размер команды не подтверждён."},
  {name:"Клининг Екатеринбург",country:"Россия",city:"Екатеринбург",category:"Клининг",phone:"+7 909 703 05 17; +7 343 266-35-58",email:"kliningeburg@yandex.ru",website:"https://kliningekb.ru/",source:"https://kliningekb.ru/",notes:"Выездная клининговая служба; локальный кандидат."},
  {name:"Pikcleaning",country:"Россия",city:"Екатеринбург",category:"Клининг",phone:"+7 905 805-04-96",email:"clean24-ekb@yandex.ru",website:"https://pikcleaning.ru/",source:"https://pikcleaning.ru/kontakty/",notes:"Локальная клининговая компания; размер команды не подтверждён."},
  {name:"UBORKIN",country:"Россия",city:"Екатеринбург",category:"Клининг",phone:"+7 953 005-99-00; +7 982 658-55-23",email:"uborkin-ekb@mail.ru",website:"https://uborkin.com/",source:"https://uborkin.com/",notes:"Уборка помещений и химчистка мебели; локальный кандидат."},
  {name:"Gloss Cleaning",country:"Россия",city:"Санкт-Петербург",category:"Клининг",phone:"+7 906 244-40-76",email:"gloss-cleaning.spb@yandex.ru",website:"https://www.gloss-cleaning.ru/",source:"https://www.gloss-cleaning.ru/kontakty",notes:"Локальная клининговая компания; размер команды не подтверждён."},
  {name:"КлинБиг",country:"Россия",city:"Санкт-Петербург",category:"Клининг",phone:"+7 904 225-38-75; +7 911 982-22-74",email:"Info@cleanbig.ru",website:"https://cleanbig.ru/",source:"https://cleanbig.ru/contact/",notes:"Локальная клининговая компания; размер команды не подтверждён."},
  // Independent auto repair prospects
  {name:"Garaje №1",country:"Казахстан",city:"Алматы",category:"Автосервис",phone:"+7 702 679-74-16",source:"https://cargasm.kz/sto/",notes:"Независимый локальный автосервис; число постов не подтверждено."},
  {name:"GBM Avtomaster",country:"Казахстан",city:"Шымкент",category:"Автосервис",phone:"+7 778 578-70-74",source:"https://cargasm.kz/sto/",notes:"Локальная автомастерская; число постов не подтверждено."},
  {name:"IRON-car-care service",country:"Казахстан",city:"Алматы",category:"Автосервис",phone:"+7 701 932-81-10",source:"https://cargasm.kz/sto/",notes:"Независимый сервис; число постов не подтверждено."},
  {name:"K.V.O-car painting",country:"Казахстан",city:"Павлодар",category:"Автосервис",phone:"+7 705 867-18-41",source:"https://cargasm.kz/sto/",notes:"Специализированная автомастерская по покраске; число постов не подтверждено."},
  {name:"King Kong Garage",country:"Казахстан",city:"Алматы",category:"Автосервис",phone:"+7 747 787-84-66; +7 708 952-70-44",source:"https://cargasm.kz/sto/",notes:"Независимый локальный гаражный сервис; число постов не подтверждено."},
  {name:"555 Garage Service",country:"Казахстан",city:"Шымкент",category:"Автосервис",phone:"+7 708 388-77-74",source:"https://yandex.kz/maps/ru/org/555_garage_serice/12771561816/",notes:"Локальный автосервис; число постов не подтверждено."},
  {name:"GARAGE auto service",country:"Казахстан",city:"Алматы",category:"Автосервис",phone:"+7 701 137-88-88; +7 778 888-85-19",source:"https://cargasm.kz/sto/",notes:"Независимый локальный автосервис; число постов не подтверждено."},
  {name:"AST.STO",country:"Казахстан",city:"Астана",category:"Автосервис",phone:"+7 702 965-09-09",source:"https://cargasm.kz/sto/",notes:"Локальное СТО; число постов не подтверждено."},
  {name:"AutoHouse",country:"Казахстан",city:"Атырау",category:"Автосервис",phone:"+7 701 133-18-53",source:"https://cargasm.kz/sto/",notes:"Локальный автосервис; число постов не подтверждено."},
  {name:"AvtoShaman",country:"Казахстан",city:"Павлодар",category:"Автосервис",phone:"+7 707 508-12-84; +7 705 508-12-84",source:"https://cargasm.kz/sto/",notes:"Независимый локальный автосервис; число постов не подтверждено."},
  {name:"Autodetal",country:"Казахстан",city:"Шымкент",category:"Автосервис",phone:"+7 707 153-90-93; +7 776 393-33-93",source:"https://cargasm.kz/sto/",notes:"Локальный автосервис; число постов не подтверждено."},
  {name:"Garage #1",country:"Казахстан",city:"Атырау",category:"Автосервис",phone:"+7 777 500-11-31; +7 701 513-35-48",source:"https://cargasm.kz/sto/",notes:"Локальный гаражный автосервис; число постов не подтверждено."},
  {name:"Автосервис ИП Богацкий",country:"Россия",city:"Москва",category:"Автосервис",phone:"+7 903 192-61-92",email:"77@remcars.ru",website:"https://www.remcars.ru/",source:"https://asktel.ru/moskva/avtoservis/avtoservis_20/",notes:"ИП, независимый автосервис; профиль включает ремонт и обслуживание, число постов не подтверждено."},
  {name:"Первый автосервис (ИП Волков)",country:"Россия",city:"Москва",category:"Автосервис",phone:"+7 495 507-25-90",email:"5072590@mail.ru",website:"https://1st-autoservice.ru/",source:"https://asktel.ru/moskva/avtoservis/pervyj_avtoservis/",notes:"ИП, независимый автосервис; число постов не подтверждено."},
  {name:"CarExpert Service",country:"Россия",city:"Екатеринбург",category:"Автосервис",phone:"+7 900 202-12-35",website:"https://carexpertekb.ru/",source:"https://carexpertekb.ru/",notes:"Локальный автосервис; число постов не подтверждено."},
  {name:"E2 Auto",country:"Россия",city:"Екатеринбург",category:"Автосервис",phone:"+7 343 272-46-06; +7 953 602-72-03",email:"info@e2-auto.ru",website:"https://www.e2-auto.ru/",source:"https://www.e2-auto.ru/kontaktyi.html",notes:"Независимый автосервис; число постов не подтверждено."},
  {name:"Мини Гараж",country:"Россия",city:"Москва",category:"Автосервис",phone:"+7 965 230-16-37",source:"https://mini-garazh.clients.site/",notes:"Небольшой автосервис/гараж; число постов не подтверждено."},
  {name:"Автосервис ИП Акопян",country:"Россия",city:"Москва",category:"Автосервис",phone:"+7 495 721-03-21",source:"https://asktel.ru/moskva/avtoservis/avtoservis_51/",notes:"ИП, независимый автосервис; число постов не подтверждено."}
];

async function seedInitialLeads() {
  for (const lead of seedLeads) {
    await pool.query(
      `INSERT INTO companies (name,country,city,category,phone,email,website,source,status,notes)
       SELECT $1,$2,$3,$4,$5,$6,$7,$8,'Новый',$9
       WHERE NOT EXISTS (SELECT 1 FROM companies WHERE LOWER(name)=LOWER($1) AND LOWER(city)=LOWER($3))`,
      [lead.name,lead.country,lead.city,lead.category,lead.phone||'',lead.email||'',lead.website||'',lead.source||'',lead.notes||'']
    );
  }
}

initDb().then(seedInitialLeads).then(() => {
  app.listen(port, '0.0.0.0', () => console.log('Business Leads Platform listening on ' + port));
}).catch(err => { console.error('Database initialization failed:', err); process.exit(1); });

process.on('SIGTERM', async () => { await pool.end(); process.exit(0); });
