const $ = id => document.getElementById(id);
const fields = ['name','category','status','country','city','phone','email','website','source','notes'];
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
  const first = String(value || '').split(/[;,\\n]/)[0].trim();
  let digits = first.replace(/\\D/g, '');
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
function badge(status) {
  const cls = status==='Новый'?'new':status==='Ответили'?'reply':status==='Связались'||status==='Письмо подготовлено'?'work':'';
  return '<span class="badge '+cls+'">'+esc(status)+'</span>';
}
function render() {
  $('totalCount').textContent=companies.length;
  $('newCount').textContent=companies.filter(c=>c.status==='Новый').length;
  $('workCount').textContent=companies.filter(c=>['Связались','Письмо подготовлено'].includes(c.status)).length;
  $('replyCount').textContent=companies.filter(c=>c.status==='Ответили').length;
  $('resultCount').textContent=companies.length+' записей';
  $('emptyState').hidden=companies.length!==0;
  $('companyRows').innerHTML=companies.map(c=>{
    const digits = phoneForMessenger(c.phone);\n    const contact=[c.phone?'<span>'+esc(c.phone)+'</span>':'',c.email?'<a href="mailto:'+esc(c.email)+'">'+esc(c.email)+'</a>':'',c.website?'<a href="'+esc(c.website)+'" target="_blank" rel="noopener">Сайт ↗</a>':'',digits?'<div class="messenger-actions"><a class="messenger-btn whatsapp" href="https://wa.me/'+digits+'" target="_blank" rel="noopener" title="Открыть WhatsApp">WhatsApp</a><button class="messenger-btn max" type="button" data-max="'+esc(digits)+'" title="Скопировать номер и открыть MAX">MAX</button></div>':''].filter(Boolean).join('');
    return '<tr><td>'+esc(c.name)+'<span class="sub">'+esc(c.source||'Источник не указан')+'</span></td><td>'+esc(c.category)+'</td><td class="contact">'+(contact||'—')+'</td><td>'+esc([c.city,c.country].filter(Boolean).join(', ')||'—')+'</td><td>'+badge(c.status)+'</td><td><div class="row-actions"><button class="icon-btn" data-edit="'+c.id+'" title="Редактировать">✎</button><button class="icon-btn" data-delete="'+c.id+'" title="Удалить">×</button></div></td></tr>';
  }).join('') || '<tr><td colspan="6" class="empty">Нет компаний по выбранным условиям</td></tr>';
}
async function load() {
  try { companies=await request('/api/companies?'+new URLSearchParams(filters())); render(); }
  catch(e) { $('companyRows').innerHTML='<tr><td colspan="6" class="empty">'+esc(e.message)+'</td></tr>'; }
}
function openForm(company) {
  $('companyForm').reset(); $('formError').textContent='';
  $('companyId').value=company?.id||'';
  $('dialogTitle').textContent=company?'Редактировать компанию':'Новая компания';
  fields.forEach(f=>$(f).value=company?.[f]??(f==='category'?'Автосервис':f==='status'?'Новый':''));
  $('companyDialog').showModal();
}
function closeForm() { $('companyDialog').close(); }
$('addBtn').onclick=()=>openForm(); $('emptyAdd').onclick=()=>openForm();
$('closeDialog').onclick=closeForm; $('cancelDialog').onclick=closeForm; $('refreshBtn').onclick=load;
$('companyForm').onsubmit=async e=>{
  e.preventDefault(); $('formError').textContent='';
  const data=Object.fromEntries(fields.map(f=>[f,$(f).value.trim()]));
  const id=$('companyId').value;
  try { await request(id?'/api/companies/'+id:'/api/companies',{method:id?'PUT':'POST',body:JSON.stringify(data)}); closeForm(); await load(); }
  catch(err){$('formError').textContent=err.message;}
};
$('companyRows').onclick=async e=>{
  const edit=e.target.closest('[data-edit]'); const del=e.target.closest('[data-delete]');
  if(edit){const company=companies.find(c=>String(c.id)===edit.dataset.edit);if(company)openForm(company);}
  if(del){const c=companies.find(x=>String(x.id)===del.dataset.delete);if(c&&confirm('Удалить компанию «'+c.name+'»?')){try{await request('/api/companies/'+c.id,{method:'DELETE'});await load();}catch(err){alert(err.message);}}}
};
['search','countryFilter','cityFilter','categoryFilter','statusFilter'].forEach(id=>{
  $(id).addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(load,250);});
  $(id).addEventListener('change',load);
});
load();