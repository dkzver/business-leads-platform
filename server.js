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

const templateCatalog = {
  cleaning_en: { title: 'Cleaning companies · English', body: 'Hello {{company}},\n\nI am an independent software developer helping businesses improve their websites and internal workflows. I would be glad to learn how your team currently manages incoming requests, scheduling and customer communication.\n\nIf useful, I can suggest a practical website or lightweight web system tailored to your process. Would a short introductory conversation be convenient?\n\nBest regards,\n{{your_name}}' },
  auto_en: { title: 'Auto repair shops · English', body: 'Hello {{company}},\n\nI build websites and custom web tools for service businesses. For an auto repair shop, this could include online booking, repair-status updates, customer history and simpler management of service requests.\n\nI would be happy to learn how your shop works today and suggest only improvements that could be genuinely useful. Would you be open to a brief conversation?\n\nBest regards,\n{{your_name}}' },
  website_ru: { title: 'Сайт или интернет-магазин · Русский', body: 'Здравствуйте, команда {{company}}!\n\nЯ независимый разработчик. Создаю современные сайты и интернет-магазины, которые помогают компаниям понятнее представлять услуги, получать обращения и удобнее работать с клиентами.\n\nПосмотрел информацию о вашей компании и хотел бы обсудить, может ли обновление сайта или отдельная веб-функция быть вам полезна. Могу сначала предложить несколько конкретных идей без обязательств.\n\nБудет ли удобно коротко пообщаться?\n\nС уважением,\n{{your_name}}' },
  website_en: { title: 'Website or online store · English', body: 'Hello {{company}} team,\n\nI am an independent developer building modern websites and online stores that help businesses explain their services clearly, generate enquiries and serve customers more effectively.\n\nI would be glad to discuss whether a website improvement or a focused web feature could be useful for your business. I can start with a few practical ideas, with no obligation.\n\nWould a short conversation be convenient?\n\nBest regards,\n{{your_name}}' },
  webapp_ru: { title: 'Веб-сервис или личный кабинет · Русский', body: 'Здравствуйте, команда {{company}}!\n\nЯ занимаюсь разработкой веб-сервисов и личных кабинетов под задачи бизнеса. Это могут быть клиентские порталы, системы заявок, кабинеты партнёров, панели управления и внутренние инструменты.\n\nЕсли у вас есть процессы, которые сейчас ведутся вручную или в нескольких разрозненных инструментах, я мог бы предложить вариант их объединения в удобный сервис.\n\nГотов обсудить ваши задачи и предложить небольшой план реализации. Интересно ли вам такое направление?\n\nС уважением,\n{{your_name}}' },
  webapp_en: { title: 'Web application or client portal · English', body: 'Hello {{company}} team,\n\nI develop custom web applications and portals for business workflows: customer areas, request management, partner portals, admin dashboards and internal tools.\n\nIf some of your processes are still handled manually or across disconnected tools, I would be happy to explore whether a focused web application could simplify them.\n\nWould you be interested in a short discovery call?\n\nBest regards,\n{{your_name}}' },
  automation_ru: { title: 'Автоматизация и интеграции · Русский', body: 'Здравствуйте, команда {{company}}!\n\nЯ разрабатываю программные решения для автоматизации бизнес-процессов и интеграции используемых сервисов: обмен данными, обработка заявок, уведомления, отчёты и внутренние панели.\n\nХотел бы узнать, есть ли у вас повторяющиеся операции, которые отнимают время сотрудников и которые можно надёжно автоматизировать. Могу предложить идеи после короткого знакомства с процессом.\n\nБудет ли удобно обсудить это?\n\nС уважением,\n{{your_name}}' },
  automation_en: { title: 'Automation and integrations · English', body: 'Hello {{company}} team,\n\nI build software that automates business workflows and connects existing tools: data synchronisation, enquiry processing, notifications, reporting and internal dashboards.\n\nI would be interested in learning whether your team has repetitive tasks that could be made simpler and more reliable through automation. I can suggest options after a short introduction to your workflow.\n\nWould you be open to a brief conversation?\n\nBest regards,\n{{your_name}}' },
  mobile_ru: { title: 'Мобильное приложение · Русский', body: 'Здравствуйте, команда {{company}}!\n\nЯ разрабатываю цифровые продукты для бизнеса, в том числе мобильные приложения и связанные с ними серверные сервисы. Это может быть приложение для клиентов, сотрудников, курьеров или партнёров — в зависимости от реальной задачи.\n\nЕсли вы рассматриваете мобильный канал обслуживания или хотите упростить работу команды, буду рад обсудить идею и возможный объём первой версии.\n\nИнтересно ли вам коротко пообщаться?\n\nС уважением,\n{{your_name}}' },
  mobile_en: { title: 'Mobile application · English', body: 'Hello {{company}} team,\n\nI build digital products for businesses, including mobile applications and their supporting backend services. Depending on the need, this could be an app for customers, employees, delivery teams or partners.\n\nIf you are considering a mobile customer channel or a better tool for your team, I would be glad to discuss the idea and a realistic first version.\n\nWould a short conversation be useful?\n\nBest regards,\n{{your_name}}' }
};

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
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS audit JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS audit_updated_at TIMESTAMPTZ;
    CREATE TABLE IF NOT EXISTS discovery_results (
      id BIGSERIAL PRIMARY KEY, company_name TEXT NOT NULL, country TEXT DEFAULT '', city TEXT DEFAULT '',
      industry TEXT DEFAULT '', website TEXT NOT NULL UNIQUE, evidence_url TEXT NOT NULL,
      evidence_title TEXT DEFAULT '', evidence_text TEXT DEFAULT '', opportunity TEXT NOT NULL,
      service TEXT NOT NULL, priority TEXT NOT NULL, message_ru TEXT NOT NULL, message_en TEXT NOT NULL,
      added_company_id BIGINT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS message_templates (
      type TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(
    'INSERT INTO message_templates (type,title,body) VALUES ($1,$2,$3),($4,$5,$6) ON CONFLICT (type) DO NOTHING',
    ['cleaning','Текст для клининговых компаний',"Здравствуйте!\n\nЯ занимаюсь разработкой программного обеспечения и сейчас изучаю процессы управления клининговыми компаниями.\n\nПланирую создать SaaS-платформу для автоматизации работы клининга:\n\n— Приём и обработка заявок.\n— Распределение заказов между сотрудниками.\n— Управление персоналом.\n— Календарь уборок.\n— Контроль выхода сотрудников на объекты.\n— Контроль выполнения заказов.\n\nСейчас я не пытаюсь ничего продать. Мне важно понять, какие проблемы действительно возникают у клининговых компаний и какие процессы стоит автоматизировать.\n\nБуду благодарен, если вы сможете уделить 15–20 минут на короткую беседу.\n\nВзамен готов учесть ваши пожелания при разработке платформы.\n\nС уважением,\nКирилл Циркунов\nТелефон: +7 931 450-19-92\nEmail: dkrstudio@gmail.com",'auto','Текст для автосервисов',"Здравствуйте!\n\nЯ занимаюсь разработкой программного обеспечения и сейчас изучаю возможности создания SaaS-платформы для автосервисов.\n\nИдея проекта — создать единую систему управления автосервисом, которая позволит:\n\n• Принимать и учитывать заявки клиентов.\n• Вести календарь записей на ремонт и обслуживание.\n• Управлять загрузкой сотрудников и ремонтных постов.\n• Распределять заказы между свободными мастерами.\n• Вести историю обслуживания автомобилей и клиентов.\n• Контролировать этапы выполнения ремонтных работ.\n• Учитывать запчасти и расходные материалы.\n• Получать отчёты о работе автосервиса.\n\nЦель — уменьшить количество ручной работы, упростить управление сотрудниками и заказами, сделать загрузку мастеров и состояние каждого ремонта более прозрачными.\n\nСейчас я изучаю потребности автосервисов и ищу владельцев, готовых поделиться опытом и обсудить, какие функции действительно были бы полезны их бизнесу.\n\nМне интересно узнать, как сегодня организована работа вашего автосервиса, какие процессы отнимают больше всего времени и что вы хотели бы автоматизировать в первую очередь.\n\nБуду благодарен за возможность задать несколько вопросов и узнать ваше мнение. Это поможет сформировать продукт, который будет решать реальные задачи автосервисов.\n\nС уважением,\nКирилл Циркунов\nТелефон: +7 931 450-19-92\nEmail: dkrstudio@gmail.com"]
  );
  for (const [type, template] of Object.entries(templateCatalog)) {
    await pool.query(
      'INSERT INTO message_templates (type,title,body) VALUES ($1,$2,$3) ON CONFLICT (type) DO NOTHING',
      [type, template.title, template.body]
    );
  }
}

app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true }); }
  catch { res.status(503).json({ ok: false }); }
});

app.get('/api/templates', async (_req, res) => {
  try {
    const result = await pool.query('SELECT type,title,body,updated_at FROM message_templates ORDER BY title');
    res.json(result.rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Не удалось загрузить шаблоны' }); }
});

app.get('/api/templates/:type', async (req, res) => {
  try {
    if (!templateCatalog[req.params.type] && !['cleaning','auto'].includes(req.params.type)) return res.status(400).json({ error: 'Неизвестный тип текста' });
    const result = await pool.query('SELECT type,title,body,updated_at FROM message_templates WHERE type=$1', [req.params.type]);
    if (!result.rowCount) return res.status(404).json({ error: 'Текст не найден' });
    res.json(result.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Не удалось загрузить текст' }); }
});

app.put('/api/templates/:type', async (req, res) => {
  try {
    if (!templateCatalog[req.params.type] && !['cleaning','auto'].includes(req.params.type)) return res.status(400).json({ error: 'Неизвестный тип текста' });
    const body = String((req.body || {}).body || '');
    if (!body.trim()) return res.status(400).json({ error: 'Текст не может быть пустым' });
    const title = templateCatalog[req.params.type]?.title || (req.params.type === 'cleaning' ? 'Текст для клининговых компаний' : 'Текст для автосервисов');
    const result = await pool.query(
      'INSERT INTO message_templates (type,title,body,updated_at) VALUES ($1,$2,$3,NOW()) ON CONFLICT (type) DO UPDATE SET body=EXCLUDED.body,title=EXCLUDED.title,updated_at=NOW() RETURNING type,title,body,updated_at',
      [req.params.type,title,body]
    );
    res.json(result.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Не удалось сохранить текст' }); }
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


app.post('/api/companies/import', async (req,res) => {
 const rows=Array.isArray(req.body&&req.body.companies)?req.body.companies:[];
 if(!rows.length)return res.status(400).json({error:'Файл не содержит компаний для импорта'});
 if(rows.length>1000)return res.status(400).json({error:'Максимум 1000 строк за импорт'});
 const client=await pool.connect();let imported=0,duplicates=0,invalid=0;
 try{await client.query('BEGIN');for(const d of rows){
  const name=String(d.name||'').trim().slice(0,180);if(!name){invalid++;continue;}
  const country=String(d.country||'').trim().slice(0,120),city=String(d.city||'').trim().slice(0,120);
  const email=String(d.email||'').trim().slice(0,240),website=String(d.website||'').trim().slice(0,500);
  const site=website.toLowerCase().replace('https://','').replace('http://','').replace('www.','').replace(/\/+$/,'');
  const dup=await client.query("SELECT id FROM companies WHERE (LOWER(name)=LOWER($1) AND LOWER(COALESCE(city,''))=LOWER($2) AND LOWER(COALESCE(country,''))=LOWER($3)) OR ($4<>'' AND LOWER(email)=$4) OR ($5<>'' AND LOWER(RTRIM(REPLACE(REPLACE(REPLACE(website,'https://',''),'http://',''),'www.',''),'/'))=$5) LIMIT 1",[name,city,country,email.toLowerCase(),site]);
  if(dup.rowCount){duplicates++;continue;}
  const allowed=['Новый','Письмо подготовлено','Связались','Ответили','Не подходит'];const status=allowed.includes(String(d.status||''))?String(d.status):'Новый';
  await client.query('INSERT INTO companies (name,country,city,category,phone,email,website,source,status,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[name,country,city,String(d.category||'Другое').slice(0,120),String(d.phone||'').slice(0,500),email,website,String(d.source||'').slice(0,1000),status,String(d.notes||'').slice(0,5000)]);imported++;
 }await client.query('COMMIT');res.json({imported,duplicates,invalid,total:rows.length});}
 catch(e){await client.query('ROLLBACK');console.error(e);res.status(500).json({error:'Не удалось импортировать компании'});}finally{client.release();}
});
app.get('/api/companies/:id/audit',async(req,res)=>{try{const r=await pool.query('SELECT id,name,website,audit,audit_updated_at FROM companies WHERE id=$1',[req.params.id]);if(!r.rowCount)return res.status(404).json({error:'Компания не найдена'});res.json(r.rows[0]);}catch(e){console.error(e);res.status(500).json({error:'Не удалось загрузить анализ сайта'});}});
app.put('/api/companies/:id/audit',async(req,res)=>{try{const a=req.body||{},keys=['https','mobile','clearServices','contactInfo','leadForm','portfolio','booking','speed'],audit={};for(const k of keys)audit[k]=a[k]===true;audit.notes=String(a.notes||'').trim().slice(0,5000);audit.opportunity=String(a.opportunity||'').trim().slice(0,5000);audit.checkedAt=new Date().toISOString();const r=await pool.query('UPDATE companies SET audit=$1::jsonb,audit_updated_at=NOW(),updated_at=NOW() WHERE id=$2 RETURNING id,audit,audit_updated_at',[JSON.stringify(audit),req.params.id]);if(!r.rowCount)return res.status(404).json({error:'Компания не найдена'});res.json(r.rows[0]);}catch(e){console.error(e);res.status(500).json({error:'Не удалось сохранить анализ сайта'});}});

const discoveryQueries = [
  {country:'US',lang:'en',q:'"looking for a web developer" OR "website redesign" "request for proposal"'},
  {country:'GB',lang:'en',q:'"website redesign" tender OR "web development" "request for proposal"'},
  {country:'CA',lang:'en',q:'"seeking a web developer" OR "website redesign RFP"'},
  {country:'AU',lang:'en',q:'"website redesign" "request for quote"'},
  {country:'DE',lang:'de',q:'"Website Relaunch" Ausschreibung OR "Webentwickler gesucht"'},
  {country:'FR',lang:'fr',q:'"refonte site internet" "appel d’offres" OR "recherche développeur web"'},
  {country:'CH',lang:'de',q:'"Website Relaunch" "Webentwickler gesucht"'},
  {country:'RU',lang:'ru',q:'"ищем веб-разработчика" OR "тендер на разработку сайта" OR "редизайн сайта"'},
  {country:'IN',lang:'en',q:'"website redesign" "request for proposal"'},
  {country:'SG',lang:'en',q:'"web development" "request for proposal"'},
  {country:'BR',lang:'pt',q:'"redesign de site" "desenvolvedor web"'},
  {country:'NL',lang:'nl',q:'"website vernieuwen" "webdeveloper gezocht"'}
];
const discoveryExcluded = ['linkedin.com','facebook.com','instagram.com','x.com','twitter.com','youtube.com','indeed.com','glassdoor.com','upwork.com','freelancer.com','fiverr.com','clutch.co','goodfirms.co','yelp.com','yellowpages.com','crunchbase.com','zoominfo.com','wikipedia.org','reddit.com','gov.uk','sam.gov','ted.europa.eu','mercell.com','wixsite.com','wordpress.com','webflow.io','squarespace.com'];
let discoveryLastRun=0;
const hostOf=h=>String(h||'').toLowerCase().replace(/^www\./,'');
const excludedHost=h=>discoveryExcluded.some(d=>hostOf(h)===d||hostOf(h).endsWith('.'+d));
function privateAddress(ip){
 const v=require('node:net').isIP(ip);
 if(v===4){const p=ip.split('.').map(Number),a=p[0],b=p[1];return a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===100&&b>=64&&b<=127)||(a===198&&(b===18||b===19));}
 if(v===6){const n=parseInt(ip.split(':')[0]||'0',16);return !(n>=0x2000&&n<=0x3fff);}
 return true;
}
async function safePublicPage(raw){
 let u;try{u=new URL(raw);}catch{return null;}
 if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||require('node:net').isIP(u.hostname)||excludedHost(u.hostname)||/localhost|\.local$|\.internal$/i.test(u.hostname))return null;
 try{const ips=await require('node:dns').promises.lookup(u.hostname,{all:true});if(!ips.length||ips.some(x=>privateAddress(x.address)))return null;}catch{return null;}
 u.hash='';
 try{
  const r=await fetch(u,{redirect:'manual',signal:AbortSignal.timeout(6000),headers:{Accept:'text/html','User-Agent':'FreelanceOutreachCRM/1.0'}});
  if(!r.ok||r.status>=300||!(r.headers.get('content-type')||'').includes('text/html')||Number(r.headers.get('content-length')||0)>750000)return null;
  const reader=r.body?.getReader();if(!reader)return null;let size=0,chunks=[];
  while(true){const x=await reader.read();if(x.done)break;size+=x.value.byteLength;if(size>750000){await reader.cancel();return null;}chunks.push(Buffer.from(x.value));}
  return Buffer.concat(chunks).toString('utf8');
 }catch{return null;}
}
function discoveryText(html){return String(html||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/\s+/g,' ').trim().slice(0,20000);}
function findOrg(node,depth=0){
 if(!node||depth>6)return null;if(Array.isArray(node)){for(const n of node){const x=findOrg(n,depth+1);if(x)return x;}return null;}
 if(typeof node!=='object')return null;const types=Array.isArray(node['@type'])?node['@type']:[node['@type']];
 if(types.some(t=>/Organization|LocalBusiness|ProfessionalService|Corporation|Store/i.test(String(t||'')))&&node.name)return node;
 return findOrg(node['@graph'],depth+1)||findOrg(node.publisher,depth+1)||findOrg(node.mainEntity,depth+1);
}
function orgFromHtml(html){
 const blocks=html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi)||[];
 for(const b of blocks){try{const x=findOrg(JSON.parse(b.replace(/^<script[^>]*>/i,'').replace(/<\/script>$/i,'')));if(x)return x;}catch{}}
 const meta=(html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)||[])[1];return meta?{name:meta}:null;
}
function findOpportunity(html,text,url){
 const full=(text+' '+html).slice(0,30000);
 const hit=full.match(/request for proposal|request for quotation|looking for (?:a )?(?:web|website|software|app) developer|seeking (?:a )?(?:web|website|software|app) developer|web developer wanted|ищем веб-разработчика|требуется веб-разработчик|тендер.{0,60}(?:сайт|веб|разработ)|редизайн сайта|recherche développeur web|webentwickler gesucht|refonte site internet/i);
 if(hit)return {opportunity:'Публичная страница содержит сигнал запроса на разработку или обновление: «'+hit[0]+'». Актуальность нужно проверить вручную.',service:'Разработка или редизайн сайта / веб-сервиса',priority:'Высокий'};
 if(/under construction|coming soon|site is being updated|website under maintenance|сайт на реконструкции|сайт в разработке/i.test(full))return {opportunity:'На странице размещено сообщение о разработке, реконструкции или скором запуске сайта; актуальность требует ручной проверки.',service:'Разработка или редизайн сайта',priority:'Средний'};
 if(!/<meta\b[^>]*name=["']viewport["']/i.test(html)&&/<body\b/i.test(html))return {opportunity:'В HTML проверенной страницы не найден meta viewport; мобильную адаптивность следует проверить вручную.',service:'Адаптивный редизайн сайта',priority:'Средний'};
 if(!/<form\b/i.test(html)&&/contact|kontakt|контакт|contactez|contato/i.test(new URL(url).pathname))return {opportunity:'На проверенной странице контактов не найден HTML-элемент формы. Проверьте другие страницы и внешние виджеты вручную.',service:'Форма заявок или клиентский портал',priority:'Средний'};
 return null;
}
function makeMessages(name,opp,service,url){
 return {ru:'Здравствуйте, команда '+name+'! На вашей публичной странице ('+url+') я заметил: '+opp+' Я независимый разработчик, занимаюсь направлением «'+service+'». Если задача актуальна, могу предложить несколько практических вариантов. Будет ли удобно коротко обсудить?',
 en:'Hello '+name+' team, on your public page ('+url+') I noticed: '+opp+' I am an independent developer working on '+service.toLowerCase()+'. If this is still relevant, I would be happy to suggest a few practical options. Would a short conversation be convenient?'};
}
async function runBraveQuery(q){
 const u=new URL('https://api.search.brave.com/res/v1/web/search');u.searchParams.set('q',q.q);u.searchParams.set('country',q.country);u.searchParams.set('search_lang',q.lang);u.searchParams.set('count','8');u.searchParams.set('extra_snippets','true');
 const r=await fetch(u,{signal:AbortSignal.timeout(12000),headers:{Accept:'application/json','X-Subscription-Token':process.env.BRAVE_SEARCH_API_KEY}});
 if(!r.ok)throw new Error('Search API HTTP '+r.status);const d=await r.json();return d.web?.results||[];
}
async function limited(items,n,fn){let i=0;const out=new Array(items.length);await Promise.all(Array.from({length:Math.min(n,items.length)},async()=>{while(true){const k=i++;if(k>=items.length)return;try{out[k]=await fn(items[k]);}catch{out[k]=null;}}}));return out;}
async function verifyDiscovery(r){
 let u;try{u=new URL(r.url);}catch{return null;}if(u.protocol!=='https:'||excludedHost(u.hostname))return null;
 const html=await safePublicPage(u.toString());if(!html)return null;const org=orgFromHtml(html);const name=String(org?.name||'').trim().slice(0,160);if(name.length<4)return null;
 const title=discoveryText((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'');const text=discoveryText(html);const snippet=[r.title,r.description,...(r.extra_snippets||[])].join(' ');
 if(!(title.toLowerCase().includes(name.toLowerCase())||text.toLowerCase().includes(name.toLowerCase())||snippet.toLowerCase().includes(name.toLowerCase())))return null;
 const opp=findOpportunity(html,text+' '+snippet,u.toString());if(!opp)return null;
 const addr=org.address||{};const country=typeof addr.addressCountry==='string'?addr.addressCountry:(addr.addressCountry?.name||'');const city=String(addr.addressLocality||'').slice(0,100);
 const industry=/clinic|medical|dental|health/i.test(text)?'Здравоохранение':/restaurant|hotel|cafe/i.test(text)?'Гостиницы и общепит':/law|legal|attorney/i.test(text)?'Профессиональные услуги':/construction|builder|contractor/i.test(text)?'Строительство':/retail|shop|store/i.test(text)?'Торговля':'Услуги для бизнеса';
 const website=u.origin;const messages=makeMessages(name,opp.opportunity,opp.service,u.toString());
 return {company_name:name,country,city,industry,website,evidence_url:u.toString(),evidence_title:String(r.title||title||name).slice(0,300),evidence_text:String(r.description||'').slice(0,1000),opportunity:opp.opportunity,service:opp.service,priority:opp.priority,message_ru:messages.ru,message_en:messages.en};
}
app.get('/api/discovery/results',async(_req,res)=>{
 try{const r=await pool.query("SELECT id,company_name,country,city,industry,website,evidence_url,evidence_title,evidence_text,opportunity,service,priority,message_ru,message_en,added_company_id,created_at FROM discovery_results WHERE created_at>NOW()-INTERVAL '90 days' ORDER BY created_at DESC LIMIT 40");res.json(r.rows);}
 catch(e){console.error(e);res.status(500).json({error:'Не удалось загрузить результаты поиска'});}
});
app.post('/api/discovery/search',async(_req,res)=>{
 if(!process.env.BRAVE_SEARCH_API_KEY)return res.status(503).json({error:'Поиск не подключён. Добавьте BRAVE_SEARCH_API_KEY в Render → Environment. Ключ: https://api-dashboard.search.brave.com/'});
 if(Date.now()-discoveryLastRun<30000)return res.status(429).json({error:'Подождите 30 секунд перед следующим поиском.'});discoveryLastRun=Date.now();
 try{
  const batches=await limited(discoveryQueries,3,runBraveQuery);const candidates=new Map();
  for(const batch of batches)for(const r of batch||[]){try{const u=new URL(r.url),host=hostOf(u.hostname);if(u.protocol==='https:'&&!excludedHost(host)&&!candidates.has(host))candidates.set(host,r);}catch{}}
  const checked=await limited(Array.from(candidates.values()).slice(0,18),3,verifyDiscovery);const client=await pool.connect();let added=0,duplicates=0;
  try{await client.query('BEGIN');for(const p of checked.filter(Boolean)){
   const host=hostOf(new URL(p.website).hostname);
   const dup=await client.query("SELECT id FROM companies WHERE LOWER(name)=LOWER($1) OR LOWER(regexp_replace(split_part(website,'/',3),'^www\\.',''))=$2 LIMIT 1",[p.company_name,host]);
   if(dup.rowCount){duplicates++;continue;}
   const ins=await client.query("INSERT INTO discovery_results(company_name,country,city,industry,website,evidence_url,evidence_title,evidence_text,opportunity,service,priority,message_ru,message_en) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT(website) DO NOTHING RETURNING id",[p.company_name,p.country,p.city,p.industry,p.website,p.evidence_url,p.evidence_title,p.evidence_text,p.opportunity,p.service,p.priority,p.message_ru,p.message_en]);
   if(ins.rowCount)added++;else duplicates++;
  }await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  const rows=await pool.query("SELECT id,company_name,country,city,industry,website,evidence_url,evidence_title,evidence_text,opportunity,service,priority,message_ru,message_en,added_company_id,created_at FROM discovery_results WHERE created_at>NOW()-INTERVAL '90 days' ORDER BY created_at DESC LIMIT 40");
  res.json({searched:discoveryQueries.length,checked:checked.filter(Boolean).length,added,duplicates,results:rows.rows});
 }catch(e){console.error('Discovery search failed:',e);res.status(502).json({error:'Поиск не завершён. Проверьте ключ API, лимиты и доступность Brave Search.'});}
});
app.post('/api/discovery/results/:id/add',async(req,res)=>{
 const c=await pool.connect();try{await c.query('BEGIN');const f=await c.query('SELECT * FROM discovery_results WHERE id=$1 FOR UPDATE',[req.params.id]);if(!f.rowCount){await c.query('ROLLBACK');return res.status(404).json({error:'Результат не найден'});}
 const p=f.rows[0];if(p.added_company_id){await c.query('COMMIT');return res.json({companyId:p.added_company_id,alreadyAdded:true});}
 const host=hostOf(new URL(p.website).hostname);const d=await c.query("SELECT id FROM companies WHERE LOWER(name)=LOWER($1) OR LOWER(regexp_replace(split_part(website,'/',3),'^www\\.',''))=$2 LIMIT 1",[p.company_name,host]);let id;
 if(d.rowCount)id=d.rows[0].id;else{const notes=['Добавлено из поиска потенциальных заказчиков','Возможность: '+p.opportunity,'Услуга: '+p.service,'Приоритет: '+p.priority,'Доказательство: '+p.evidence_url,'Сообщение RU: '+p.message_ru,'Message EN: '+p.message_en].join('\n\n');const x=await c.query("INSERT INTO companies(name,country,city,category,website,source,status,notes) VALUES($1,$2,$3,$4,$5,$6,'Новый',$7) RETURNING id",[p.company_name,p.country,p.city,p.industry,p.website,p.evidence_url,notes]);id=x.rows[0].id;}
 await c.query('UPDATE discovery_results SET added_company_id=$1 WHERE id=$2',[id,p.id]);await c.query('COMMIT');res.json({companyId:id,alreadyAdded:Boolean(d.rowCount)});
 }catch(e){await c.query('ROLLBACK');console.error(e);res.status(500).json({error:'Не удалось добавить компанию'});}finally{c.release();}
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
  {name:"Автосервис ИП Акопян",country:"Россия",city:"Москва",category:"Автосервис",phone:"+7 495 721-03-21",source:"https://asktel.ru/moskva/avtoservis/avtoservis_51/",notes:"ИП, независимый автосервис; число постов не подтверждено."},
  // 100 новых контактов из Владивостока
  {name:"Блеск",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 423 248-12-06",source:"https://spravkainform.ru/russia/vladivostok/kliningovye-uslugi-professionalnaya-uborka-pomeshcheniy-territoriy",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Чистое небо",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 423 290-90-54",source:"https://spravkainform.ru/russia/vladivostok/kliningovye-uslugi-professionalnaya-uborka-pomeshcheniy-territoriy",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Мастер клининг",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 423 226-01-58",source:"https://spravkainform.ru/russia/vladivostok/kliningovye-uslugi-professionalnaya-uborka-pomeshcheniy-territoriy",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"SkyMaster",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 914 666-85-19",source:"https://spravkainform.ru/russia/vladivostok/kliningovye-uslugi-professionalnaya-uborka-pomeshcheniy-territoriy",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Градоблеск",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 423 275-92-47",source:"https://spravkainform.ru/russia/vladivostok/kliningovye-uslugi-professionalnaya-uborka-pomeshcheniy-territoriy",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Crystal clear",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 4232 664-463",source:"https://spravkainform.ru/russia/vladivostok/kliningovye-uslugi-professionalnaya-uborka-pomeshcheniy-territoriy",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Нипылинки",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 924 125-22-85",source:"https://spravkainform.ru/russia/vladivostok/kliningovye-uslugi-professionalnaya-uborka-pomeshcheniy-territoriy",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"КИТ-Клининг и Технологии",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 423 266-42-06",source:"https://spravkainform.ru/russia/vladivostok/kliningovye-uslugi-professionalnaya-uborka-pomeshcheniy-territoriy",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Эксперт Клининг",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 924 124-99-11",source:"https://spravkainform.ru/russia/vladivostok/kliningovye-uslugi-professionalnaya-uborka-pomeshcheniy-territoriy",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Вертикальный Мир",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 423 291-92-56",source:"https://spravkainform.ru/russia/vladivostok/kliningovye-uslugi-professionalnaya-uborka-pomeshcheniy-territoriy",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Sofov-клининг",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 914 650-65-07",source:"https://spravkainform.ru/russia/vladivostok/kliningovye-uslugi-professionalnaya-uborka-pomeshcheniy-territoriy",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Дом VL",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 967 958-90-90",source:"https://spravkainform.ru/russia/vladivostok/kliningovye-uslugi-professionalnaya-uborka-pomeshcheniy-territoriy",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Элкот",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 423 259-08-64",source:"https://spravkainform.ru/russia/vladivostok/kliningovye-uslugi-professionalnaya-uborka-pomeshcheniy-territoriy",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Акватория",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 4232 997-929",source:"https://spravkainform.ru/russia/vladivostok/kliningovye-uslugi-professionalnaya-uborka-pomeshcheniy-territoriy",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Омега",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 984 148-80-84",source:"https://spravkainform.ru/russia/vladivostok/kliningovye-uslugi-professionalnaya-uborka-pomeshcheniy-territoriy",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Чистое Дело",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 984 151-07-88",source:"https://spravkainform.ru/russia/vladivostok/kliningovye-uslugi-professionalnaya-uborka-pomeshcheniy-territoriy",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"ЭКО-НИКА",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 423 208-20-01",source:"https://spravkainform.ru/russia/vladivostok/kliningovye-uslugi-professionalnaya-uborka-pomeshcheniy-territoriy",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Сухой туман",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 902 480-43-34",source:"https://spravkainform.ru/russia/vladivostok/kliningovye-uslugi-professionalnaya-uborka-pomeshcheniy-territoriy",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Белый Кот",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 4232 025-524",source:"https://spravkainform.ru/russia/vladivostok/kliningovye-uslugi-professionalnaya-uborka-pomeshcheniy-territoriy",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Маликон",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 924 726-61-28",source:"https://spravkainform.ru/russia/vladivostok/kliningovye-uslugi-professionalnaya-uborka-pomeshcheniy-territoriy",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Генералка",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 914 329-01-84",source:"https://spravkainform.ru/russia/vladivostok/kliningovye-uslugi-professionalnaya-uborka-pomeshcheniy-territoriy",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Катран",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 924 330-21-10",source:"https://spravkainform.ru/russia/vladivostok/kliningovye-uslugi-professionalnaya-uborka-pomeshcheniy-territoriy",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"ВладКлининг",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 984 195-44-34",source:"https://spravkainform.ru/russia/vladivostok/kliningovye-uslugi-professionalnaya-uborka-pomeshcheniy-territoriy",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Моем диваны",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 914 728-77-10",source:"https://spravkainform.ru/russia/vladivostok/kliningovye-uslugi-professionalnaya-uborka-pomeshcheniy-territoriy",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Братья Чистовы",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 994 018-67-92",source:"https://spravkainform.ru/russia/vladivostok/kliningovye-uslugi-professionalnaya-uborka-pomeshcheniy-territoriy",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Профклининг",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 908 961-88-81",source:"https://spravkainform.ru/russia/vladivostok/kliningovye-uslugi-professionalnaya-uborka-pomeshcheniy-territoriy",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Мир чистоты",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 4232 009-580",source:"https://spravkainform.ru/russia/vladivostok/kliningovye-uslugi-professionalnaya-uborka-pomeshcheniy-territoriy",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Главный Рабочий",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 951 015-22-01",source:"https://spravkainform.ru/russia/vladivostok/kliningovye-uslugi-professionalnaya-uborka-pomeshcheniy-territoriy",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Дизель-Н",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 902 557-70-50; +7 423 257-70-50",source:"https://vladivostok.spravker.ru/kliningovye-kompanii/",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"ПрофСанЭксперт",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 800 600-53-89; +7 423 205-45-43",source:"https://vladivostok.spravker.ru/kliningovye-kompanii/",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Аутсорсинг-ДВ",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 902 505-01-88; +7 423 290-01-88",source:"https://vladivostok.spravker.ru/kliningovye-kompanii/",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"ВладКлинСервис",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 952 083-42-82",source:"https://vladivostok.spravker.ru/kliningovye-kompanii/",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Levsky",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 914 340-15-84",source:"https://vladivostok.spravker.ru/kliningovye-kompanii/",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Чисто-Чисто",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 924 126-90-00",source:"https://vladivostok.spravker.ru/kliningovye-kompanii/",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"ЧистоДА",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 914 797-52-97; +7 914 677-28-47",source:"https://vladivostok.spravker.ru/kliningovye-kompanii/",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Азбука Чистоты",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 423 200-17-79",source:"https://vladivostok.spravker.ru/kliningovye-kompanii/",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Чистота ДВ",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 995 534-75-95",source:"https://vladivostok.spravker.ru/kliningovye-kompanii/",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Чистальон",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 902 484-60-25; +7 423 291-92-92",source:"https://vladivostok.spravker.ru/kliningovye-kompanii/",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"EcoClean",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 964 449-60-64",source:"https://vladivostok.spravker.ru/kliningovye-kompanii/",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Персонал +",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 924 003-35-10",source:"https://vladivostok.spravker.ru/kliningovye-kompanii/",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Клин Клаб",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 904 629-29-93",source:"https://vladivostok.spravker.ru/kliningovye-kompanii/",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Приморский высотный сервис",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 962 674-89-85; +7 914 738-44-13",source:"https://vladivostok.spravker.ru/kliningovye-kompanii/",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"ГринДез",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 423 241-33-90",source:"https://vladivostok.spravker.ru/kliningovye-kompanii/",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Океан clear",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 984 195-52-53",source:"https://vladivostok.spravker.ru/kliningovye-kompanii/",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Сибаину",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 951 001-20-30",source:"https://vladivostok.spravker.ru/kliningovye-kompanii/",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Аврора Клининг",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 984 198-20-01; +7 914 704-50-90",source:"https://vladivostok.spravker.ru/kliningovye-kompanii/",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"First Cleaning Company",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 914 698-96-33",source:"https://vladivostok.spravker.ru/kliningovye-kompanii/",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Клининговая компания Lily",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 423 273-27-36",source:"https://vladivostok.spravker.ru/kliningovye-kompanii/",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Настёна",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 984 151-38-88",source:"https://vladivostok.spravker.ru/kliningovye-kompanii/",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Фабрика стирки ковров Чисто",country:"Россия",city:"Владивосток",category:"Клининг",phone:"+7 914 709-00-08; +7 914 709-68-17",source:"https://vladivostok.spravker.ru/kliningovye-kompanii/",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"100авто",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 423 200-01-92",source:"https://orq.me/telefony-avtoservisy-vladivostok",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"AutoProfService",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 423 200-43-43; +7 966 273-45-21",source:"https://orq.me/telefony-avtoservisy-vladivostok",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"AutoZone",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 908 993-59-30",source:"https://orq.me/telefony-avtoservisy-vladivostok",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Autoignat",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 967 958-98-48",source:"https://orq.me/telefony-avtoservisy-vladivostok",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Avtobox",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 423 293-92-14; +7 423 293-92-83",source:"https://orq.me/telefony-avtoservisy-vladivostok",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Az_car",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 908 450-00-60",source:"https://orq.me/telefony-avtoservisy-vladivostok",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Brisk Сервис",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 914 707-55-51",source:"https://orq.me/telefony-avtoservisy-vladivostok",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Broservice",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 914 968-17-52",source:"https://orq.me/telefony-avtoservisy-vladivostok",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Car restore",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 423 201-21-48",source:"https://orq.me/telefony-avtoservisy-vladivostok",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Crude Oil",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 914 718-56-10",source:"https://orq.me/telefony-avtoservisy-vladivostok",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Custom servise",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 914 339-22-65",source:"https://orq.me/telefony-avtoservisy-vladivostok",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"D.X.T. Wrap&Detail",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 423 201-81-73; +7 924 521-27-73",source:"https://orq.me/telefony-avtoservisy-vladivostok",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Das auto",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 423 253-43-73",source:"https://orq.me/telefony-avtoservisy-vladivostok",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Dok Auto",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 423 280-21-84",source:"https://orq.me/telefony-avtoservisy-vladivostok",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Авто Тех Сервис",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 423 245-02-70",source:"https://spravkainform.ru/russia/vladivostok/remont-i-obsluzhivanie-avtotransporta",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"MAXI`m",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 423 293-20-09",source:"https://spravkainform.ru/russia/vladivostok/remont-i-obsluzhivanie-avtotransporta",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"PROFДВИЖЕНИЕ",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 423 294-77-17",source:"https://spravkainform.ru/russia/vladivostok/remont-i-obsluzhivanie-avtotransporta",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Max motor",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 908 993-93-74",source:"https://spravkainform.ru/russia/vladivostok/remont-i-obsluzhivanie-avtotransporta",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Хабиба",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 423 254-04-71",source:"https://spravkainform.ru/russia/vladivostok/remont-i-obsluzhivanie-avtotransporta",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"ГринАвто",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 423 200-52-53",source:"https://spravkainform.ru/russia/vladivostok/remont-i-obsluzhivanie-avtotransporta",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Автосервис на Днепровской",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 423 257-29-60",source:"https://spravkainform.ru/russia/vladivostok/remont-i-obsluzhivanie-avtotransporta",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Jeep Statio",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 423 200-50-55",source:"https://spravkainform.ru/russia/vladivostok/remont-i-obsluzhivanie-avtotransporta",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"СОВА",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 423 277-07-07",source:"https://spravkainform.ru/russia/vladivostok/remont-i-obsluzhivanie-avtotransporta",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Фортуна Сервис",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 423 268-69-50",source:"https://spravkainform.ru/russia/vladivostok/remont-i-obsluzhivanie-avtotransporta",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Мой Кузовной",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 423 248-38-25",source:"https://spravkainform.ru/russia/vladivostok/remont-i-obsluzhivanie-avtotransporta",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Ремцентр",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 423 269-97-88",source:"https://spravkainform.ru/russia/vladivostok/remont-i-obsluzhivanie-avtotransporta",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Легион",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 423 290-02-50",source:"https://spravkainform.ru/russia/vladivostok/remont-i-obsluzhivanie-avtotransporta",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"ДВ-Новлайн",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 423 256-18-18",source:"https://spravkainform.ru/russia/vladivostok/remont-i-obsluzhivanie-avtotransporta",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Self-service",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 423 268-99-96",source:"https://spravkainform.ru/russia/vladivostok/remont-i-obsluzhivanie-avtotransporta",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"ЕкКо-Сервис",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 423 209-11-02",source:"https://spravkainform.ru/russia/vladivostok/remont-i-obsluzhivanie-avtotransporta",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"ДальАвтоТранс",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 423 228-10-04",source:"https://spravkainform.ru/russia/vladivostok/remont-i-obsluzhivanie-avtotransporta",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Олимп Авто",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 423 255-83-83",source:"https://spravkainform.ru/russia/vladivostok/remont-i-obsluzhivanie-avtotransporta",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Флагман-Авто",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 423 276-47-77",source:"https://spravkainform.ru/russia/vladivostok/remont-i-obsluzhivanie-avtotransporta",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"M+Service",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 423 280-89-09",source:"https://spravkainform.ru/russia/vladivostok/remont-i-obsluzhivanie-avtotransporta",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Автомиг",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 950 296-28-40",source:"https://spravkainform.ru/russia/vladivostok/remont-i-obsluzhivanie-avtotransporta",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Марка-Центр",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 423 290-81-58",source:"https://spravkainform.ru/russia/vladivostok/remont-i-obsluzhivanie-avtotransporta",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Бриз-Сервис",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 423 292-02-22",source:"https://spravkainform.ru/russia/vladivostok/remont-i-obsluzhivanie-avtotransporta",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Автомастер ДВ",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 423 269-45-94",source:"https://spravkainform.ru/russia/vladivostok/remont-i-obsluzhivanie-avtotransporta",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Dreamauto.pro",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 964 448-04-10",source:"https://glav-auto.ru/services/ru/vladivostok",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"EFI-центр",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 423 255-20-47; +7 902 555-20-47",source:"https://glav-auto.ru/services/ru/vladivostok",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Turboost",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 908 990-00-66",source:"https://glav-auto.ru/services/ru/vladivostok",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Кимура-Владивосток",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 924 240-97-75",source:"https://glav-auto.ru/services/ru/vladivostok",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Ironman 4x4",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 423 258-35-14",source:"https://glav-auto.ru/services/ru/vladivostok",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Jeeptruck.ru",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 904 628-13-00; +7 924 259-76-51",source:"https://glav-auto.ru/services/ru/vladivostok",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Air Servis",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 924 230-82-93",source:"https://car.ms/autoservices/vladivostok/",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Shinservis14",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 914 739-69-69",source:"https://car.ms/autoservices/vladivostok/",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Автомастер",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 984 197-88-66",source:"https://car.ms/autoservices/vladivostok/",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Рембокс",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 423 248-08-90",source:"https://car.ms/autoservices/vladivostok/",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"Автосервис на Западной",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 423 255-80-30",source:"https://car.ms/autoservices/vladivostok/",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."},
  {name:"1000 Размера",country:"Россия",city:"Владивосток",category:"Автосервис",phone:"+7 423 202-52-52",source:"https://2gis.ru/vladivostok",status:"Новый",notes:"Контакт из открытого справочника. Проверить актуальность номера и размер бизнеса перед обращением."}
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
