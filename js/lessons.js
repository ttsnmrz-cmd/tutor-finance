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
  document.getElementById('edit-date').value=
    date||selectedDate;
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
  ).value=st?.name||'';

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

  document.getElementById(
    'edit-student'
  ).value=
    l.group_id
      ?'group:'+l.group_id
      :l.student;

  document.getElementById(
    'edit-date'
  ).value=l.date;

  document.getElementById(
    'edit-duration'
  ).value=String(l.duration||60);

  setTime(l.time||'11:00');

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
  ).classList.add('hidden');

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
async function saveLesson(){
  try{
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
              price:l.price,
              status,
              duration,
              comment
            })
          }
        );

        await saveGroupChargeExceptions(l);
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
              price,
              status,
              duration,
              comment
            })
          }
        );
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
              await createOneGroupLesson(
                groupId,
                localISO(cur),
                time,
                duration,
                'pending',
                targets,
                comment,
                teacherId
              );
            }

            cur.setDate(
              cur.getDate()+1
            );
          }
        }else{
          await createOneGroupLesson(
            groupId,
            date,
            time,
            duration,
            status,
            targets,
            comment,
            teacherId
          );
        }
      }else{
        await db(
          '/lessons',
          {
            method:'POST',
            headers:{
              ...headers,
              Prefer:'return=minimal'
            },
            body:JSON.stringify({
              student,
              date,
              time,
              price,
              status,
              duration,
              comment,
              teacher_id:teacherId
            })
          }
        );
      }
    }

    closeLessonModal();

    await loadData();

    renderWeek();
    renderDay();

  }catch(e){
    showError(e);
  }
}