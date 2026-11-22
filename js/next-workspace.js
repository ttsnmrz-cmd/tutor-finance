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
    supabaseClient.from('learning_materials').select('id,title,folder_id,updated_at,body,revision').eq('teacher_id',teacherId).order('updated_at',{ascending:false})
   ]);
   if(current!==request)return;
   if(folders.error||materials.error)throw Error('Учебная библиотека ещё не подключена к базе ProfiProfit. Нужны миграции learning_folders и learning_materials.');
   const fs=folders.data||[],ms=materials.data||[];
   const host=library();
   const wrapper=document.createElement('div');
   wrapper.className='next-materials-browser';
   const nav=document.createElement('nav');
   nav.className='next-materials-folders';
   const main=document.createElement('div');
   main.className='next-materials-content';
   wrapper.append(nav,main);
   host.replaceChildren(wrapper);
   let selected=null;
   const makeButton=(label,action)=>{
    const button=document.createElement('button');
    button.type='button';button.textContent=label;button.addEventListener('click',action);
    return button;
   };
   function draw(){
    nav.replaceChildren();
    nav.append(makeButton('⌂ My Materials',()=>{selected=null;draw();}));
    const visited=new Set();
    function folderTree(parent,depth){
     if(depth>30)return;
     for(const folder of fs.filter(f=>f.parent_id===parent)){
      if(visited.has(folder.id))continue;
      visited.add(folder.id);
      const button=makeButton('📁 '+folder.title,()=>{selected=folder.id;draw();});
      button.style.paddingLeft=(12+depth*14)+'px';
      button.setAttribute('aria-current',selected===folder.id?'page':'false');
      nav.append(button);
      folderTree(folder.id,depth+1);
     }
    }
    folderTree(null,0);
    const active=fs.find(f=>f.id===selected);
    const title=document.createElement('h2');title.textContent=active?.title||'My Materials';
    const actions=document.createElement('div');actions.className='next-materials-actions';
    actions.append(makeButton('+ New Folder',async()=>{
     const name=prompt('Название папки');if(!name?.trim())return;
     const result=await supabaseClient.rpc('learning_folder_action',{p_action:'create',p_id:null,p_title:name.trim(),p_parent:selected});
     if(result.error){status().textContent=result.error.message;return;}
     await loadMaterials();
    }),makeButton('+ New Material',async()=>{
     const name=prompt('Название материала');if(!name?.trim())return;
     const body={title:name.trim(),blocks:[]};
     const result=await supabaseClient.rpc('learning_save_material',{p_id:null,p_title:name.trim(),p_body:body,p_revision:null,p_folder_id:selected});
     if(result.error){status().textContent=result.error.message;return;}
     await loadMaterials();
    }));
    main.replaceChildren(title,actions);
    const list=document.createElement('div');list.className='next-materials-list';
    for(const folder of fs.filter(f=>f.parent_id===selected)){
     list.append(makeButton('📁 '+folder.title,()=>{selected=folder.id;draw();}));
    }
    for(const material of ms.filter(m=>m.folder_id===selected)){
     list.append(makeButton('📄 '+material.title,()=>{
      const panel=document.createElement('section');
      panel.className='next-materials-detail';
      const heading=document.createElement('h3');heading.textContent=material.title;
      const note=document.createElement('p');note.textContent='Материал доступен для просмотра. Полный интерактивный конструктор ещё переносится.';
      const summary=document.createElement('p');summary.textContent='Упражнений: '+(Array.isArray(material.body?.blocks)?material.body.blocks.length:0);
      panel.append(heading,summary,note,makeButton('← Back',draw));
      main.replaceChildren(panel);
     }));
    }
    main.append(list);
    if(!list.childElementCount){const empty=document.createElement('p');empty.textContent='Папка пуста.';main.append(empty);}
   }
   draw();
   status().textContent=fs.length+' папок · '+ms.length+' материалов';
  
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
