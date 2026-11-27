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
  for(let i=0;i<past.length;i+=100){const result=await supabaseClient.from('calendar_live_notes').select('lesson_id,plain,html,title').eq('teacher_id',user.data.user.id).in('lesson_id',past.slice(i,i+100).map(l=>l.id));if(!root.isConnected)return;if(result.error){root.textContent='Could not load notes';return;}for(const row of result.data||[])if(String(row.plain||'').trim())ids.set(String(row.lesson_id),row);}
  const lessonsForStudent=past.filter(l=>ids.has(String(l.id))).sort((a,b)=>(String(b.date||'')+' '+String(b.time||'')).localeCompare(String(a.date||'')+' '+String(a.time||'')));
  if(!lessonsForStudent.length){root.textContent=document.documentElement.lang==='ru'?'Пока нет заметок к занятиям.':'No lesson notes yet.';return;}
  root.replaceChildren();
  const layout=document.createElement('div');layout.className='pp-history-split';
  const ru=document.documentElement.lang==='ru';
  const buttons=new Map();
  const makeColumn=title=>{const col=document.createElement('section'),heading=document.createElement('h3'),list=document.createElement('div');heading.textContent=title;list.className='pp-history-list';col.append(heading,list);layout.append(col);return list;};
  const lessons=makeColumn(ru?'Занятия':'Lessons'),details=makeColumn(ru?'Заметки':'Notes');
  const show=l=>{
    const note=ids.get(String(l.id));
    for(const [id,button] of buttons){const active=id===String(l.id);button.setAttribute('aria-pressed',String(active));button.style.background=active?'rgba(112,80,158,.20)':'';button.style.borderColor=active?'#896DB0':'';}
    const card=document.createElement('button');card.type='button';card.className='pp-student-lesson-row';
    const title=document.createElement('strong');title.className='pp-note-title';title.textContent=historyMaterialTitle(note.title)||(ru?'Заметки урока':'Lesson notes');
    const excerpt=document.createElement('small');excerpt.textContent=String(note.plain||'').trim().split(/\r?\n/)[0];excerpt.style.cssText='display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%';
    card.style.minWidth='0';card.append(title,excerpt);details.replaceChildren(card);
    card.onclick=()=>{const dialog=document.createElement('dialog');dialog.className='app-card';dialog.style.cssText='width:min(640px,92vw);max-height:80dvh;overflow:auto;box-sizing:border-box';const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label',ru?'Закрыть':'Close');close.style.cssText='float:right';close.onclick=()=>dialog.close();const h=document.createElement('h3');h.textContent=title.textContent;const body=document.createElement('div');body.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';renderSharedLessonNotes(body,note);const copy=ppNotesCopyButton(body);copy.style.marginInlineEnd='8px';dialog.append(close,h,copy,body);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();};
  };
  for(const l of lessonsForStudent){const button=document.createElement('button');button.type='button';button.className='pp-student-lesson-row';button.textContent=historyDateLabel(l.date)+' ▤';button.onclick=()=>show(l);buttons.set(String(l.id),button);lessons.append(button);}
  show(lessonsForStudent[0]);
  root.append(layout);
}
