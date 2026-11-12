function lessonMembersFor(l){
  return lessonMembers.filter(
    m=>String(m.lesson_id)===String(l.id)
  );
}

function studentsForLesson(l){
  return lessonMembersFor(l)
    .map(m=>students.find(
      s=>String(s.id)===String(m.student_id)
    ))
    .filter(Boolean);
}

function lessonTitle(l){
  if(l.group_id){
    const g=groups.find(
      x=>String(x.id)===String(l.group_id)
    );

    const names=studentsForLesson(l)
      .map(s=>s.name);

    return g
      ?g.name+(names.length?' ('+names.join(', ')+')':'')
      :names.join(', ');
  }

  return l.student;
}

function lessonPriceTotal(l){
  if(l.group_id){
    const members=lessonMembersFor(l);

    if(members.length){
      return members.reduce(
        (a,m)=>{
          if(m.charged===false){
            return a;
          }

          return a+
            Number(
              m.price??
              students.find(
                s=>String(s.id)===String(m.student_id)
              )?.price??
              0
            );
        },
        0
      );
    }

    return students
      .filter(
        s=>
          !s.archived&&
          String(s.group_id)===String(l.group_id)
      )
      .reduce(
        (a,s)=>a+Number(s.price??0),
        0
      );
  }

  return Number(l.price||0);
}
let lessonDatePickerMonth=null;
function lessonDateParts(v){const [y,m,d]=String(v||'').split('-').map(Number);return {y,m,d};}
function lessonDateISO(y,m,d){return String(y).padStart(4,'0')+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');}
function lessonDateLocale(){return window.getLanguage?.()==='en'?'en-US':'ru-RU';}
function setLessonDate(v){const input=document.getElementById('edit-date');if(!input)return;input.value=v||'';const p=lessonDateParts(input.value),label=document.getElementById('lesson-date-label');if(label)label.textContent=p.y&&p.m&&p.d?new Date(p.y,p.m-1,p.d).toLocaleDateString(lessonDateLocale(),{day:'numeric',month:'long',year:'numeric'}):(window.getLanguage?.()==='en'?'Choose a date':'Выберите дату');if(input.value)lessonDatePickerMonth=new Date(p.y,p.m-1,1);renderLessonDatePicker();}
function toggleLessonDatePicker(){const box=document.getElementById('lesson-date-picker');if(!box)return;if(box.classList.contains('hidden')){const p=lessonDateParts(document.getElementById('edit-date').value);if(!lessonDatePickerMonth)lessonDatePickerMonth=new Date(p.y||new Date().getFullYear(),(p.m||new Date().getMonth()+1)-1,1);renderLessonDatePicker();box.classList.remove('hidden');}else box.classList.add('hidden');}
function closeLessonDatePicker(){document.getElementById('lesson-date-picker')?.classList.add('hidden');}
function changeLessonDateMonth(n){if(!lessonDatePickerMonth)lessonDatePickerMonth=new Date();lessonDatePickerMonth.setMonth(lessonDatePickerMonth.getMonth()+n);renderLessonDatePicker();}
function chooseLessonDate(v){setLessonDate(v);closeLessonDatePicker();}
function selectLessonDateToday(){const n=new Date();chooseLessonDate(lessonDateISO(n.getFullYear(),n.getMonth()+1,n.getDate()));}
function renderLessonDatePicker(){const me=document.getElementById('lesson-date-month'),de=document.getElementById('lesson-date-days'),we=document.getElementById('lesson-date-weekdays');if(!me||!de||!we||!lessonDatePickerMonth)return;const lang=lessonDateLocale(),y=lessonDatePickerMonth.getFullYear(),m=lessonDatePickerMonth.getMonth();me.textContent=lessonDatePickerMonth.toLocaleDateString(lang,{month:'long',year:'numeric'});we.innerHTML=(lang==='en-US'?['Mon','Tue','Wed','Thu','Fri','Sat','Sun']:['Пн','Вт','Ср','Чт','Пт','Сб','Вс']).map(x=>'<span>'+x+'</span>').join('');const off=(new Date(y,m,1).getDay()+6)%7,cnt=new Date(y,m+1,0).getDate(),prev=new Date(y,m,0).getDate(),sel=document.getElementById('edit-date').value,now=new Date();let out='';for(let i=0;i<42;i++){let d,mm,yy,other=false;if(i<off){d=prev-off+i+1;mm=m===0?12:m;yy=m===0?y-1:y;other=true;}else if(i>=off+cnt){d=i-off-cnt+1;mm=m===11?1:m+2;yy=m===11?y+1:y;other=true;}else{d=i-off+1;mm=m+1;yy=y;}const key=lessonDateISO(yy,mm,d),today=yy===now.getFullYear()&&mm===now.getMonth()+1&&d===now.getDate();out+='<button type="button" class="lesson-date-cell'+(other?' is-outside':'')+(key===sel?' is-selected':'')+(today?' is-today':'')+'" onclick="chooseLessonDate(\''+key+'\')">'+d+'</button>';}de.innerHTML=out;document.getElementById('lesson-date-today').textContent=lang==='en-US'?'Today':'Сегодня';document.getElementById('lesson-date-close').textContent=lang==='en-US'?'Done':'Готово';}
function openNewLessonForDate(date){
  fillStudentSelects();

  document
    .getElementById('edit-student')
    ?.removeEventListener(
      'change',
      updateLessonGroupButton
    );

  document
    .getElementById('edit-student')
    ?.addEventListener(
      'change',
      updateLessonGroupButton
    );

  timeOptions();

  document.getElementById('edit-id').value='';
  setLessonDate(date||selectedDate);
  document.getElementById('edit-duration').value='60';

  setTime('11:00');

  document.getElementById('edit-status').innerHTML=
    Object.entries(statusLabels)
      .map(
        ([k,v])=>
          '<option value="'+k+'">'+v+'</option>'
      )
      .join('');

  document.getElementById(
    'edit-status'
  ).value='pending';

  const st=students.find(
    x=>!x.archived
  );

  document.getElementById(
    'edit-student'
  ).value=st?'student:'+st.id:'';

  document.getElementById(
    'edit-price'
  ).value='40';

  document.getElementById(
    'edit-comment'
  ).value='';

  updateLessonGroupButton();

  document.getElementById(
    'recurring-box'
  ).classList.remove('hidden');

  document.getElementById(
    'edit-recurring'
  ).checked=false;

  toggleRecurring();

  document
    .querySelectorAll('.rec-day')
    .forEach(x=>x.checked=false);

  document.getElementById(
    'lesson-modal-title'
  ).textContent='Новое занятие';

  const saveButton=document.getElementById('save-lesson-btn');
  if(saveButton){
    saveButton.onclick=()=>saveLesson('one');
    saveButton.innerHTML='Сохранить';
  }
  closeLessonSaveMenu();

  document.getElementById(
    'lesson-delete-menu'
  )?.classList.add('hidden');

  document.getElementById(
    'lesson-delete-dropdown'
  )?.classList.add('hidden');

  document.getElementById(
    'lesson-group-members'
  )?.classList.add('hidden');

  showModal('lesson-modal');
}
function openEditLesson(id){
  const l=lessons.find(
    x=>String(x.id)===String(id)
  );

  if(!l)return;

  fillStudentSelects();

  document
    .getElementById('edit-student')
    ?.removeEventListener(
      'change',
      updateLessonGroupButton
    );

  document
    .getElementById('edit-student')
    ?.addEventListener(
      'change',
      updateLessonGroupButton
    );

  timeOptions();

  document.getElementById('edit-id').value=l.id;

  const linkedStudent=l.student_id?students.find(x=>String(x.id)===String(l.student_id)):null;
  const legacyMatches=students.filter(x=>x.name===l.student);
  document.getElementById('edit-student').value=
    l.group_id?'group:'+l.group_id:
    linkedStudent?'student:'+linkedStudent.id:
    legacyMatches.length===1?'student:'+legacyMatches[0].id:
    '';

  const displayDateTime=lessonDateTimeInTimezone(l,getTeacherTimezone());
  setLessonDate(displayDateTime.date);

  document.getElementById(
    'edit-duration'
  ).value=String(l.duration||60);

  setTime(displayDateTime.time||'11:00');

  const priceEl=document.getElementById(
    'edit-price'
  );

  priceEl.value=
    String(
      l.group_id
        ?lessonPriceTotal(l)
        :l.price??40
    );

  priceEl.disabled=!!l.group_id;

  const breakdown=document.getElementById(
    'group-price-breakdown'
  );

  if(breakdown){
    if(l.group_id){
      const members=lessonMembersFor(l);

const parts=members.length
  ?members.map(m=>{
      const s=students.find(
        x=>String(x.id)===String(m.student_id)
      );

      return {
        name:s?.name||'',
        price:m.charged===false
          ?0
          :Number(m.price??s?.price??0)
      };
    })
  :students
      .filter(
        s=>
          !s.archived&&
          String(s.group_id)===String(l.group_id)
      )
      .map(s=>({
        name:s.name,
        price:Number(s.price??0)
      }));

const total=parts.reduce(
  (a,b)=>a+b.price,
  0
);
      breakdown.textContent=
        parts.length
          ?parts.map(
            x=>x.name+' '+x.price
          ).join(' + ')+' = '+total+' BYN'
          :'В группе нет учеников';

      breakdown.classList.remove('hidden');
    }else{
      breakdown.classList.add('hidden');
    }
  }

  document.getElementById(
    'edit-status'
  ).innerHTML=
    Object.entries(statusLabels)
      .map(
        ([k,v])=>
          '<option value="'+k+'">'+v+'</option>'
      )
      .join('');

  document.getElementById(
    'edit-status'
  ).value=l.status||'pending';

  document.getElementById(
    'edit-comment'
  ).value=l.comment||'';

  updateLessonGroupButton();

  document.getElementById(
    'recurring-box'
  ).classList.remove('hidden');

  document.getElementById('edit-recurring').checked=false;
  document.querySelectorAll('.rec-day').forEach(x=>x.checked=false);
  toggleRecurring();

  const saveButton=document.getElementById('save-lesson-btn');
  if(saveButton){
    saveButton.onclick=toggleLessonSaveMenu;
    saveButton.innerHTML='Сохранить <span class="ml-1">▾</span>';
  }
  closeLessonSaveMenu();

  document.getElementById(
    'lesson-delete-menu'
  )?.classList.remove('hidden');

  document.getElementById(
    'lesson-delete-dropdown'
  )?.classList.add('hidden');

  document.getElementById(
    'lesson-modal-title'
  ).textContent='Редактировать занятие';

  showModal('lesson-modal');
}
function priceOptions(value){
  return String(value??40);
}

function timeOptions(){
  document.getElementById('edit-hour').innerHTML=
    Array.from(
      {length:17},
      (_,i)=>{
        const h=i+7;

        return `<option value="${String(h).padStart(2,'0')}">${String(h).padStart(2,'0')}</option>`;
      }
    ).join('');

  document.getElementById('edit-minute').innerHTML=
    Array.from(
      {length:12},
      (_,i)=>{
        const m=i*5;

        return `<option value="${String(m).padStart(2,'0')}">${String(m).padStart(2,'0')}</option>`;
      }
    ).join('');
}

function setTime(v){
  let x=String(v||'11:00')
    .replace('.',':')
    .split(':');

  document.getElementById('edit-hour').value=
    String(Number(x[0]||11)).padStart(2,'0');

  document.getElementById('edit-minute').value=
    String(x[1]||'00').padStart(2,'0');
}

function getTime(){
  return document.getElementById('edit-hour').value+
    ':'+
    document.getElementById('edit-minute').value;
}
function toggleRecurring(){
  document.getElementById(
    'recurring-days'
  ).classList.toggle(
    'hidden',
    !document.getElementById(
      'edit-recurring'
    ).checked
  );
}

function toggleLessonSaveMenu(){
  document.getElementById('lesson-save-dropdown')?.classList.toggle('hidden');
}
function closeLessonSaveMenu(){
  document.getElementById('lesson-save-dropdown')?.classList.add('hidden');
}

let pendingEmptyGroupLesson=null;

async function createOneGroupLesson(
  groupId,
  date,
  time,
  duration,
  status,
  targets,
  comment=null,
  teacherId=null
){
  if(!teacherId){
    const {data:{user},error:userError}=await supabaseClient.auth.getUser();
    if(userError||!user)throw new Error('Пользователь не авторизован');
    teacherId=user.id;
  }

  const group=groups.find(
    g=>String(g.id)===String(groupId)
  );

  const total=targets.reduce(
    (a,s)=>a+Number(s.price??0),
    0
  );

  const data=await db(
    '/lessons',
    {
      method:'POST',
      headers:{
        ...headers,
        Prefer:'return=representation'
      },
      body:JSON.stringify({
        student:group?.name||'',
        group_id:groupId,
        date,
        time,
        timezone:getTeacherTimezone(),
        price:total,
        status,
        duration,
        comment,
        teacher_id:teacherId
      })
    }
  );

  const lesson=data?.[0];

  if(!lesson){
    throw new Error(
      'Не удалось создать групповое занятие'
    );
  }

  for(const st of targets){
    await db(
      '/lesson_members',
      {
        method:'POST',
        headers:{
          ...headers,
          Prefer:'return=minimal'
        },
        body:JSON.stringify({
          lesson_id:lesson.id,
          student_id:st.id,
          price:Number(st.price??0),
          charged:true,
          teacher_id:teacherId
        })
      }
    );
  }

  return lesson;
}
async function renderGroupChargeExceptions(l){
  const box=document.getElementById(
    'group-charge-exceptions'
  );

  const list=document.getElementById(
    'group-charge-exceptions-list'
  );

  if(!box||!list)return;

  if(!l||!l.group_id){
    box.classList.add('hidden');
    list.innerHTML='';
    return;
  }

  const members=lessonMembersFor(l);

  if(!members.length){
    box.classList.add('hidden');
    list.innerHTML='';
    return;
  }

  box.classList.remove('hidden');

  list.innerHTML=members.map(m=>{
    const s=students.find(
      x=>String(x.id)===String(m.student_id)
    );

    if(!s)return '';

    const checked=m.charged!==false;

    return '<label class="flex items-center justify-between gap-3 py-2 cursor-pointer">'+
      '<span>'+
      esc(s.name)+
      ' <span class="text-xs text-slate-500">'+
      money(m.price??s.price??0)+
      '</span></span>'+
      '<input type="checkbox" class="group-charge-checkbox w-4 h-4" data-member-id="'+
      esc(m.id)+
      '" '+
      (checked?'checked':'')+
      '>'+
      '</label>';
  }).join('');
}

async function saveGroupChargeExceptions(l){
  if(!l?.group_id)return;

  const boxes=[
    ...document.querySelectorAll(
      '.group-charge-checkbox'
    )
  ];

  for(const box of boxes){
    await db(
      '/lesson_members?id=eq.'+
      encodeURIComponent(
        box.dataset.memberId
      ),
      {
        method:'PATCH',
        headers:{
          ...headers,
          Prefer:'return=minimal'
        },
        body:JSON.stringify({
          charged:box.checked
        })
      }
    );
  }
}
let lessonSaveInProgress=false;

async function saveLesson(scope='one'){
  if(lessonSaveInProgress)return;
  lessonSaveInProgress=true;
  const saveButton=document.getElementById('save-lesson-btn');
  const originalButtonText=saveButton?.textContent||'Сохранить';
  if(saveButton){
    saveButton.disabled=true;
    saveButton.textContent='Сохраняем…';
    saveButton.classList.add('opacity-60','cursor-not-allowed');
  }
  try{
    const notificationLessonIds=[];
    let notificationEvent=null;
    const id=document.getElementById('edit-id').value;
    const student=document.getElementById('edit-student').value;
    const date=document.getElementById('edit-date').value;
    const time=getTime();

    const duration=Number(
      document.getElementById('edit-duration').value
    );

    const price=Number(
      document.getElementById('edit-price').value
    );

    const status=document.getElementById('edit-status').value;

    const comment=
      document.getElementById('edit-comment').value.trim()||null;

    if(
      !student||
      !date||
      !Number.isFinite(duration)||
      duration<=0
    ){
      return showError(
        new Error(
          'Заполните ученика, дату и длительность'
        )
      );
    }

    const {data:userData,error:userError}=
      await supabaseClient.auth.getUser();

    if(userError||!userData?.user?.id){
      throw new Error(
        'Сессия преподавателя не найдена. Войдите в аккаунт снова.'
      );
    }

    const teacherId=userData.user.id;

    if(id){
      const l=lessons.find(
        x=>String(x.id)===String(id)
      );

      const groupId=l?.group_id||null;
      const originalDate=l?.date;
      const originalTime=l?.time;
      const originalStatus=l?.status;
      const isCancellation=status==='cancelled_charge'||status==='cancelled_free';
      const scheduleChanged=!!l&&(String(originalDate)!==String(date)||String(originalTime).slice(0,5)!==String(time).slice(0,5)||(isCancellation&&originalStatus!==status));
      if(scheduleChanged){
        notificationEvent=isCancellation?'cancelled':'updated';
        notificationLessonIds.push(String(id));
      }
      const repeatEnabled=document.getElementById('edit-recurring')?.checked;
      const selectedRepeatDays=[...document.querySelectorAll('.rec-day:checked')].map(x=>Number(x.value));
      if(repeatEnabled&&!selectedRepeatDays.length){
        throw new Error('Выбери хотя бы один день недели для повторения.');
      }
      const following=scope==='following'
        ?lessons.filter(x=>{
            if(String(x.id)===String(id)||x.date<l.date)return false;
            const sameSeries=groupId
              ?String(x.group_id)===String(groupId)
              :!x.group_id&&!!l.student_id&&String(x.student_id)===String(l.student_id);
            if(!sameSeries)return false;
            if(!repeatEnabled)return true;
            const parts=String(x.date).split('-').map(Number);
            const weekday=new Date(parts[0],parts[1]-1,parts[2]).getDay();
            return selectedRepeatDays.includes(weekday);
          })
        :[];

      if(scope==='following'&&!confirm(
        'Изменить это занятие и ещё '+following.length+' последующих занятий? Изменятся время, длительность, стоимость и комментарий. Даты остальных занятий и история посещаемости останутся без изменений.'
      ))return;

      if(scope==='following'&&scheduleChanged){
        following.forEach(x=>notificationLessonIds.push(String(x.id)));
      }
      if(groupId){
        await db(
          '/lessons?id=eq.'+
          encodeURIComponent(id),
          {
            method:'PATCH',
            headers:{
              ...headers,
              Prefer:'return=minimal'
            },
            body:JSON.stringify({
              student:
                groups.find(
                  g=>String(g.id)===String(groupId)
                )?.name||l.student,
              date,
              time,
              timezone:getTeacherTimezone(),
              price:l.price,
              status,
              duration,
              comment
            })
          }
        );

        await saveGroupChargeExceptions(l);

        await Promise.all(following.map(future=>
          db('/lessons?id=eq.'+encodeURIComponent(future.id),{
            method:'PATCH',
            headers:{...headers,Prefer:'return=minimal'},
            body:JSON.stringify({time,timezone:getTeacherTimezone(),duration,comment})
          })
        ));
      }else{
        await db(
          '/lessons?id=eq.'+
          encodeURIComponent(id),
          {
            method:'PATCH',
            headers:{
              ...headers,
              Prefer:'return=minimal'
            },
            body:JSON.stringify({
              student,
              date,
              time,
              timezone:getTeacherTimezone(),
              price,
              status,
              duration,
              comment
            })
          }
        );

        await Promise.all(following.map(future=>
          db('/lessons?id=eq.'+encodeURIComponent(future.id),{
            method:'PATCH',
            headers:{...headers,Prefer:'return=minimal'},
            body:JSON.stringify({student,time,price,duration,comment})
          })
        ));
      }
    }else{
      const groupId=
        student.startsWith('group:')
          ?student.slice(6)
          :null;

      const group=groupId
        ?groups.find(
          g=>String(g.id)===String(groupId)
        )
        :null;

      const targets=group
        ?students.filter(
          s=>
            !s.archived&&
            String(s.group_id)===String(groupId)
        )
        :[];

      if(group&&!targets.length){
        pendingEmptyGroupLesson={
          groupId,
          date,
          time,
          duration,
          status,
          comment,
          recurring:
            document.getElementById(
              'edit-recurring'
            ).checked,
          days:[
            ...document.querySelectorAll(
              '.rec-day:checked'
            )
          ].map(x=>Number(x.value))
        };

        closeLessonModal();
        openEmptyGroupMembersPicker(groupId);
        return;
      }

      if(group){
        if(
          document.getElementById(
            'edit-recurring'
          ).checked
        ){
          let days=[
            ...document.querySelectorAll(
              '.rec-day:checked'
            )
          ].map(x=>Number(x.value));

          if(!days.length){
            days=[
              new Date(
                date+'T00:00:00'
              ).getDay()
            ];
          }

          let cur=new Date(
            date+'T00:00:00'
          );

          for(let i=0;i<90;i++){
            if(days.includes(cur.getDay())){
              const createdLesson=await createOneGroupLesson(
                groupId,
                localISO(cur),
                time,
                duration,
                'pending',
                targets,
                comment,
                teacherId
              );
              if(createdLesson?.id)notificationLessonIds.push(String(createdLesson.id));
            }

            cur.setDate(
              cur.getDate()+1
            );
          }
        }else{
          const createdLesson=await createOneGroupLesson(
            groupId,
            date,
            time,
            duration,
            status,
            targets,
            comment,
            teacherId
          );
          if(createdLesson?.id)notificationLessonIds.push(String(createdLesson.id));
        }
      }else{
        const recurring=document.getElementById('edit-recurring').checked;
        if(recurring){
          const days=[...document.querySelectorAll('.rec-day:checked')].map(x=>Number(x.value));
          const selectedDays=days.length?days:[new Date(date+'T00:00:00').getDay()];
          const cur=new Date(date+'T00:00:00');
          for(let i=0;i<90;i++){
            if(selectedDays.includes(cur.getDay())){
              const created=await db('/lessons',{
                method:'POST',
                headers:{...headers,Prefer:'return=representation'},
                body:JSON.stringify({student,date:localISO(cur),time,timezone:getTeacherTimezone(),price,status:'pending',duration,comment,teacher_id:teacherId})
              });
              if(created?.[0]?.id)notificationLessonIds.push(String(created[0].id));
            }
            cur.setDate(cur.getDate()+1);
          }
        }else{
          const created=await db('/lessons',{
            method:'POST',
            headers:{...headers,Prefer:'return=representation'},
            body:JSON.stringify({student,date,time,timezone:getTeacherTimezone(),price,status,duration,comment,teacher_id:teacherId})
          });
          if(created?.[0]?.id)notificationLessonIds.push(String(created[0].id));
        }
      }
    }

    // For a newly created recurring series, notify only about the first lesson.
    // Sending one Telegram message for every generated occurrence would spam students.
    if(!id&&document.getElementById('edit-recurring')?.checked&&notificationLessonIds.length>1){
      notificationLessonIds.splice(1);
    }

    closeLessonModal();

    if(notificationLessonIds.length){
      const ask=notificationEvent==='cancelled'
        ?'Отправить ученику уведомление об отмене занятия в Telegram?'
        :notificationEvent==='updated'
          ?'Расписание изменено. Отправить ученику уведомление в Telegram?'
          :'Занятие создано. Отправить ученику уведомление в Telegram?';
      if(confirm(ask)){
        const event=notificationEvent||'created';
        const {data,error}=await supabaseClient.functions.invoke('notify-lesson-change',{
          body:{lesson_ids:notificationLessonIds,event}
        });
        if(error)showError(new Error('Не удалось отправить уведомление: '+error.message));
        else{
          const sent=(data?.results||[]).reduce((sum,x)=>sum+Number(x.sent||0),0);
          alert(sent?'Уведомления отправлены: '+sent:'Уведомления не отправлены. Проверьте, подключён ли Telegram у ученика и включены ли уведомления об изменениях.');
        }
      }
    }

    await loadData();

    renderWeek();
    renderDay();

  }catch(e){
    showError(e);
  }finally{
    lessonSaveInProgress=false;
    if(saveButton){
      saveButton.disabled=false;
      saveButton.textContent=originalButtonText;
      saveButton.classList.remove('opacity-60','cursor-not-allowed');
    }
  }
}