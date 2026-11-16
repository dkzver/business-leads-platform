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
    offer: 'Здравствуйте!\n\nПредлагаем разработать для вашей клининговой компании собственную SaaS-платформу — цифровой сервис для управления заявками, клиентами и работой сотрудников. Это будет не предложение клининговых услуг, а создание программного инструмента для развития и автоматизации именно вашего бизнеса.\n\nВозможности платформы можно адаптировать под ваши процессы:\n• приём заявок с сайта и из мессенджеров в единую систему;\n• база клиентов, объектов и история заказов;\n• расчёт стоимости уборки по площади, типу и параметрам объекта;\n• календарь заказов и распределение задач между бригадами;\n• контроль статусов заказов и уведомления клиентам;\n• отчёты по заявкам, повторным обращениям и выручке.\n\nРазработаем решение под ваши задачи, разместим его на сервере и предусмотрим возможность дальнейшего развития. Состав функций, сроки и стоимость согласуем после короткого обсуждения ваших процессов.\n\nБудет удобно показать, как такая система может работать для вашей компании?\n\nС уважением,\n[Ваше имя]\n[Компания]\n[Телефон]',
    subject: 'Разработка SaaS-платформы для клининговой компании {Компания}',
    email: 'Здравствуйте!\n\nПредлагаем создать для вашей компании собственную SaaS-платформу для автоматизации клинингового бизнеса. Речь идёт о разработке программного сервиса и его размещении на сервере, а не об оказании услуг уборки.\n\nВ системе можно объединить заявки, клиентскую базу, объекты, расчёт стоимости, расписание бригад, статусы заказов и уведомления. Функциональность адаптируем под ваши реальные процессы.\n\nЕсли идея актуальна, готовы обсудить задачи вашей компании в {Город}, предложить состав первой версии, сроки и стоимость разработки.\n\nПодскажите, кому можно направить подробное предложение?\n\nС уважением,\n[Ваше имя]\n[Телефон]\n[Сайт]'
  },
  auto: {
    title: 'Коммерческое предложение · SaaS-платформа для автосервиса',
    offer: 'Здравствуйте!\n\nПредлагаем разработать для вашего автосервиса собственную SaaS-платформу — онлайн-систему для управления клиентами, автомобилями, записями и заказ-нарядами. Это предложение по созданию программного продукта для вашего бизнеса, а не по ремонту или обслуживанию автомобилей.\n\nВозможности платформы можно адаптировать под работу вашего СТО:\n• онлайн-запись клиентов и календарь загрузки постов;\n• карточка клиента и история обслуживания автомобиля;\n• учёт заявок, заказ-нарядов и статусов ремонта;\n• согласование работ и отправка уведомлений клиентам;\n• база запчастей и расходных материалов;\n• напоминания о ТО и повторном обслуживании;\n• отчёты по загрузке, обращениям и выручке.\n\nСоздадим систему под процессы вашего автосервиса, развернём её на сервере и оставим возможность добавлять новые модули по мере роста. Состав первой версии, сроки и стоимость определим после обсуждения ваших задач.\n\nИнтересно обсудить, какая система была бы полезна вашему автосервису?\n\nС уважением,\n[Ваше имя]\n[Компания]\n[Телефон]',
    subject: 'Разработка SaaS-системы для автосервиса {Компания}',
    email: 'Здравствуйте!\n\nПредлагаем разработать для вашего автосервиса собственную SaaS-систему для управления работой СТО. Это создание программного сервиса с размещением на сервере, а не предложение услуг авторемонта.\n\nВ системе можно реализовать онлайн-запись, базу клиентов и автомобилей, историю обслуживания, заказ-наряды, статусы ремонта, уведомления и отчёты. Функции подберём с учётом размера и процессов вашего автосервиса.\n\nГотовы обсудить задачи вашей компании в {Город}, предложить состав первой версии, сроки и стоимость разработки.\n\nПодскажите, кому можно направить подробное описание проекта?\n\nС уважением,\n[Ваше имя]\n[Телефон]\n[Сайт]'
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
    const email = '<div class="email-cell">'+(c.email ? '<a class="table-action email-action" href="mailto:'+esc(c.email)+'">Почта</a>' : '<span class="no-action">Нет email</span>')+'<button class="table-action edit-email-action" type="button" data-edit="'+c.id+'">'+(c.email ? 'Изменить email' : 'Добавить email')+'</button></div>';
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