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
function phoneForMessenger(value) {
  const first = String(value || '').split(/[;,\n]/)[0].trim();
  let digits = first.replace(/\D/g, '');
  if (digits.length === 11 && digits[0] === '8') digits = '7' + digits.slice(1);
  return digits;
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
    return '<tr><td class="company-cell"><strong>'+esc(c.name)+'</strong><span class="sub">'+esc([c.category,c.city,c.country].filter(Boolean).join(' · '))+'</span></td><td>'+phones+'</td><td>'+email+'</td><td>'+whatsapp+'</td><td>'+max+'</td><td>'+status+'</td><td><button class="icon-btn" data-delete="'+c.id+'" title="Удалить компанию">×</button></td></tr>';
  }).join('') || '<tr><td colspan="7" class="empty">Нет компаний по выбранным условиям</td></tr>';
}
async function load() {
  try { companies=await request('/api/companies?'+new URLSearchParams(filters())); render(); }
  catch(e) { $('companyRows').innerHTML='<tr><td colspan="6" class="empty">'+esc(e.message)+'</td></tr>'; }
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