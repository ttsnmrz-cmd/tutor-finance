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
  const lessonsForStudent=past.filter(l=>ids.has(String(l.id))).sort((a,b)=>(String(b.date||'')+' '+String(b.time||'')).localeCompare(String(a.date||'')+' '+String(a.time||'')));
  if(!lessonsForStudent.length){root.textContent=document.documentElement.lang==='ru'?'Пока нет заметок к занятиям.':'No lesson notes yet.';return;}
  root.replaceChildren();
  const layout=document.createElement('div');layout.className='pp-history-split';
  const ru=document.documentElement.lang==='ru';
  const details=document.createElement('div');details.style.whiteSpace='pre-wrap';details.style.overflowWrap='anywhere';
  details.textContent=ru?'Выберите занятие':'Select a lesson';
  const show=l=>{const note=ids.get(String(l.id));details.textContent=note?.plain||(ru?'Нет заметок':'No notes yet.');};
  for(const title of ['Lessons','Notes']){
    const col=document.createElement('section'),heading=document.createElement('h3'),list=document.createElement('div');
    heading.textContent=ru?(title==='Lessons'?'Занятия':'Заметки'):title;list.className='pp-history-list';col.append(heading,list);layout.append(col);
    for(const l of lessonsForStudent){const note=ids.get(String(l.id));if(title==='Notes'&&!note)continue;const button=document.createElement('button');button.type='button';button.className='pp-student-lesson-row';button.textContent=historyDateLabel(l.date)+(title==='Lessons'&&note?' ▤':'');if(title==='Notes'&&historyMaterialTitle(note.title)){const h=document.createElement('strong');h.className='pp-note-title';h.textContent=historyMaterialTitle(note.title);button.prepend(h);}button.onclick=()=>show(l);list.append(button);}
    if(title==='Notes'){col.append(details);show(lessonsForStudent.find(l=>ids.has(String(l.id)))||lessonsForStudent[0]);}
  }
  root.append(layout);
}
