const $ = id => document.getElementById(id);
const fields = ['name','category','status','country','city','phone','email','website','source','notes'];
const statuses = ['Новый','Письмо подготовлено','Связались','Ответили','Не подходит'];
let outreachTemplates = [];
let companies = [];
let timer;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const filters = () => ({q:$('search').value.trim(),country:$('countryFilter').value.trim(),city:$('cityFilter').value.trim(),category:$('categoryFilter').value,status:$('statusFilter').value});
async function request(url, options={}) {
  const response = await fetch(url,{headers:{'Content-Type':'application/json'},...options});
  if (!response.ok) { let data={}; try{data=await response.json()}catch{} throw new Error(data.error || 'Ошибка запроса'); }
  return response.status===204 ? null : response.json();
}
function phoneNumbers(value) {
  return String(value || '').split(/[;,\n]+/).map(s => s.trim()).filter(Boolean);
}
function phoneForMessenger(value) {
  const first = phoneNumbers(value)[0] || '';
  let digits = first.replace(/\D/g, '');
  if (digits.length === 11 && digits[0] === '8') digits = '7' + digits.slice(1);
  if (digits.length === 10) digits = '7' + digits;
  return digits;
}
function phoneLinks(value) {
  const numbers = phoneNumbers(value);
  if (!numbers.length) return '<span class="no-action">Нет номера</span>';
  return numbers.map(number => {
    const tel = number.replace(/[^\d+]/g, '');
    return '<a class="table-action phone-action" href="tel:'+esc(tel)+'">'+esc(number)+'</a>';
  }).join('<br>');
}
function showToast(message) {
  let toast = document.getElementById('actionToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'actionToast';
    toast.className = 'action-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('visible'), 4200);
}
const offerTitles = { cleaning: 'Текст для клининговых компаний', auto: 'Текст для автосервисов' };
async function openOffer(type) {
  $('offerType').value = type;
  $('offerDialogTitle').textContent = offerTitles[type];
  $('offerText').value = 'Загрузка текста из базы данных…';
  $('offerText').disabled = true;
  $('offerSaved').textContent = '';
  $('offerDialog').showModal();
  try {
    const data = await request('/api/templates/' + type);
    $('offerText').value = data.body;
  } catch (err) {
    $('offerText').value = '';
    $('offerSaved').textContent = err.message;
  } finally {
    $('offerText').disabled = false;
  }
}
async function saveOffer() {
  const type = $('offerType').value;
  try {
    const data = await request('/api/templates/' + type, { method: 'PUT', body: JSON.stringify({ body: $('offerText').value }) });
    $('offerText').value = data.body;
    $('offerSaved').textContent = 'Сохранено в базе данных. Этот текст будет доступен с любого устройства.';
  } catch (err) {
    $('offerSaved').textContent = err.message;
  }
}
async function copyText(value, label) {
  try { await navigator.clipboard.writeText(value); showToast(label + ' скопировано'); }
  catch { showToast('Не удалось скопировать автоматически. Выделите текст и скопируйте вручную.'); }
}
$('cleaningOfferBtn').onclick = () => openOffer('cleaning');
$('autoOfferBtn').onclick = () => openOffer('auto');
$('closeOfferDialog').onclick = () => $('offerDialog').close();
$('saveOfferBtn').onclick = saveOffer;
$('copyOfferBtn').onclick = () => copyText($('offerText').value, 'Текст');
function render() {
  $('totalCount').textContent=companies.length;
  $('newCount').textContent=companies.filter(c=>c.status==='Новый').length;
  $('workCount').textContent=companies.filter(c=>['Связались','Письмо подготовлено'].includes(c.status)).length;
  $('replyCount').textContent=companies.filter(c=>c.status==='Ответили').length;
  $('resultCount').textContent=companies.length+' записей';
  $('emptyState').hidden=companies.length!==0;
  $('companyRows').innerHTML=companies.map(c=>{
    const digits = phoneForMessenger(c.phone);
    const auditButton = '<button class="table-action audit-action" type="button" data-audit-open="'+c.id+'">Анализ сайта</button>';
    const email = '<div class="email-cell">'+(c.email ? '<a class="table-action email-action" href="mailto:'+esc(c.email)+'">Почта</a>' : '<span class="no-action">Нет email</span>')+'<button class="table-action edit-email-action" type="button" data-edit="'+c.id+'">Изменить email</button></div>';
    const phones = phoneLinks(c.phone);
    const whatsapp = digits ? '<a class="table-action whatsapp-action" href="https://wa.me/'+digits+'" target="_blank" rel="noopener">WhatsApp</a>' : '<span class="no-action">Нет номера</span>';
    const max = digits ? '<button class="table-action max-action" type="button" data-max="'+esc(digits)+'">MAX</button>' : '<span class="no-action">—</span>';
    const status = '<select class="status-select" data-status="'+c.id+'" aria-label="Статус компании">'+statuses.map(x=>'<option'+(c.status===x?' selected':'')+'>'+x+'</option>').join('')+'</select>';
    const searchText = [c.name, c.city, c.country].filter(Boolean).join(' ');
    const companyQuery = encodeURIComponent(searchText);
    const companySearch = '<div class="company-search"><a class="search-company yandex-search" href="https://yandex.ru/maps/?text='+companyQuery+'" target="_blank" rel="noopener noreferrer" aria-label="Найти '+esc(c.name)+' в Яндекс Картах">Яндекс</a><a class="search-company gis-search" href="https://2gis.ru/search/'+companyQuery+'" target="_blank" rel="noopener noreferrer" aria-label="Найти '+esc(c.name)+' в 2ГИС">2ГИС</a></div>';
    return '<tr><td class="company-cell"><strong>'+esc(c.name)+'</strong>'+companySearch+auditButton+'<span class="sub">'+esc([c.category,c.city,c.country].filter(Boolean).join(' · '))+'</span></td><td>'+phones+'</td><td>'+email+'</td><td>'+whatsapp+'</td><td>'+max+'</td><td>'+status+'</td><td><button class="icon-btn" data-delete="'+c.id+'" title="Удалить компанию">×</button></td></tr>';
  }).join('') || '<tr><td colspan="7" class="empty">Нет компаний по выбранным условиям</td></tr>';
}
async function load() {
  try { companies=await request('/api/companies?'+new URLSearchParams(filters())); render(); }
  catch(e) { $('companyRows').innerHTML='<tr><td colspan="7" class="empty">'+esc(e.message)+'</td></tr>'; }
}
function openForm(company=null) {
  $('companyForm').reset(); $('formError').textContent='';
  $('companyId').value=company?.id || '';
  $('dialogTitle').textContent=company?'Изменить компанию':'Новая компания';
  fields.forEach(f=>$(f).value=company ? (company[f] ?? '') : (f==='category'?'Автосервис':f==='status'?'Новый':''));
  $('companyDialog').showModal();
}
function closeForm() { $('companyDialog').close(); }
$('addBtn').onclick=openForm; $('emptyAdd').onclick=openForm;
$('closeDialog').onclick=closeForm; $('cancelDialog').onclick=closeForm; $('refreshBtn').onclick=load;
$('companyForm').onsubmit=async e=>{
  e.preventDefault(); $('formError').textContent='';
  const data=Object.fromEntries(fields.map(f=>[f,$(f).value.trim()]));
  try { const id=$('companyId').value; await request(id?'/api/companies/'+id:'/api/companies',{method:id?'PUT':'POST',body:JSON.stringify(data)}); closeForm(); await load(); showToast(id?'Данные клиента обновлены':'Компания добавлена'); }
  catch(err){$('formError').textContent=err.message;}
};
$('companyRows').onclick=async e=>{
  const maxButton=e.target.closest('[data-max]');
  if(maxButton){
    const number=maxButton.dataset.max;
    // MAX does not provide a public direct-chat URL by phone number.
    // Open the actual web messenger and copy the number for its contact search.
    window.open('https://web.max.ru/','_blank','noopener,noreferrer');
    try {
      await navigator.clipboard.writeText(number);
      showToast('Номер '+number+' скопирован. В MAX откройте «Контакты» → «+» → «Найти по номеру» и вставьте его.');
    } catch {
      showToast('В MAX откройте «Контакты» → «+» → «Найти по номеру». Номер клиента: '+number);
    }
    return;
  }
  const edit=e.target.closest('[data-edit]');
  if(edit){const company=companies.find(x=>String(x.id)===edit.dataset.edit);if(company)openForm(company);return;}
  const del=e.target.closest('[data-delete]');
  if(del){const c=companies.find(x=>String(x.id)===del.dataset.delete);if(c&&confirm('Удалить компанию «'+c.name+'»?')){try{await request('/api/companies/'+c.id,{method:'DELETE'});await load();}catch(err){alert(err.message);}}}
};
$('companyRows').onchange=async e=>{
  const select=e.target.closest('[data-status]');
  if(!select)return;
  const id=select.dataset.status;
  const newStatus=select.value;
  select.disabled=true;
  try {
    await request('/api/companies/'+id+'/status',{method:'PATCH',body:JSON.stringify({status:newStatus})});
    const company=companies.find(c=>String(c.id)===id);
    if(company)company.status=newStatus;
    render();
    showToast('Статус сохранён');
  } catch(err) { alert(err.message); await load(); }
};
['search','countryFilter','cityFilter','categoryFilter','statusFilter'].forEach(id=>{
  $(id).addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(load,250);});
  $(id).addEventListener('change',load);
});


async function openOutreach() {
  $('outreachCompany').innerHTML = companies.map(c => '<option value="'+esc(c.id)+'">'+esc(c.name+' · '+[c.city,c.country].filter(Boolean).join(', '))+'</option>').join('');
  $('outreachMessage').textContent = '';
  if (!companies.length) $('outreachMessage').textContent = 'Сначала добавьте компанию в CRM.';
  try { outreachTemplates = await request('/api/templates'); } catch(e) { $('outreachMessage').textContent = e.message; }
  $('outreachDialog').showModal();
  fillOutreach();
}
function fillOutreach() {
  const company = companies.find(c => String(c.id) === $('outreachCompany').value);
  const type = $('outreachType').value, lang = $('outreachLanguage').value;
  const key = (type === 'cleaning' || type === 'auto') ? type + (lang === 'en' ? '_en' : '') : type + '_' + lang;
  const template = outreachTemplates.find(t => t.type === key);
  if (!template) { $('outreachBody').value = 'Для выбранной комбинации пока нет шаблона.'; return; }
  $('outreachBody').value = template.body.replaceAll('{{company}}', company?.name || 'название компании').replaceAll('{{your_name}}', $('outreachName').value || 'Ваше имя');
  $('outreachSubject').value = lang === 'en' ? 'A practical digital improvement idea for your business' : 'Идея для развития цифровых процессов вашей компании';
}
$('outreachBtn').onclick = openOutreach;
$('closeOutreach').onclick = () => $('outreachDialog').close();
['outreachCompany','outreachLanguage','outreachType','outreachName'].forEach(id => $(id).addEventListener('change', fillOutreach));
$('outreachName').addEventListener('input', fillOutreach);
$('copyOutreach').onclick = () => copyText($('outreachBody').value, 'Предложение');
$('emailOutreach').onclick = () => {
  const company = companies.find(c => String(c.id) === $('outreachCompany').value);
  if (!company?.email) { $('outreachMessage').textContent = 'У этой компании не указан email. Добавьте адрес в карточку компании.'; return; }
  const body = encodeURIComponent($('outreachBody').value + '\n\nЕсли вы не хотите получать подобные предложения, просто сообщите мне об этом.');
  window.location.href = 'mailto:' + encodeURIComponent(company.email) + '?subject=' + encodeURIComponent($('outreachSubject').value) + '&body=' + body;
  $('outreachMessage').textContent = 'Черновик открыт в почтовом приложении. Проверьте его и отправьте вручную.';
};
$('exportBtn').onclick = () => {
  const headers = ['name','category','status','country','city','phone','email','website','source','notes'];
  const csv = [headers.join(','), ...companies.map(c => headers.map(k => '"'+String(c[k] ?? '').replace(/"/g,'""')+'"').join(','))].join('\r\n');
  const blob = new Blob(['\ufeff'+csv], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = 'freelance-outreach-leads.csv'; a.click(); URL.revokeObjectURL(url);
};


function parseCsv(text) {
  const rows=[]; let row=[], field='', quoted=false;
  const firstLine=String(text).split(/\r?\n/,1)[0]||'';
  const delimiter=(firstLine.split(';').length>firstLine.split(',').length)?';':',';
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(quoted){ if(ch==='"' && text[i+1]==='"'){field+='"';i++;} else if(ch==='"') quoted=false; else field+=ch; }
    else if(ch==='"') quoted=true;
    else if(ch===delimiter){row.push(field);field='';}
    else if(ch==='\n' || ch==='\r'){if(ch==='\r' && text[i+1]==='\n')i++;row.push(field);if(row.some(v=>v.trim()))rows.push(row);row=[];field='';}
    else field+=ch;
  }
  row.push(field);if(row.some(v=>v.trim()))rows.push(row);
  if(!rows.length)return [];
  const norm = v => String(v||'').trim().toLowerCase().replace(/[ё]/g,'е').replace(/[ _-]+/g,'');
  const aliases={name:['name','company','companyname','название','компания','названиекомпании'],country:['country','страна'],city:['city','город'],category:['category','industry','направление','категория','отрасль'],phone:['phone','телефон','тел'],email:['email','e-mail','почта'],website:['website','site','url','сайт'],source:['source','источник'],status:['status','статус'],notes:['notes','note','заметки','примечание']};
  const headers=rows[0].map(norm), map={};
  for(const [key,names] of Object.entries(aliases)){const idx=headers.findIndex(v=>names.includes(v));if(idx>=0)map[key]=idx;}
  if(map.name===undefined) throw new Error('Не найдена колонка с названием компании. Поддерживаются name, company, название, компания.');
  return rows.slice(1).map(r=>Object.fromEntries(Object.entries(map).map(([k,i])=>[k,r[i]||''])));
}
$('importBtn').onclick=()=>$('importFile').click();
$('importFile').onchange=async()=>{
 const file=$('importFile').files[0]; if(!file)return;
 try{
  const rows=parseCsv((await file.text()).replace(/^\uFEFF/,''));
  if(!rows.length)throw new Error('В CSV нет строк с компаниями.');
  const result=await request('/api/companies/import',{method:'POST',body:JSON.stringify({companies:rows})});
  await load(); showToast('Импортировано: '+result.imported+' · дубли: '+result.duplicates+' · пропущено: '+result.invalid);
 }catch(e){alert('Ошибка импорта: '+e.message);}finally{$('importFile').value='';}
};
function auditScore(){
 const ids=['https','mobile','clearServices','contactInfo','leadForm','portfolio','booking','speed'];
 const score=Math.round(ids.filter(k=>$('audit_'+k).checked).length/ids.length*100);
 $('auditScore').textContent=score+'%';return score;
}
async function openAudit(id){
 const c=companies.find(x=>String(x.id)===String(id));if(!c)return;
 $('auditCompanyId').value=c.id;$('auditTitle').textContent=c.name;$('auditWebsite').textContent=c.website||'Сайт не указан';
 try{
  const data=await request('/api/companies/'+id+'/audit'),a=data.audit||{};
  ['https','mobile','clearServices','contactInfo','leadForm','portfolio','booking','speed'].forEach(k=>$('audit_'+k).checked=Boolean(a[k]));
  $('auditOpportunity').value=a.opportunity||'';$('auditNotes').value=a.notes||'';
 }catch(e){showToast(e.message);return;}
 auditScore();$('auditDialog').showModal();
}
$('companyRows').addEventListener('click',e=>{
 const btn=e.target.closest('[data-audit-open]');if(btn)openAudit(btn.dataset.auditOpen);
});
$('closeAudit').onclick=()=>$('auditDialog').close();$('cancelAudit').onclick=()=>$('auditDialog').close();
document.querySelectorAll('[data-audit]').forEach(el=>el.addEventListener('change',auditScore));
$('auditForm').onsubmit=async e=>{
 e.preventDefault();
 const data={};
 document.querySelectorAll('[data-audit]').forEach(el=>data[el.dataset.audit]=el.checked);
 data.opportunity=$('auditOpportunity').value;data.notes=$('auditNotes').value;
 try{
  await request('/api/companies/'+$('auditCompanyId').value+'/audit',{method:'PUT',body:JSON.stringify(data)});
  $('auditDialog').close();showToast('Анализ сайта сохранён');
 }catch(err){showToast(err.message);}
};


function renderDiscovery(rows){
 const list=Array.isArray(rows)?rows:[];
 $('discoveryMeta').textContent=list.length+' результатов за последние 90 дней · повторы исключаются';
 $('discoveryResults').innerHTML=list.map(x=>{
 const loc=[x.city,x.country].filter(Boolean).join(', ')||'Местоположение не указано';
 return '<article class="discovery-card"><div class="discovery-card-head"><div><h3>'+esc(x.company_name)+'</h3><p>'+esc(loc+' · '+x.industry)+'</p></div><span class="discovery-priority '+(x.priority==='Высокий'?'high':'medium')+'">'+esc(x.priority)+'</span></div><p class="discovery-opportunity">'+esc(x.opportunity)+'</p><p class="discovery-service"><b>Услуга:</b> '+esc(x.service)+'</p><div class="discovery-links"><a href="'+esc(x.website)+'" target="_blank" rel="noopener noreferrer">Официальный сайт</a><a href="'+esc(x.evidence_url)+'" target="_blank" rel="noopener noreferrer">Страница-доказательство ↗</a></div><p class="discovery-evidence"><b>Источник:</b> '+esc(x.evidence_title)+' — '+esc(x.evidence_text)+'</p><details class="discovery-messages"><summary>Первое сообщение · RU / EN</summary><div><b>Русский</b><p>'+esc(x.message_ru)+'</p><b>English</b><p>'+esc(x.message_en)+'</p></div></details><div class="discovery-card-foot"><span>Контакт не найден автоматически · нужна ручная проверка</span><button class="secondary" data-discovery-add="'+x.id+'" '+(x.added_company_id?'disabled':'')+'>'+(x.added_company_id?'Добавлено в CRM':'Добавить в компании')+'</button></div></article>';
 }).join('')||'<div class="discovery-empty">Новых подтверждённых компаний пока нет.</div>';
}
async function loadDiscovery(){try{renderDiscovery(await request('/api/discovery/results'));}catch(e){$('discoveryStatus').textContent=e.message;}}
$('searchProspectsBtn').onclick=async()=>{
 const b=$('searchProspectsBtn');b.disabled=true;b.textContent='Ищу компании…';$('discoveryStatus').textContent='Поиск по открытым источникам и проверка сайтов. Это может занять до минуты.';
 try{const d=await request('/api/discovery/search',{method:'POST',body:JSON.stringify({})});renderDiscovery(d.results);$('discoveryStatus').textContent='Регионов поиска: '+d.searched+' · проверено страниц: '+d.checked+' · новых результатов: '+d.added+' · повторов: '+d.duplicates+'.';showToast('Поиск завершён: '+d.added+' новых компаний.');}
 catch(e){$('discoveryStatus').textContent=e.message;if(e.message.includes('BRAVE_SEARCH_API_KEY'))$('discoveryStatus').innerHTML=esc(e.message)+' <a href="https://api-dashboard.search.brave.com/" target="_blank" rel="noopener noreferrer">Открыть Brave Search API</a>';}
 finally{b.disabled=false;b.textContent='⌕ Найти заказчиков';}
};
$('discoveryResults').onclick=async e=>{const b=e.target.closest('[data-discovery-add]');if(!b||b.disabled)return;b.disabled=true;try{await request('/api/discovery/results/'+encodeURIComponent(b.dataset.discoveryAdd)+'/add',{method:'POST',body:JSON.stringify({})});await Promise.all([load(),loadDiscovery()]);showToast('Компания добавлена в CRM');}catch(err){b.disabled=false;showToast(err.message);}};

loadDiscovery();
load();