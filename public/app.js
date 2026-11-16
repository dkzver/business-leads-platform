const $ = id => document.getElementById(id);
const fields = ['name','category','status','country','city','phone','email','website','source','notes'];
const statuses = ['Новый','Письмо подготовлено','Связались','Ответили','Не подходит'];
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
const offerDefaults = {
  cleaning: {
    title: 'Коммерческое предложение · SaaS-платформа для клининга',
    offer: "Здравствуйте!\\n\\nСейчас изучаем, как клининговые компании организуют работу с заявками, клиентами и сотрудниками, и какие задачи чаще всего отнимают у руководителя время.\\n\\nМы занимаемся разработкой программных решений для бизнеса и хотим сначала разобраться в реальных потребностях вашей компании. Возможно, часть повседневных процессов можно упростить с помощью удобной собственной системы: например, вести заявки и клиентскую базу в одном месте, планировать уборки, распределять задания между бригадами и отслеживать выполнение заказов.\\n\\nНе хотим предлагать лишние функции — сначала важно понять, как всё устроено у вас и что действительно было бы полезно. Если тема вам интересна, можно задать несколько коротких вопросов о работе компании?\\n\\nСпасибо!\\n[Ваше имя]\\n[Компания]\\n[Телефон]",
    subject: 'Разработка SaaS-платформы для клининговой компании {Компания}',
    email: "Здравствуйте!\\n\\nИзучаем, как клининговые компании ведут заявки, клиентскую базу, планируют уборки и координируют сотрудников. Хотим понять, какие процессы отнимают больше всего времени и что хотелось бы упростить.\\n\\nМы разрабатываем программные решения для бизнеса. На основе реальных потребностей можем предложить удобную систему для управления заявками, клиентами, графиком и работой бригад — без лишних функций, только то, что действительно нужно вашей компании.\\n\\nБудет ли вам удобно коротко рассказать, как сейчас организованы эти процессы?\\n\\nС уважением,\\n[Ваше имя]\\n[Телефон]"
  },
  auto: {
    title: 'Коммерческое предложение · SaaS-платформа для автосервиса',
    offer: "Здравствуйте!\\n\\nСейчас изучаем, как небольшие автосервисы организуют запись клиентов, учёт автомобилей, заказ-наряды и загрузку мастеров. Хотим понять, какие рабочие задачи чаще всего отнимают время у владельца или администратора СТО.\\n\\nМы занимаемся разработкой программных решений для бизнеса. Возможно, некоторые процессы вашего автосервиса можно упростить с помощью собственной системы: вести записи и историю обслуживания, контролировать статусы работ, хранить информацию о клиентах и автомобилях, планировать загрузку постов.\\n\\nНо сначала важно разобраться в вашей реальной работе, а не предлагать ненужный продукт. Если вы не против, можно задать несколько коротких вопросов о том, как сейчас устроена работа сервиса?\\n\\nСпасибо!\\n[Ваше имя]\\n[Компания]\\n[Телефон]",
    subject: 'Разработка SaaS-системы для автосервиса {Компания}',
    email: "Здравствуйте!\\n\\nИзучаем, как небольшие автосервисы ведут запись клиентов, учитывают автомобили и заказ-наряды, контролируют ход работ и планируют загрузку мастеров. Хотим понять, какие процессы неудобны или требуют больше всего ручной работы.\\n\\nМы разрабатываем программные решения для бизнеса и рассматриваем возможность создания систем под реальные задачи СТО: запись, клиентская база, история обслуживания, статусы ремонта и загрузка постов. Сначала хотели бы узнать, что действительно было бы полезно вашему сервису.\\n\\nПодскажите, можно ли задать вам несколько коротких вопросов о текущих процессах?\\n\\nС уважением,\\n[Ваше имя]\\n[Телефон]"
  }
};
function readOfferTemplates() {
  try { return {...offerDefaults, ...JSON.parse(localStorage.getItem('businessLeadOfferTemplatesV2') || '{}')}; }
  catch { return {...offerDefaults}; }
}
let offerTemplates = readOfferTemplates();
function openOffer(type) {
  const data = offerTemplates[type] || offerDefaults[type];
  $('offerType').value = type;
  $('offerDialogTitle').textContent = data.title;
  $('offerText').value = data.offer;
  $('emailSubject').value = data.subject;
  $('emailBody').value = data.email;
  $('offerSaved').textContent = '';
  $('offerDialog').showModal();
}
function saveOffer() {
  const type = $('offerType').value;
  offerTemplates[type] = {
    title: offerDefaults[type].title,
    offer: $('offerText').value,
    subject: $('emailSubject').value,
    email: $('emailBody').value
  };
  localStorage.setItem('businessLeadOfferTemplatesV2', JSON.stringify(offerTemplates));
  $('offerSaved').textContent = 'Шаблон сохранён в этом браузере.';
}
async function copyText(value, label) {
  try { await navigator.clipboard.writeText(value); showToast(label + ' скопировано'); }
  catch { showToast('Не удалось скопировать автоматически. Выделите текст и скопируйте вручную.'); }
}
$('cleaningOfferBtn').onclick = () => openOffer('cleaning');
$('autoOfferBtn').onclick = () => openOffer('auto');
$('closeOfferDialog').onclick = () => $('offerDialog').close();
$('saveOfferBtn').onclick = saveOffer;
$('copyOfferBtn').onclick = () => copyText($('offerText').value, 'КП');
$('copyEmailBtn').onclick = () => copyText('Тема: ' + $('emailSubject').value + '\n\n' + $('emailBody').value, 'Шаблон письма');
function render() {
  $('totalCount').textContent=companies.length;
  $('newCount').textContent=companies.filter(c=>c.status==='Новый').length;
  $('workCount').textContent=companies.filter(c=>['Связались','Письмо подготовлено'].includes(c.status)).length;
  $('replyCount').textContent=companies.filter(c=>c.status==='Ответили').length;
  $('resultCount').textContent=companies.length+' записей';
  $('emptyState').hidden=companies.length!==0;
  $('companyRows').innerHTML=companies.map(c=>{
    const digits = phoneForMessenger(c.phone);
    const email = '<div class="email-cell">'+(c.email ? '<a class="table-action email-action" href="mailto:'+esc(c.email)+'">Почта</a>' : '<span class="no-action">Нет email</span>')+'<button class="table-action edit-email-action" type="button" data-edit="'+c.id+'">Изменить email</button></div>';
    const phones = phoneLinks(c.phone);
    const whatsapp = digits ? '<a class="table-action whatsapp-action" href="https://wa.me/'+digits+'" target="_blank" rel="noopener">WhatsApp</a>' : '<span class="no-action">Нет номера</span>';
    const max = digits ? '<button class="table-action max-action" type="button" data-max="'+esc(digits)+'">MAX</button>' : '<span class="no-action">—</span>';
    const status = '<select class="status-select" data-status="'+c.id+'" aria-label="Статус компании">'+statuses.map(x=>'<option'+(c.status===x?' selected':'')+'>'+x+'</option>').join('')+'</select>';
    const searchText = [c.name, c.city, c.country].filter(Boolean).join(' ');
    const companyQuery = encodeURIComponent(searchText);
    const companySearch = '<div class="company-search"><a class="search-company yandex-search" href="https://yandex.ru/maps/?text='+companyQuery+'" target="_blank" rel="noopener noreferrer" aria-label="Найти '+esc(c.name)+' в Яндекс Картах">Яндекс</a><a class="search-company gis-search" href="https://2gis.ru/search/'+companyQuery+'" target="_blank" rel="noopener noreferrer" aria-label="Найти '+esc(c.name)+' в 2ГИС">2ГИС</a></div>';
    return '<tr><td class="company-cell"><strong>'+esc(c.name)+'</strong>'+companySearch+'<span class="sub">'+esc([c.category,c.city,c.country].filter(Boolean).join(' · '))+'</span></td><td>'+phones+'</td><td>'+email+'</td><td>'+whatsapp+'</td><td>'+max+'</td><td>'+status+'</td><td><button class="icon-btn" data-delete="'+c.id+'" title="Удалить компанию">×</button></td></tr>';
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
    window.open('https://max.ru/','_blank','noopener');
    try { await navigator.clipboard.writeText(number); showToast('Номер '+number+' скопирован. В MAX вставьте его в поиск контактов.'); }
    catch { showToast('Найдите клиента в MAX по номеру: '+number); }
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

load();