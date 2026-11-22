/* ProfiProfit native materials library: Classroom sections and lesson plans.
   Uses the production schema; no Classroom test data is copied. */
let nativeMaterialStore={folders:[],materials:[],selected:null};
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
  const fs=folders.data||[],ms=(materials.data||[]).map(m=>({...m,folder_id:m.section_id,title:(m.body&&typeof m.body==='object'&&(m.body.title||m.body.name))||'Untitled lesson'}));
  nativeMaterialStore.folders=fs;nativeMaterialStore.materials=ms;
  const seen=new Set();
  const render=(parent,depth)=>{
   if(depth>25)return;
   fs.filter(f=>String(f.parent_id??'')===String(parent??'')).forEach(f=>{
    if(seen.has(String(f.id)))return;seen.add(String(f.id));
    const section=document.createElement('div');section.className='native-material-folder';
    section.style.setProperty('--folder-depth',String(depth));
    const label=document.createElement('div');label.className='native-material-folder-title';label.textContent='▾  '+f.title;
    section.append(label);host.append(section);
    const children=document.createElement('div');section.append(children);
    fs.filter(x=>String(x.parent_id)===String(f.id)).forEach(x=>{const row=document.createElement('div');row.className='native-material-subfolder';row.textContent='📁 '+x.title;children.append(row);});
    ms.filter(x=>String(x.folder_id)===String(f.id)).forEach(x=>addRow(x,children,depth+1));
   });
   ms.filter(x=>String(x.folder_id??'')===String(parent??'')).forEach(x=>addRow(x,host,depth));
  };
  const addRow=(m,container,depth)=>{
   const row=document.createElement('button');row.type='button';row.className='native-material-row';row.dataset.nativeMaterialId=String(m.id);row.style.paddingLeft=(12+depth*12)+'px';row.textContent='📄 '+m.title;row.addEventListener('click',()=>nativeMaterialSelect(m.id));container.append(row);
  };
  render(null,0);
  // Include nested-folder materials even if their folder is not at the root.
  const rendered=new Set([...host.querySelectorAll('[data-native-material-id]')].map(el=>el.dataset.nativeMaterialId));
  ms.filter(m=>!rendered.has(String(m.id))).forEach(m=>addRow(m,host,0));
  status.textContent=fs.length+' папок · '+ms.length+' материалов';
  if(!ms.length)status.textContent+=' — библиотека пока пустая.';
  if(ms.length)nativeMaterialSelect(ms.some(m=>String(m.id)===String(nativeMaterialStore.selected))?nativeMaterialStore.selected:ms[0].id);
 }catch(error){status.textContent='Ошибка загрузки: '+(error?.message||'Не удалось загрузить библиотеку.');}
}
