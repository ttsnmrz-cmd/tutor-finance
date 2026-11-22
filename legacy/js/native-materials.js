/* ProfiProfit native materials library: Classroom sections and lesson plans.
   Uses the production schema; no Classroom test data is copied. */
let nativeMaterialStore={folders:[],materials:[],selected:null,activeFolder:null};
function nativeMaterialText(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function nativeMaterialContent(value,depth=0){
 if(depth>7||value==null)return '';
 if(typeof value==='string'||typeof value==='number')return '<p class="native-material-paragraph">'+nativeMaterialText(value)+'</p>';
 if(Array.isArray(value))return value.map(v=>'<div class="native-material-piece">'+nativeMaterialContent(v,depth+1)+'</div>').join('');
 if(typeof value!=='object')return '';
 const title=value.title||value.heading||value.name||value.label||value.type||'';
 const parts=Object.entries(value).filter(([k])=>!['id','title','heading','name','label','type','revision','created_at','updated_at','teacher_id','folder_id','metadata'].includes(k));
 return '<section class="native-material-piece">'+(title?'<h4>'+nativeMaterialText(title)+'</h4>':'')+parts.map(([k,v])=>{
  if(v==null||v===''||typeof v==='boolean')return '';
  if(['content','text','body','instructions','description','prompt','question','answer','options','items','sections','stages','exercises','blocks','pages','questions'].includes(k))return nativeMaterialContent(v,depth+1);
  if(typeof v==='object')return '<div class="native-material-field"><span>'+nativeMaterialText(k)+'</span>'+nativeMaterialContent(v,depth+1)+'</div>';
  return '<div class="native-material-field"><span>'+nativeMaterialText(k)+'</span><p>'+nativeMaterialText(v)+'</p></div>';
 }).join('')+'</section>';
}
function nativeMaterialSelect(id){
 nativeMaterialStore.selected=id;
 const material=nativeMaterialStore.materials.find(m=>String(m.id)===String(id));
 const preview=document.getElementById('native-material-preview');
 if(!preview)return;
 if(!material){preview.innerHTML='<div class="native-material-placeholder">Выберите материал слева, чтобы посмотреть содержимое.</div>';return;}
 let body=material.body;
 if(typeof body==='string'){try{body=JSON.parse(body)}catch{}}
 preview.innerHTML='<div class="native-material-preview-heading"><div class="native-eyebrow">TEACHER PREVIEW</div><h2>'+nativeMaterialText(material.title)+'</h2><p>Просмотр материала · изменения не сохраняются</p></div><div class="native-material-preview-body">'+(nativeMaterialContent(body)||'<p>Материал пока пустой.</p>')+'</div>';
 document.querySelectorAll('[data-native-material-id]').forEach(el=>el.classList.toggle('is-selected',el.dataset.nativeMaterialId===String(id)));
}
async function loadNativeMaterials(){
 const status=document.getElementById('materials-status'),host=document.getElementById('materials-library');
 if(!status||!host)return;
 status.textContent='Загружаем материалы…';host.replaceChildren();
 try{
  const auth=await supabaseClient.auth.getUser();
  if(auth.error||!auth.data.user)throw Error('Войдите в ProfiProfit.');
  const teacher=auth.data.user.id;
  const [folders,materials]=await Promise.all([
   supabaseClient.from('material_sections').select('id,title,parent_id,position').eq('teacher_id',teacher).order('position'),
   supabaseClient.from('teaching_lesson_plans').select('id,section_id,revision,updated_at,body').eq('teacher_id',teacher).order('updated_at',{ascending:false})
  ]);
  if(folders.error)throw Error(folders.error.message);
  if(materials.error)throw Error(materials.error.message);
  const createFolder=document.createElement('button');
  createFolder.type='button';
  createFolder.className='native-material-row';
  createFolder.textContent='＋ Создать папку';
  createFolder.addEventListener('click',async()=>{
    const title=window.prompt('Название папки');
    if(!title||!title.trim())return;
    createFolder.disabled=true;
    const result=await supabaseClient.from('material_sections').insert({
      teacher_id:teacher,title:title.trim(),parent_id:nativeMaterialStore.activeFolder,position:0
    });
    if(result.error){window.alert('Could not create folder: '+result.error.message);createFolder.disabled=false;return;}
    await loadNativeMaterials();
  });
  host.append(createFolder);
  const fs=folders.data||[],ms=(materials.data||[]).map(m=>({...m,folder_id:m.section_id,title:(m.body&&typeof m.body==='object'&&(m.body.title||m.body.name))||'Untitled lesson'}));
  nativeMaterialStore.folders=fs;nativeMaterialStore.materials=ms;
  const addRow=(m,container,depth)=>{
   const row=document.createElement('button');row.type='button';row.className='native-material-row';
   row.dataset.nativeMaterialId=String(m.id);row.style.paddingLeft=(12+depth*12)+'px';
   row.textContent='📄 '+m.title;row.addEventListener('click',()=>nativeMaterialSelect(m.id));container.append(row);
  };
  const seen=new Set(),rendered=new Set();
  const render=(parent,depth,container)=>{
   if(depth>25)return;
   fs.filter(f=>String(f.parent_id??'')===String(parent??'')).forEach(f=>{
    if(seen.has(String(f.id)))return;
    seen.add(String(f.id));
    const section=document.createElement('div');section.className='native-material-folder';
    const label=document.createElement('button');label.type='button';
    label.className='native-material-folder-title native-material-row';
    label.style.paddingLeft=(12+depth*12)+'px';
    label.textContent='📁 '+f.title;
    const children=document.createElement('div');
    children.hidden=true;
    label.setAttribute('aria-expanded','false');
    label.addEventListener('click',()=>{
      children.hidden=!children.hidden;
      label.setAttribute('aria-expanded',String(!children.hidden));
      nativeMaterialStore.activeFolder=children.hidden?null:f.id;
      createFolder.textContent=children.hidden?'＋ Создать папку':'＋ Создать подпапку в «'+f.title+'»';
    });
    section.append(label,children);container.append(section);
    render(f.id,depth+1,children);
   });
   ms.filter(m=>String(m.folder_id??'')===String(parent??'')).forEach(m=>{
    rendered.add(String(m.id));addRow(m,container,depth);
   });
  };
  nativeMaterialStore.activeFolder=null;
  render(null,0,host);
  ms.filter(m=>!rendered.has(String(m.id))).forEach(m=>addRow(m,host,0));
  status.textContent=fs.length+' папок · '+ms.length+' материалов';
  if(!ms.length)status.textContent+=' — библиотека пока пустая.';
  if(ms.length)nativeMaterialSelect(ms.some(m=>String(m.id)===String(nativeMaterialStore.selected))?nativeMaterialStore.selected:ms[0].id);
 }catch(error){status.textContent='Ошибка загрузки: '+(error?.message||'Не удалось загрузить библиотеку.');}
}
