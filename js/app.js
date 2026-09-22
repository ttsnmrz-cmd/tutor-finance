const { createClient } = supabase;

const supabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

let headers = {
  apikey: SUPABASE_KEY,
  'Content-Type': 'application/json'
};

let students=[],lessons=[],payments=[],groups=[],lessonMembers=[],selectedDate=localISO(new Date()),weekAnchor=new Date();

const statusLabels={
  pending:'Запланировано',
  conducted:'Проведено',
  rescheduled:'Перенесено',
  cancelled_charge:'Отменено — списать',
  cancelled_free:'Отменено — не списывать'
};

const charge=new Set(['conducted','cancelled_charge']);

const statusClass={
  pending:'bg-amber-100 text-amber-800',
  conducted:'bg-emerald-100 text-emerald-800',
  rescheduled:'bg-blue-100 text-blue-800',
  cancelled_charge:'bg-red-100 text-red-800',
  cancelled_free:'bg-slate-100 text-slate-700'
};

const archived=new Set();

function localISO(d){
  return d.getFullYear()+'-'+
    String(d.getMonth()+1).padStart(2,'0')+'-'+
    String(d.getDate()).padStart(2,'0');
}

function esc(v){
  return String(v??'').replace(/[&<>'\"]/g,c=>({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    "'":'&#39;',
    '"':'&quot;'
  }[c]));
}

function money(n){
  return Number(n||0).toLocaleString('ru-RU',{
    maximumFractionDigits:2
  })+' BYN';
}

function showError(e){
  console.error(e);
  const b=document.getElementById('error-box');
  b.textContent='Ошибка: '+(e.message||e);
  b.classList.remove('hidden');
  setTimeout(()=>b.classList.add('hidden'),5000);
}

async function db(path,opt={}){
  const r=await fetch(API+path,{
    ...opt,
    headers:{
      ...headers,
      ...(opt.headers||{})
    }
  });

  const t=await r.text();

  if(!r.ok)throw new Error(t||r.statusText);

  return t.trim()?JSON.parse(t):null;
}
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
        (a,m)=>
          a+
          Number(
            m.price??
            students.find(
              s=>String(s.id)===String(m.student_id)
            )?.price??
            0
          ),
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
async function loadData(){
  [students,lessons,payments,groups,lessonMembers]=await Promise.all([
    db('/students?select=id,name,price,group_id,archived,email,telegram'),
    db('/lessons?select=id,student,date,time,price,status,duration,group_id,comment'),
    db('/payments?select=id,student,amount,date'),
    db('/groups?select=id,name'),
    db('/lesson_members?select=id,lesson_id,student_id,price,charged,attendance_status')
  ]);

  students=students||[];
  lessons=lessons||[];
  payments=payments||[];
  groups=groups||[];
  lessonMembers=lessonMembers||[];

  archived.clear();

  students
    .filter(s=>s.archived)
    .forEach(s=>archived.add(String(s.id)));

  await autoCompletePastLessons();
}

async function autoCompletePastLessons(){
  const now=new Date();
  const today=localISO(now);

  const nowTime=
    String(now.getHours()).padStart(2,'0')+
    ':'+
    String(now.getMinutes()).padStart(2,'0');

  const due=lessons.filter(
    l=>
      l.status==='pending'&&
      l.date&&
      (
        l.date<today||
        (
          l.date===today&&
          String(l.time||'23:59').slice(0,5)<=nowTime
        )
      )
  );

  if(!due.length)return;

  for(const l of due){
    await db(
      '/lessons?id=eq.'+encodeURIComponent(l.id),
      {
        method:'PATCH',
        headers:{
          ...headers,
          Prefer:'return=minimal'
        },
        body:JSON.stringify({
          status:'conducted'
        })
      }
    );
  }

  due.forEach(l=>l.status='conducted');
}
function switchTab(t){
  document
    .getElementById('tab-calendar')
    .classList.toggle('hidden',t!=='calendar');

  document
    .getElementById('tab-students')
    .classList.toggle('hidden',t!=='students');

  document.getElementById('nav-calendar').className=
    'px-4 py-2 rounded-xl font-semibold '+
    (t==='calendar'
      ?'bg-indigo-600 text-white'
      :'bg-slate-100');

  document.getElementById('nav-students').className=
    'px-4 py-2 rounded-xl font-semibold '+
    (t==='students'
      ?'bg-indigo-600 text-white'
      :'bg-slate-100');

  if(t==='calendar'){
    renderWeek();
    renderDay();
  }else{
    renderStudents();
  }
}

function fillStudentSelects(){
  const active=sortedActiveStudents();

  const studentOptions=active
    .map(s=>
      `<option value="${esc(s.name)}">${esc(s.name)}</option>`
    )
    .join('');

  const groupOptions=groups
    .map(g=>
      `<option value="group:${esc(g.id)}">${esc(g.name)}</option>`
    )
    .join('');

  const e=document.getElementById('edit-student');

  if(e){
    e.innerHTML=
      (
        groups.length
          ?groupOptions+'<option disabled>----</option>'
          :''
      )+
      studentOptions;
  }

  const p=document.getElementById('add-payment-student');

  if(p)p.innerHTML=studentOptions;
}

function updateLessonGroupButton(){
  const e=document.getElementById(
    'lesson-add-to-group-btn'
  );

  const sel=document.getElementById('edit-student');

  if(!e||!sel)return;

  const s=students.find(
    x=>x.name===sel.value
  );

  const g=studentGroup(s?.id);

  e.classList.toggle('hidden',!g);
}

function addStudentToCurrentLessonGroup(){
  const ctx=lessonGroupContext();

  if(!ctx)return;

  const attachedIds=new Set(
    ctx.attached.map(
      m=>String(m.student_id)
    )
  );

  const available=students
    .filter(
      s=>
        !s.archived&&
        !attachedIds.has(String(s.id))
    )
    .sort(
      (a,b)=>
        String(a.name||'').localeCompare(
          String(b.name||''),
          'ru',
          {sensitivity:'base'}
        )
    );

  const f=document.getElementById(
    'group-choice-form'
  );

  if(!f)return;

  document.querySelector(
    '#group-choice-modal h2'
  ).textContent='Добавить ученика в занятие';

  f.innerHTML=
    available.length
      ?'<div class="text-sm text-slate-500 mb-2">'+
        esc(ctx.group.name)+
        '</div>'+
        '<div class="max-h-80 overflow-y-auto space-y-1">'+
        available.map(
          s=>
            '<button type="button" data-student-id="'+
            esc(s.id)+
            '" class="lesson-add-student-option w-full text-left px-3 py-3 rounded-xl hover:bg-purple-50 flex justify-between items-center">'+
            '<span>'+esc(s.name)+'</span>'+
            '<span class="text-xs text-slate-400">Добавить</span>'+
            '</button>'
        ).join('')+
        '</div>'
      :'<div class="text-sm text-slate-400 py-4 text-center">Все ученики группы уже добавлены</div>';

  f.querySelectorAll(
    '.lesson-add-student-option'
  ).forEach(btn=>
    btn.addEventListener(
      'click',
      async()=>{
        await addStudentToLesson(
          btn.dataset.studentId
        );

        closeModal('group-choice-modal');
      }
    )
  );

 showModal('group-choice-modal');
}

async function createOneGroupLesson(
  groupId,
  date,
  time,
  duration,
  status,
  targets,
  comment=null
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
        comment
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
          charged:true
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
    const id=document.getElementById(
      'edit-id'
    ).value;

    const student=document.getElementById(
      'edit-student'
    ).value;

    const date=document.getElementById(
      'edit-date'
    ).value;

    const time=getTime();

    const duration=Number(
      document.getElementById(
        'edit-duration'
      ).value
    );

    const price=Number(
      document.getElementById(
        'edit-price'
      ).value
    );

    const status=document.getElementById(
      'edit-status'
    ).value;

    const comment=
      document.getElementById(
        'edit-comment'
      ).value.trim()||null;

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

    if(id){
      const l=lessons.find(
        x=>String(x.id)===String(id)
      );

      const groupId=l?.group_id||null;

      if(groupId){
        const targets=studentsForLesson(l);

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
                comment
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
            comment
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
              comment
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

function openEmptyGroupMembersPicker(groupId){
  const group=groups.find(
    g=>String(g.id)===String(groupId)
  );

  if(!group)return;

  const available=students
    .filter(
      s=>
        !s.archived&&
        String(s.group_id)!==String(groupId)
    )
    .sort(
      (a,b)=>
        String(a.name||'').localeCompare(
          String(b.name||''),
          'ru',
          {sensitivity:'base'}
        )
    );

  const f=document.getElementById(
    'group-choice-form'
  );

  document.querySelector(
    '#group-choice-modal h2'
  ).textContent='В группе пока нет учеников';

  f.innerHTML=
    available.length
      ?'<p class="text-sm text-slate-500 mb-3">Добавить учеников в группу «'+
        esc(group.name)+
        '»</p>'+
        '<div class="max-h-80 overflow-y-auto space-y-1">'+
        available.map(
          st=>
            '<label class="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-purple-50 cursor-pointer">'+
            '<input type="checkbox" value="'+
            esc(st.id)+
            '" class="empty-group-member w-4 h-4">'+
            '<span>'+esc(st.name)+'</span>'+
            '</label>'
        ).join('')+
        '</div>'+
        '<button onclick="confirmEmptyGroupMembers()" class="primary-btn w-full rounded-xl py-2 mt-3 font-semibold">Добавить учеников</button>'
      :'<div class="text-sm text-slate-400 py-4 text-center">Нет доступных учеников</div>';

  document.getElementById(
    'group-choice-modal'
  ).dataset.emptyGroupId=groupId;

  showModal('group-choice-modal');
}

async function confirmEmptyGroupMembers(){
  const modal=document.getElementById(
    'group-choice-modal'
  );

  const groupId=modal.dataset.emptyGroupId;

  const ids=[
    ...document.querySelectorAll(
      '.empty-group-member:checked'
    )
  ].map(x=>x.value);

  if(!ids.length){
    return showError(
      new Error(
        'Выберите хотя бы одного ученика'
      )
    );
  }

  try{
    for(const id of ids){
      await db(
        '/students?id=eq.'+
        encodeURIComponent(id),
        {
          method:'PATCH',
          headers:{
            ...headers,
            Prefer:'return=minimal'
          },
          body:JSON.stringify({
            group_id:groupId
          })
        }
      );
    }

    closeModal('group-choice-modal');

    await loadData();

    const p=pendingEmptyGroupLesson;
    pendingEmptyGroupLesson=null;

    if(!p)return;

    const targets=students.filter(
      st=>
        !st.archived&&
        String(st.group_id)===String(groupId)
    );

    if(p.recurring){
      let days=p.days;

      if(!days.length){
        days=[
          new Date(
            p.date+'T00:00:00'
          ).getDay()
        ];
      }

      let cur=new Date(
        p.date+'T00:00:00'
      );

      for(let i=0;i<90;i++){
        if(days.includes(cur.getDay())){
          await createOneGroupLesson(
            groupId,
            localISO(cur),
            p.time,
            p.duration,
            'pending',
            targets,
            p.comment
          );
        }

        cur.setDate(
          cur.getDate()+1
        );
      }
    }else{
      await createOneGroupLesson(
        groupId,
        p.date,
        p.time,
        p.duration,
        p.status,
        targets,
        p.comment
      );
    }

    await loadData();

    renderWeek();
    renderDay();

  }catch(e){
    showError(e);
  }
}

async function deleteLessonFromModal(){
  const id=document.getElementById(
    'edit-id'
  ).value;

  if(!id)return;

  await deleteLesson(id);

  closeLessonModal();
}

async function deleteLesson(id){
  if(!confirm('Удалить это занятие?'))return;

  try{
    await db(
      '/lessons?id=eq.'+
      encodeURIComponent(id),
      {
        method:'DELETE',
        headers
      }
    );

    await loadData();

    renderWeek();
    renderDay();

  }catch(e){
    showError(e);
  }
}

async function deleteThisAndFollowingFromModal(){
  const id=document.getElementById(
    'edit-id'
  ).value;

  const l=lessons.find(
    x=>String(x.id)===String(id)
  );

  if(!l)return;

  const isGroup=!!l.group_id;

  if(!confirm(
    isGroup
      ?'Удалить это групповое занятие и все следующие занятия этой группы начиная с '+l.date+'?'
      :'Удалить это занятие и все следующие у этого ученика начиная с '+l.date+'?'
  ))return;

  try{
    const targets=isGroup
      ?lessons.filter(
        x=>
          String(x.group_id)===String(l.group_id)&&
          x.date>=l.date
      )
      :lessons.filter(
        x=>
          x.student===l.student&&
          x.date>=l.date
      );

    for(const x of targets){
      await db(
        '/lessons?id=eq.'+
        encodeURIComponent(x.id),
        {
          method:'DELETE',
          headers
        }
      );
    }

    closeLessonModal();

    await loadData();

    renderWeek();
    renderDay();

  }catch(e){
    showError(e);
  }
}

function closeLessonModal(){
  closeModal('lesson-modal');
}

function showModal(id){
  const e=document.getElementById(id);

  e.classList.remove('hidden');
  e.classList.add('flex');
}

function closeModal(id){
  const e=document.getElementById(id);

  e.classList.add('hidden');
  e.classList.remove('flex');
}

function loginTeacher(){
  if(
    document.getElementById(
      'teacher-password-input'
    ).value
  ){
    localStorage.setItem(
      'tutor_logged_in',
      'true'
    );

    closeModal(
      'teacher-login-modal'
    );

    loadData().then(()=>{
      renderWeek();
      renderDay();
    });
  }else{
    document.getElementById(
      'teacher-login-error'
    ).textContent='Введите пароль';
  }
}

function teacherLogout(){
  localStorage.removeItem(
    'tutor_logged_in'
  );

  location.reload();
}

let publicStudent=null;

async function initPublicStudent(){
  const id=new URLSearchParams(
    location.search
  ).get('student');

  if(!id)return false;

  document
    .getElementById('student-public-view')
    .classList.remove('hidden');

  try{
    const d=await db(
      '/students?id=eq.'+
      encodeURIComponent(id)+
      '&select=id,name,price,group_id,archived'
    );

    publicStudent=d?.[0];

    if(publicStudent){
      document.getElementById(
        'student-public-name'
      ).textContent=
        'Ученик: '+publicStudent.name;
    }else{
      document.getElementById(
        'student-public-name'
      ).textContent=
        'Ученик не найден';
    }

    if(!publicStudent)return true;

    await openStudentCabinet();

  }catch(e){
    document.getElementById(
      'student-public-error'
    ).textContent=e.message;
  }

  return true;
}

async function openStudentCabinet(){
  if(!publicStudent)return;

  try{
    const ls=await db(
      '/lessons?student=eq.'+
      encodeURIComponent(publicStudent.name)+
      '&select=id,date,time,price,status,duration'
    );

    const ps=await db(
      '/payments?student=eq.'+
      encodeURIComponent(publicStudent.name)+
      '&select=amount,date'
    );

    const paid=ps.reduce(
      (a,p)=>a+Number(p.amount||0),
      0
    );

    const charges=ls
      .filter(l=>charge.has(l.status))
      .sort(
        (a,b)=>
          (
            String(b.date)+
            String(b.time)
          ).localeCompare(
            String(a.date)+
            String(a.time)
          )
      );

    const spent=charges.reduce(
      (a,l)=>a+Number(l.price||0),
      0
    );

    const now=new Date();
    const today=localISO(now);

    const nowTime=
      String(now.getHours()).padStart(2,'0')+
      ':'+
      String(now.getMinutes()).padStart(2,'0');

    const future=ls
      .filter(
        l=>
          l.status==='pending'&&
          (
            l.date>today||
            (
              l.date===today&&
              String(l.time||'23:59')
                .slice(0,5)>=nowTime
            )
          )
      )
      .sort(
        (a,b)=>
          (
            String(a.date)+
            String(a.time)
          ).localeCompare(
            String(b.date)+
            String(b.time)
          )
      );

    const upcoming=future.slice(0,5);

    const cutoff=
      upcoming.length
        ?upcoming[upcoming.length-1].date
        :null;

    const visible=ls
      .filter(
        l=>!cutoff||l.date<=cutoff
      )
      .sort(
        (a,b)=>
          (
            String(a.date)+
            String(a.time)
          ).localeCompare(
            String(b.date)+
            String(b.time)
          )
      );

    document.getElementById(
      'public-student-title'
    ).textContent=
      publicStudent.name;

    document.getElementById(
      'public-student-meta'
    ).textContent=
      'Стоимость занятия: '+
      money(publicStudent.price||0);

    document.getElementById(
      'public-paid'
    ).textContent=
      money(paid);

    document.getElementById(
      'public-spent'
    ).textContent=
      money(spent);

    document.getElementById(
      'public-balance'
    ).textContent=
      money(paid-spent);

    document.getElementById(
      'public-conducted'
    ).textContent=
      ls.filter(
        l=>l.status==='conducted'
      ).length;

    document.getElementById(
      'public-price'
    ).textContent=
      money(publicStudent.price||0);

    const topups=ps.sort(
      (a,b)=>
        String(b.date).localeCompare(
          String(a.date)
        )
    );

    document.getElementById(
      'public-payments'
    ).innerHTML=
      topups.map(
        p=>
          `<div class="flex justify-between border-b border-slate-200 py-1">
            <span>${esc(p.date)}</span>
            <b class="text-emerald-600">+${money(p.amount)}</b>
          </div>`
      ).join('')||
      '<span class="text-slate-400">Пополнений нет</span>';

    document.getElementById(
      'public-lessons'
    ).innerHTML=
      visible.map(
        l=>
          `<div class="rounded-2xl border border-slate-200 p-3 flex justify-between items-center gap-3">
            <div>
              <div class="font-semibold">${esc(l.date)}</div>
              <div class="text-xs text-slate-500">
                ${esc(displayTime(l.time))} ·
                ${l.duration||60} мин ·
                ${money(l.price)}
              </div>
            </div>

            <span class="status ${statusClass[l.status]||'bg-slate-100 text-slate-700'} whitespace-nowrap">
              ${statusLabels[l.status]||l.status}
            </span>
          </div>`
      ).join('')||
      '<span class="text-slate-400">Занятий нет</span>';

    document.getElementById(
      'student-public-login'
    ).classList.add('hidden');

    document.getElementById(
      'student-public-content'
    ).classList.remove('hidden');

    const box=document.getElementById(
      'public-lessons'
    );

    const target=
      visible.find(
        l=>
          l.date>today||
          (
            l.date===today&&
            String(l.time||'23:59')
              .slice(0,5)>=nowTime
          )
      )||
      visible[visible.length-1];

    if(target){
      const el=[
        ...box.children
      ].find(
        x=>
          x.querySelector(
            '.font-semibold'
          )?.textContent===target.date
      );

      if(el){
        box.scrollTop=
          Math.max(
            0,
            el.offsetTop-
            box.offsetTop-
            12
          );
      }
    }

  }catch(e){
    document.getElementById(
      'student-public-error'
    ).textContent=e.message;
  }
}

async function initApp(){
  if(await initPublicStudent())return;

  document.getElementById(
    'teacher-app'
  ).classList.remove('hidden');

  if(
    localStorage.getItem(
      'tutor_logged_in'
    )==='true'
  ){
    try{
      await loadData();
      renderWeek();
      renderDay();
    }catch(e){
      showError(e);
    }
  }else{
    showModal(
      'teacher-login-modal'
    );
  }
}

document.addEventListener(
  'click',
  e=>{
    if(
      !e.target.closest('[id^="menu-"]')&&
      !e.target.closest('button')
    ){
      document
        .querySelectorAll(
          '[id^="menu-"]'
        )
        .forEach(
          x=>x.classList.add('hidden')
        );
    }

    if(
      !e.target.closest(
        '.student-attendance-menu'
      )&&
      !e.target.closest('.status')
    ){
      document
        .querySelectorAll(
          '.student-attendance-menu'
        )
        .forEach(
          x=>x.classList.add('hidden')
        );
    }

    if(
      !e.target.closest(
        '#lesson-delete-menu'
      )
    ){
      closeLessonDeleteMenu();
    }
  }
);

document.addEventListener(
  'DOMContentLoaded',
  initApp
);

function lessonGroupContext(){
  const id=document.getElementById(
    'edit-id'
  ).value;

  const anchor=lessons.find(
    x=>String(x.id)===String(id)
  );

  if(!anchor?.group_id)return null;

  const group=groups.find(
    g=>String(g.id)===String(anchor.group_id)
  );

  if(!group)return null;

  const members=students.filter(
    x=>
      !x.archived&&
      String(x.group_id)===String(group.id)
  );

  const attached=lessonMembersFor(anchor);

  return{
    group,
    members,
    attached,
    anchor
  };
}

function renderLessonGroupMembers(){
  document
    .getElementById(
      'lesson-group-members'
    )
    ?.classList.add('hidden');

  const list=document.getElementById(
    'lesson-group-members-list'
  );

  if(list)list.innerHTML='';
}

function askGroupChangeScope(action,name){
  const answer=prompt(
    action+
    ' '+
    name+
    '?\n\n1 — только это занятие\n2 — это и все последующие занятия\n0 — отменить',
    '1'
  );

  if(answer==='1')return'one';

  if(answer==='2')return'following';

  return null;
}

async function updateGroupLessonPrice(lessonId){
  const members=await db(
    '/lesson_members?lesson_id=eq.'+
    encodeURIComponent(lessonId)+
    '&select=student_id'
  );

  const total=(members||[]).reduce(
    (sum,m)=>
      sum+
      Number(
        students.find(
          s=>String(s.id)===String(m.student_id)
        )?.price??0
      ),
    0
  );

  await db(
    '/lessons?id=eq.'+
    encodeURIComponent(lessonId),
    {
      method:'PATCH',
      headers:{
        ...headers,
        Prefer:'return=minimal'
      },
      body:JSON.stringify({
        price:total
      })
    }
  );
}

async function removeStudentFromLesson(memberId){
  const ctx=lessonGroupContext();

  if(!ctx)return;

  const m=ctx.attached.find(
    x=>String(x.id)===String(memberId)
  );

  const st=m&&students.find(
    x=>String(x.id)===String(m.student_id)
  );

  if(!m||!st)return;

  const scope=askGroupChangeScope(
    'Удалить '+st.name+' из группы',
    st.name
  );

  if(!scope)return;

  try{
    const targets=
      scope==='one'
        ?[ctx.anchor]
        :lessons.filter(
          x=>
            String(x.group_id)===
            String(ctx.anchor.group_id)&&
            x.date>=ctx.anchor.date
        );

    for(const lesson of targets){
      const ms=lessonMembersFor(
        lesson
      ).filter(
        x=>String(x.student_id)===String(st.id)
      );

      for(const lm of ms){
        await db(
          '/lesson_members?id=eq.'+
          encodeURIComponent(lm.id),
          {
            method:'DELETE',
            headers
          }
        );
      }

      if(
        lessonMembersFor(lesson).length<=ms.length
      ){
        await db(
          '/lessons?id=eq.'+
          encodeURIComponent(lesson.id),
          {
            method:'DELETE',
            headers
          }
        );
      }else{
        await updateGroupLessonPrice(
          lesson.id
        );
      }
    }

    await loadData();

    renderWeek();
    renderDay();

    if(
      lessons.some(
        x=>String(x.id)===String(ctx.anchor.id)
      )
    ){
      openEditLesson(ctx.anchor.id);
    }else{
      closeLessonModal();
    }

  }catch(e){
    showError(e);
  }
}

async function addStudentToLesson(studentId){
  const ctx=lessonGroupContext();

  if(!ctx)return;

  const st=students.find(
    x=>String(x.id)===String(studentId)
  );

  if(
    !st||
    ctx.attached.some(
      m=>String(m.student_id)===String(st.id)
    )
  )return;

  const scope=askGroupChangeScope(
    'Добавить '+st.name+' в группу',
    st.name
  );

  if(!scope)return;

  try{
    const targets=
      scope==='one'
        ?[ctx.anchor]
        :lessons.filter(
          x=>
            String(x.group_id)===
            String(ctx.anchor.group_id)&&
            x.date>=ctx.anchor.date
        );

    for(const lesson of targets){
      if(
        lessonMembersFor(lesson).some(
          m=>String(m.student_id)===String(st.id)
        )
      )continue;

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
            price:Number(st.price??0)
          })
        }
      );

      await updateGroupLessonPrice(
        lesson.id
      );
    }

    await loadData();

    renderWeek();
    renderDay();

    openEditLesson(
      ctx.anchor.id
    );

  }catch(e){
    showError(e);
  }
}

function toggleLessonDeleteMenu(){
  document
    .getElementById(
      'lesson-delete-dropdown'
    )
    ?.classList.toggle('hidden');
}

function closeLessonDeleteMenu(){
  document
    .getElementById(
      'lesson-delete-dropdown'
    )
    ?.classList.add('hidden');
}
