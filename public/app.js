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
  return String(value || '').split(/[;,\\n]+/).map(s => s.trim()).filter(Boolean);
}
function phoneForMessenger(value) {
  const first = phoneNumbers(value)[0] || '';
  let digits = first.replace(/\\D/g, '');
  if (digits.length === 11 && digits[0] === '8') digits = '7' + digits.slice(1);
  return digits;
}
function phoneLinks(value) {
  const numbers = phoneNumbers(value);
  if (!numbers.length) return '<span class="no-action">Нет номера</span>';
  return numbers.map(number => {
    const tel = number.replace(/[^+\\d]/g, '');
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
    title: 'Коммерческое предложение · Клининг',
    offer: 'Здравствуйте!\n\nПредлагаем услуги профессионального клининга для вашей компании. Помогаем поддерживать чистоту в офисах, торговых и коммерческих помещениях без необходимости содержать собственный штат уборщиков.\n\nЧто можем предложить:\n• регулярная уборка по согласованному графику;\n• генеральная и послестроительная уборка;\n• уборка санузлов, общих зон и рабочих помещений;\n• подбор персонала и инвентаря под ваш объект.\n\nГотовы рассчитать стоимость под площадь и задачи объекта, а также предложить удобный график. Будем рады обсудить сотрудничество.\n\nС уважением,\n[Ваше имя]\n[Компания]\n[Телефон]',
    subject: 'Предложение по клининговому обслуживанию для {Компания}',
    email: 'Здравствуйте!\n\nМеня зовут [Ваше имя], представляю [Ваша компания]. Хотел(а) бы предложить вашей компании услуги профессионального клининга.\n\nМожем организовать регулярную или разовую уборку помещений в {Город}, подобрать график и рассчитать стоимость под ваши задачи.\n\nПодскажите, пожалуйста, актуально ли для вас такое предложение? Готов(а) направить расчёт и ответить на вопросы.\n\nС уважением,\n[Ваше имя]\n[Телефон]\n[Сайт]'
  },
  auto: {
    title: 'Коммерческое предложение · Автосервис',
    offer: 'Здравствуйте!\n\nПредлагаем сотрудничество в сфере привлечения клиентов и продвижения услуг вашего автосервиса. Наша задача — помочь увеличить количество обращений от автовладельцев, которым нужны ремонт и обслуживание автомобилей.\n\nВозможные направления продвижения:\n• реклама услуг диагностики и технического обслуживания;\n• продвижение ремонта двигателя, ходовой части и тормозной системы;\n• привлечение заявок на сезонные работы и замену расходников;\n• подготовка рекламных предложений под популярные услуги.\n\nПредлагаем обсудить ваши приоритетные услуги и подобрать формат продвижения с понятным бюджетом.\n\nС уважением,\n[Ваше имя]\n[Компания]\n[Телефон]',
    subject: 'Предложение по привлечению клиентов для {Компания}',
    email: 'Здравствуйте!\n\nМеня зовут [Ваше имя], представляю [Ваша компания]. Обращаюсь с предложением помочь вашему автосервису получать дополнительные обращения от автовладельцев в {Город}.\n\nМожно начать с продвижения наиболее востребованных услуг — диагностики, ремонта ходовой части, ТО и сезонных работ. Предлагаем обсудить задачи вашего сервиса и подготовить подходящий вариант сотрудничества.\n\nПодскажите, пожалуйста, кому можно направить подробное предложение?\n\nС уважением,\n[Ваше имя]\n[Телефон]\n[Сайт]'
  }
};
function readOfferTemplates() {
  try { return {...offerDefaults, ...JSON.parse(localStorage.getItem('businessLeadOfferTemplates') || '{}')}; }
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
  localStorage.setItem('businessLeadOfferTemplates', JSON.stringify(offerTemplates));
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
$('copyEmailBtn').onclick = () => copyText('Тема: ' + $('emailSubject').value + '\\n\\n' + $('emailBody').value, 'Шаблон письма');
function render() {
  $('totalCount').textContent=companies.length;
  $('newCount').textContent=companies.filter(c=>c.status==='Новый').length;
  $('workCount').textContent=companies.filter(c=>['Связались','Письмо подготовлено'].includes(c.status)).length;
  $('replyCount').textContent=companies.filter(c=>c.status==='Ответили').length;
  $('resultCount').textContent=companies.length+' записей';
  $('emptyState').hidden=companies.length!==0;
  $('companyRows').innerHTML=companies.map(c=>{
    const digits = phoneForMessenger(c.phone);
    const email = c.email ? '<a class="table-action email-action" href="mailto:'+esc(c.email)+'">Почта</a>' : '<span class="no-action">Нет email</span>';
    const phones = phoneLinks(c.phone);
    const whatsapp = digits ? '<a class="table-action whatsapp-action" href="https://wa.me/'+digits+'" target="_blank" rel="noopener">WhatsApp</a>' : '<span class="no-action">Нет номера</span>';
    const max = digits ? '<button class="table-action max-action" type="button" data-max="'+esc(digits)+'">MAX</button>' : '<span class="no-action">—</span>';
    const status = '<select class="status-select" data-status="'+c.id+'" aria-label="Статус компании">'+statuses.map(x=>'<option'+(c.status===x?' selected':'')+'>'+x+'</option>').join('')+'</select>';
    const companyQuery = encodeURIComponent(c.name || '');
    const companySearch = '<div class="company-search"><a class="search-company yandex-search" href="https://yandex.ru/search/?text='+companyQuery+'" target="_blank" rel="noopener" aria-label="Найти '+esc(c.name)+' в Яндексе">Яндекс</a><a class="search-company gis-search" href="https://2gis.ru/search/'+companyQuery+'" target="_blank" rel="noopener" aria-label="Найти '+esc(c.name)+' в 2ГИС">2ГИС</a></div>';
    return '<tr><td class="company-cell"><strong>'+esc(c.name)+'</strong>'+companySearch+'<span class="sub">'+esc([c.category,c.city,c.country].filter(Boolean).join(' · '))+'</span></td><td>'+phones+'</td><td>'+email+'</td><td>'+whatsapp+'</td><td>'+max+'</td><td>'+status+'</td><td><button class="icon-btn" data-delete="'+c.id+'" title="Удалить компанию">×</button></td></tr>';
  }).join('') || '<tr><td colspan="7" class="empty">Нет компаний по выбранным условиям</td></tr>';
}
async function load() {
  try { companies=await request('/api/companies?'+new URLSearchParams(filters())); render(); }
  catch(e) { $('companyRows').innerHTML='<tr><td colspan="7" class="empty">'+esc(e.message)+'</td></tr>'; }
}
function openForm() {
  $('companyForm').reset(); $('formError').textContent='';
  $('companyId').value='';
  $('dialogTitle').textContent='Новая компания';
  fields.forEach(f=>$(f).value=(f==='category'?'Автосервис':f==='status'?'Новый':''));
  $('companyDialog').showModal();
}
function closeForm() { $('companyDialog').close(); }
$('addBtn').onclick=openForm; $('emptyAdd').onclick=openForm;
$('closeDialog').onclick=closeForm; $('cancelDialog').onclick=closeForm; $('refreshBtn').onclick=load;
$('companyForm').onsubmit=async e=>{
  e.preventDefault(); $('formError').textContent='';
  const data=Object.fromEntries(fields.map(f=>[f,$(f).value.trim()]));
  try { await request('/api/companies',{method:'POST',body:JSON.stringify(data)}); closeForm(); await load(); }
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