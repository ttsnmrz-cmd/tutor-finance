/* Native ProfiProfit lesson-linked Live Notes.
 * Mirrors Classroom calendar_live_notes (teacher_id,lesson_id,title,plain,html).
 * No test-note migration. Avoids touching financial lessons/payments.
 */
let nativeLiveNotesState={studentId:null,lessonId:null,teacherId:null,dirty:false,saveTimer:null};
function nativeNotesEscape(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
async function renderNativeLessonNotes(student){
  const root=document.getElementById('native-live-notes');
  if(!root||!student)return;
  const lessonsForStudent=studentStats(student).ls.slice().sort((a,b)=>(String(b.date||'')+' '+String(b.time||'')).localeCompare(String(a.date||'')+' '+String(a.time||'')));
  if(!lessonsForStudent.length){root.innerHTML='<p class="native-history-empty">Нет занятий для заметок.</p>';return;}
  const today=localISO(new Date());
  const latestCompleted=lessonsForStudent.find(l=>String(l.date||'')<=today&&['conducted','completed','cancelled_charge','cancelled_free'].includes(String(l.status||'').toLowerCase()));
  const choices=lessonsForStudent.map(l=>'<option value="'+nativeNotesEscape(l.id)+'">'+nativeNotesEscape(l.date+' · '+(l.time||'')+' · '+(l.comment||'Lesson'))+'</option>').join('');
  root.innerHTML='<div class="native-notes-toolbar"><label for="native-note-lesson">Lesson</label><select id="native-note-lesson">'+choices+'</select><span id="native-note-status" role="status"></span></div><label class="native-note-label" for="native-note-editor">Live Notes</label><textarea id="native-note-editor" rows="12" placeholder="Write lesson notes here…"></textarea><div class="native-notes-footer"><span>Notes are linked to the selected lesson.</span><button type="button" id="native-note-save">Save notes</button></div>';
  const select=root.querySelector('#native-note-lesson'),editor=root.querySelector('#native-note-editor'),status=root.querySelector('#native-note-status');
  if(latestCompleted)select.value=String(latestCompleted.id);
  nativeLiveNotesState.studentId=String(student.id);
  const user=await supabaseClient.auth.getUser();
  if(!user.data?.user){status.textContent='Sign in to save notes';editor.disabled=true;return;}
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
    const title=student.name+' · '+(lessonsForStudent.find(l=>String(l.id)===lessonId)?.date||'Lesson');
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
