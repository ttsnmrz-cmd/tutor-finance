/* Calendar → live session foundation. No finance mutations. */
(function(){
'use strict';
const button=()=>document.getElementById('calendar-live-open');
const modal=()=>document.getElementById('calendar-live-picker');
let pending=false;
function sync(){const id=document.getElementById('edit-id')?.value;button()?.classList.toggle('hidden',!id);}
const oldEdit=window.openEditLesson;
if(typeof oldEdit==='function')window.openEditLesson=function(...args){const result=oldEdit.apply(this,args);sync();return result;};
const oldNew=window.openNewLesson;
if(typeof oldNew==='function')window.openNewLesson=function(...args){const result=oldNew.apply(this,args);sync();return result;};
window.closeCalendarLivePicker=function(){if(!pending)modal()?.classList.add('hidden');};
window.openCalendarLivePicker=async function(){
 const id=document.getElementById('edit-id')?.value;
 if(!id||pending)return;
 const picker=modal(),select=document.getElementById('calendar-live-material'),status=document.getElementById('calendar-live-status');
 if(!picker||!select||!status)return;
 picker.classList.remove('hidden');status.textContent='Загружаем материалы…';select.replaceChildren();
 try{
  const {data:{user},error:authError}=await supabaseClient.auth.getUser();
  if(authError||!user)throw Error('Войдите в аккаунт преподавателя.');
  const [session,plans,versions]=await Promise.all([
   supabaseClient.from('live_sessions').select('id,material_plan_id,material_version_id').eq('calendar_lesson_id',id).maybeSingle(),
   supabaseClient.from('teaching_lesson_plans').select('id,body').eq('teacher_id',user.id),
   supabaseClient.from('teaching_lesson_versions').select('id,plan_id,published_at').eq('teacher_id',user.id).order('published_at',{ascending:false})
  ]);
  for(const r of [session,plans,versions])if(r.error)throw r.error;
  const existing=session.data;
  select.append(new Option('Без материала (выбрать позже)',''));
  const latest=new Map();
  for(const v of versions.data||[])if(!latest.has(v.plan_id))latest.set(v.plan_id,v.id);
  for(const p of plans.data||[])select.append(new Option((p.body?.title||'Без названия')+(latest.has(p.id)?'':' · черновик'),p.id));
  select.value=existing?.material_plan_id||'';
  select.disabled=!!existing?.material_plan_id;
  document.getElementById('calendar-live-confirm').disabled=false;
  status.textContent=existing?'Сессия уже создана. Повторное открытие сохранит её материал.':'Выберите материал для занятия. Можно продолжить без материала.';
  picker.dataset.versions=JSON.stringify(Object.fromEntries(latest));
 }catch(e){status.textContent='Ошибка: '+(e.message||e);document.getElementById('calendar-live-confirm').disabled=true;}
};
window.confirmCalendarLiveSession=async function(){
 if(pending)return;
 const id=document.getElementById('edit-id')?.value;
 const picker=modal(),select=document.getElementById('calendar-live-material'),status=document.getElementById('calendar-live-status'),confirm=document.getElementById('calendar-live-confirm');
 if(!id||!picker)return;
 pending=true;confirm.disabled=true;status.textContent='Создаём или открываем сессию…';
 try{
  const plan=select.value||null,versions=JSON.parse(picker.dataset.versions||'{}');
  const {data,error}=await supabaseClient.rpc('open_calendar_live_session',{p_calendar_lesson_id:Number(id),p_material_plan_id:plan,p_material_version_id:plan?(versions[plan]||null):null});
  if(error)throw error;
  picker.classList.add('hidden');
  const notice='Сессия занятия готова (ID: '+data+'). Подключение Live Workspace — следующий этап.';
  window.alert(notice);
 }catch(e){status.textContent='Не удалось открыть сессию: '+(e.message||e);}
 finally{pending=false;confirm.disabled=false;}
};
sync();
})();
