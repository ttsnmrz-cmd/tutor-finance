/* Native ProfiProfit lesson-linked Live Notes.
 * Mirrors Classroom calendar_live_notes (teacher_id,lesson_id,title,plain,html).
 * No test-note migration. Avoids touching financial lessons/payments.
 */
let nativeLiveNotesState={studentId:null,lessonId:null,teacherId:null,dirty:false,saveTimer:null};
function nativeNotesEscape(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
async function renderNativeLessonNotes(student){
  const root=document.getElementById('native-live-notes');
  if(!root||!student)return;
  const now=new Date(),today=localISO(now),clock=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  const past=studentStats(student).ls.filter(l=>l.date&&(String(l.date)<today||(String(l.date)===today&&String(l.time||'00:00').slice(0,5)<=clock)));
  root.textContent='Loading notes…';
  const user=await supabaseClient.auth.getUser();
  if(!root.isConnected)return;
  if(!user.data?.user){root.textContent='Sign in to view notes';return;}
  const ids=new Map();
  for(let i=0;i<past.length;i+=100){const result=await supabaseClient.from('calendar_live_notes').select('lesson_id,plain,title').eq('teacher_id',user.data.user.id).in('lesson_id',past.slice(i,i+100).map(l=>l.id));if(!root.isConnected)return;if(result.error){root.textContent='Could not load notes';return;}for(const row of result.data||[])if(String(row.plain||'').trim())ids.set(String(row.lesson_id),row);}
  const lessonsForStudent=past.sort((a,b)=>(String(b.date||'')+' '+String(b.time||'')).localeCompare(String(a.date||'')+' '+String(a.time||'')));
  if(!lessonsForStudent.length){root.innerHTML='<p class="native-history-empty">No past lessons.</p>';return;}
  const choices=lessonsForStudent.map(l=>'<option value="'+nativeNotesEscape(l.id)+'">'+nativeNotesEscape(historyDateLabel(l.date))+'</option>').join('');
  root.innerHTML='<div class="native-notes-toolbar"><label for="native-note-lesson">Lesson</label><select id="native-note-lesson">'+choices+'</select><span id="native-note-status" role="status"></span></div><label class="native-note-label" for="native-note-editor">Live Notes</label><textarea id="native-note-editor" rows="12" placeholder="Write lesson notes here…"></textarea><div class="native-notes-footer"><span>Notes are linked to the selected lesson.</span><button type="button" id="native-note-save">Save notes</button></div>';
  const select=root.querySelector('#native-note-lesson'),editor=root.querySelector('#native-note-editor'),status=root.querySelector('#native-note-status');
  const layout=document.createElement('div');layout.className='pp-history-split';
  for(const title of ['Lessons','Notes']){const col=document.createElement('section'),heading=document.createElement('h3'),list=document.createElement('div');heading.textContent=title;list.className='pp-history-list';col.append(heading,list);layout.append(col);
    for(const l of lessonsForStudent){const note=ids.get(String(l.id));if(title==='Notes'&&!note)continue;const button=document.createElement('button');button.type='button';button.className='pp-student-lesson-row';button.textContent=historyDateLabel(l.date)+(title==='Lessons'&&note?' ▤':'');if(title==='Notes'){if(historyMaterialTitle(note.title)){const heading=document.createElement('strong');heading.className='pp-note-title';heading.textContent=historyMaterialTitle(note.title);button.prepend(heading);}const excerpt=document.createElement('small');excerpt.textContent=String(note.plain).slice(0,140);button.append(excerpt);}button.onclick=()=>{select.value=String(l.id);select.dispatchEvent(new Event('change'));};list.append(button);}
    if(!list.children.length)list.textContent='No notes yet.';
  }root.prepend(layout);
  nativeLiveNotesState.studentId=String(student.id);
  nativeLiveNotesState.teacherId=user.data.user.id;
  async function load(){
    if(nativeLiveNotesState.saveTimer){clearTimeout(nativeLiveNotesState.saveTimer);nativeLiveNotesState.saveTimer=null;}
    const lessonId=select.value;
    nativeLiveNotesState.lessonId=lessonId;nativeLiveNotesState.dirty=false;
    editor.value='';editor.disabled=true;status.textContent='Loading…';
    const response=await supabaseClient.from('calendar_live_notes').select('plain').eq('teacher_id',nativeLiveNotesState.teacherId).eq('lesson_id',lessonId).maybeSingle();
    if(nativeLiveNotesState.lessonId!==lessonId||!root.isConnected)return;
    if(response.error){status.textContent='Could not load notes';return;}
    editor.value=response.data?.plain||'';editor.disabled=false;status.textContent='Ready';
  }
  async function save(){
    const lessonId=nativeLiveNotesState.lessonId,teacherId=nativeLiveNotesState.teacherId;
    if(!lessonId||!teacherId||editor.disabled)return;
    const plain=editor.value;
    if(!plain.trim()){status.textContent='Empty notes are not saved';nativeLiveNotesState.dirty=false;return;}
    status.textContent='Saving…';
    const title=ids.get(String(lessonId))?.title||'Live Notes';
    const response=await supabaseClient.from('calendar_live_notes').upsert({teacher_id:teacherId,lesson_id:lessonId,title,plain,html:nativeNotesEscape(plain).replace(/\n/g,'<br>'),updated_at:new Date().toISOString()},{onConflict:'teacher_id,lesson_id'});
    if(nativeLiveNotesState.lessonId!==lessonId||!root.isConnected)return;
    status.textContent=response.error?'Save failed: '+response.error.message:'Saved';
    nativeLiveNotesState.dirty=!!response.error;
  }
  select.addEventListener('change',async()=>{if(nativeLiveNotesState.dirty)await save();await load();});
  editor.addEventListener('input',()=>{nativeLiveNotesState.dirty=true;status.textContent='Unsaved';if(nativeLiveNotesState.saveTimer)clearTimeout(nativeLiveNotesState.saveTimer);nativeLiveNotesState.saveTimer=setTimeout(save,900);});
  root.querySelector('#native-note-save').addEventListener('click',save);
  await load();
}
