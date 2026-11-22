/* Unified workspace preview: one origin, one ProfiProfit Supabase session.
 * Read-only materials list until finance learning migrations are deployed.
 */
(function(){
 'use strict';
 if(!document.documentElement.classList.contains('next-ui-preview'))return;
 const panel=()=>document.getElementById('next-classroom-panel');
 const app=()=>document.querySelector('#teacher-app>.max-w-5xl');
 const status=()=>document.getElementById('next-classroom-status');
 const library=()=>document.getElementById('next-classroom-library');
 const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 let request=0;
 async function loadMaterials(){
  const current=++request;
  status().textContent='Загружаем материалы…';
  library().replaceChildren();
  try{
   if(typeof supabaseClient==='undefined')throw Error('ProfiProfit ещё не загрузился.');
   const auth=await supabaseClient.auth.getUser();
   if(auth.error||!auth.data.user)throw Error('Войдите в ProfiProfit.');
   const teacherId=auth.data.user.id;
   const [folders,materials]=await Promise.all([
    supabaseClient.from('learning_folders').select('id,title,parent_id,position').eq('teacher_id',teacherId).order('position'),
    supabaseClient.from('learning_materials').select('id,title,folder_id,updated_at').eq('teacher_id',teacherId).order('updated_at',{ascending:false})
   ]);
   if(current!==request)return;
   if(folders.error||materials.error)throw Error('Учебная библиотека ещё не подключена к базе ProfiProfit. Нужны миграции learning_folders и learning_materials.');
   const fs=folders.data||[],ms=materials.data||[];
   const seen=new Set();
   function render(parent,depth){
    if(depth>30)return '';
    let html='';
    for(const folder of fs.filter(f=>f.parent_id===parent)){
     if(seen.has(folder.id))continue;
     seen.add(folder.id);
     html+='<li><strong>📁 '+escapeHtml(folder.title)+'</strong><ul>'+render(folder.id,depth+1)+'</ul></li>';
    }
    for(const material of ms.filter(m=>m.folder_id===parent)){
     html+='<li>📄 '+escapeHtml(material.title)+'</li>';
    }
    return html;
   }
   library().innerHTML='<ul class="next-materials-tree">'+render(null,0)+'</ul>';
   status().textContent=fs.length+' папок · '+ms.length+' материалов';
   if(!fs.length&&!ms.length)status().textContent+=' — библиотека пока пустая.';
  }catch(error){if(current===request)status().textContent=error.message||'Не удалось загрузить библиотеку.';}
 }
 function showClassroom(){
  const host=panel(),workspace=app();
  if(!host||!workspace)return;
  host.hidden=false;workspace.hidden=true;
  document.documentElement.classList.add('next-classroom-active');
  document.querySelector('.next-side-classroom')?.setAttribute('aria-current','page');
  void loadMaterials();
 }
 function showFinance(){
  request++;
  const host=panel(),workspace=app();
  if(host)host.hidden=true;
  if(workspace)workspace.hidden=false;
  document.documentElement.classList.remove('next-classroom-active');
  document.querySelector('.next-side-classroom')?.removeAttribute('aria-current');
 }
 window.nextOpenClassroom=showClassroom;
 window.nextCloseClassroom=showFinance;
 document.addEventListener('click',event=>{
  if(event.target.closest('#next-workspace-sidebar .next-sidebar-nav button:not(.next-side-classroom)'))showFinance();
 });
 const oldSwitch=window.switchTab;
 if(typeof oldSwitch==='function')window.switchTab=function(...args){
  showFinance();return oldSwitch.apply(this,args);
 };
})();
