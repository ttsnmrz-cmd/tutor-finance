function studentStats(s){
  const groupLessonIds=new Set(
    lessonMembers
      .filter(m=>String(m.student_id)===String(s.id))
      .map(m=>String(m.lesson_id))
  );

  const ls=lessons.filter(
    l=>l.student===s.name||groupLessonIds.has(String(l.id))
  );

  const income=payments
    .filter(p=>p.student===s.name)
    .reduce((a,p)=>a+Number(p.amount||0),0);

  const expenses=ls
    .filter(l=>charge.has(l.status))
    .reduce((a,l)=>{
      if(l.group_id){
        const m=lessonMembers.find(
          x=>String(x.lesson_id)===String(l.id)&&
          String(x.student_id)===String(s.id)
        );

        return a+(m&&m.charged!==false
          ?Number(m.price??s.price??0)
          :0);
      }

      return a+Number(l.price||0);
    },0);

  return{
    ls,
    income,
    expenses,
    bal:income-expenses
  };
}

function studentGroup(id){
  const s=students.find(x=>String(x.id)===String(id));
  return groups.find(g=>String(g.id)===String(s?.group_id));
}

function balanceClass(b){
  return b>50
    ?'balance-green'
    :b>0
      ?'balance-orange'
      :b<0
        ?'balance-red'
        :'bg-slate-50';
}

let studentSort=localStorage.getItem('student_sort')||'new';

function toggleStudentSort(){
  document.getElementById('student-sort-menu')?.classList.toggle('hidden');
}

function setStudentSort(mode){
  studentSort=mode;
  localStorage.setItem('student_sort',mode);
  document.getElementById('student-sort-menu')?.classList.add('hidden');
  renderStudents();
}

function sortedActiveStudents(){
  const active=students.filter(s=>!s.archived);

  if(studentSort==='name_asc'){
    active.sort((a,b)=>String(a.name||'').localeCompare(
      String(b.name||''),
      'ru',
      {sensitivity:'base'}
    ));
  }

  if(studentSort==='name_desc'){
    active.sort((a,b)=>String(b.name||'').localeCompare(
      String(a.name||''),
      'ru',
      {sensitivity:'base'}
    ));
  }

  if(studentSort==='new'||studentSort==='old'){
    active.sort((a,b)=>{
      const ai=students.indexOf(a);
      const bi=students.indexOf(b);

      return studentSort==='new'?bi-ai:ai-bi;
    });
  }

  return active;
}

function renderStudents(){
  renderGroups();

  const show=document.getElementById('show-archived').checked;
  const active=show?students.slice():sortedActiveStudents();

  if(show){
    if(studentSort==='name_asc'){
      active.sort((a,b)=>String(a.name||'').localeCompare(
        String(b.name||''),
        'ru',
        {sensitivity:'base'}
      ));
    }

    if(studentSort==='name_desc'){
      active.sort((a,b)=>String(b.name||'').localeCompare(
        String(a.name||''),
        'ru',
        {sensitivity:'base'}
      ));
    }

    if(studentSort==='new'||studentSort==='old'){
      active.sort((a,b)=>{
        const ai=students.indexOf(a);
        const bi=students.indexOf(b);

        return studentSort==='new'?bi-ai:ai-bi;
      });
    }
  }

  const c=document.getElementById('students-list');

  c.innerHTML=active.length
    ?active.map(s=>studentRow(s)).join('')
    :'<div class="py-8 text-center text-slate-400">Учеников нет</div>';
}

function studentRow(s){
  const st=studentStats(s);
  const g=studentGroup(s.id);
  const isArchived=!!s.archived;
  const id=String(s.id);

  return `<div class="border rounded-2xl overflow-visible mb-2 ${isArchived?'opacity-60':''}">
    <div onclick="toggleStudentDetail('${esc(id)}')" class="p-4 flex items-center gap-3 cursor-pointer hover:bg-slate-50">
      <div class="flex-1 min-w-0">
        <div class="font-semibold">${esc(s.name)}</div>
        <div class="text-xs text-slate-400">${esc(g?.name||'без группы')}${isArchived?' · архив':''}</div>
      </div>

      <div class="px-3 py-2 rounded-xl font-bold text-sm ${balanceClass(st.bal)}">
        ${money(st.bal)}
      </div>

      <div class="relative">
        <button
          onclick="event.stopPropagation();toggleStudentMenu('${esc(id)}')"
          class="w-9 h-9 rounded-xl bg-slate-100 text-xl"
        >⋮</button>

        <div
          id="menu-${esc(id)}"
          class="hidden absolute right-0 top-10 z-20 bg-white border rounded-2xl shadow-xl p-2 w-56"
        >
          <button
            onclick="openStudentEdit('${esc(id)}')"
            class="block w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100"
          >Изменить</button>

          <button
            onclick="addToGroup('${esc(id)}')"
            class="block w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100"
          >Включить в группу</button>

          <button
            onclick="copyStudentLink('${esc(id)}')"
            class="block w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100"
          >Ссылка для ученика</button>

          <button
            onclick="toggleArchive('${esc(id)}')"
            class="block w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100"
          >${isArchived?'Вернуть из архива':'Заархивировать'}</button>

          <button
            onclick="removeStudent('${esc(id)}')"
            class="block w-full text-left px-3 py-2 rounded-xl hover:bg-red-50 text-red-600"
          >Удалить ученика</button>
        </div>
      </div>
    </div>

    <div
      id="detail-${esc(id)}"
      class="hidden border-t bg-slate-50 p-4"
    >${studentDetail(s)}</div>
  </div>`;
}
function studentLessonAttendance(l,s){
  if(l.group_id){
    const m=lessonMembers.find(
      x=>String(x.lesson_id)===String(l.id)&&
      String(x.student_id)===String(s.id)
    );
    return m?.attendance_status||null;
  }

  return l.status==='cancelled_charge'
    ?'cancelled_charge'
    :l.status==='cancelled_free'
      ?'cancelled_free'
      :null;
}

function studentLessonStatusText(l,s){
  const a=studentLessonAttendance(l,s);

  return a==='cancelled_charge'
    ?'Не посетил, списать оплату'
    :a==='cancelled_free'
      ?'Не посетил, не списывать оплату'
      :(statusLabels[l.status]||l.status);
}

function studentLessonStatusClass(l,s){
  const a=studentLessonAttendance(l,s);

  return statusClass[a]||
    statusClass[l.status]||
    'bg-slate-100 text-slate-700';
}

function toggleStudentAttendanceMenu(id){
  document.querySelectorAll('.student-attendance-menu').forEach(x=>{
    if(x.id!=='student-attendance-menu-'+id){
      x.classList.add('hidden');
    }
  });

  document
    .getElementById('student-attendance-menu-'+id)
    ?.classList.toggle('hidden');
}

async function setStudentAttendance(lessonId,studentId,status){
  try{
    const l=lessons.find(
      x=>String(x.id)===String(lessonId)
    );

    const s=students.find(
      x=>String(x.id)===String(studentId)
    );

    if(!l||!s)return;

    if(l.group_id){
      const m=lessonMembers.find(
        x=>String(x.lesson_id)===String(l.id)&&
        String(x.student_id)===String(s.id)
      );

      if(!m){
        throw new Error(
          'Ученик не добавлен в это групповое занятие'
        );
      }

      await db(
        '/lesson_members?id=eq.'+
        encodeURIComponent(m.id),
        {
          method:'PATCH',
          headers:{
            ...headers,
            Prefer:'return=minimal'
          },
          body:JSON.stringify({
            attendance_status:
              status==='conducted'?null:status,
            charged:status!=='cancelled_free'
          })
        }
      );
    }else{
      await db(
        '/lessons?id=eq.'+
        encodeURIComponent(l.id),
        {
          method:'PATCH',
          headers:{
            ...headers,
            Prefer:'return=minimal'
          },
          body:JSON.stringify({
            status:
              status==='conducted'
                ?'conducted'
                :status
          })
        }
      );
    }

    await loadData();
    renderStudents();

    document
      .getElementById('detail-'+studentId)
      ?.classList.remove('hidden');

    requestAnimationFrame(
      ()=>scrollStudentLessonsToNearest(studentId)
    );

  }catch(e){
    showError(e);
  }
}

function scrollStudentLessonsToNearest(studentId){
  const box=document.getElementById(
    'student-lessons-'+studentId
  );

  if(!box)return;

  const rows=[
    ...box.querySelectorAll('[data-lesson-date]')
  ];

  if(!rows.length)return;

  const now=new Date();
  const today=localISO(now);

  const nowTime=
    String(now.getHours()).padStart(2,'0')+
    ':'+
    String(now.getMinutes()).padStart(2,'0');

  let target=rows.find(
    r=>
      r.dataset.lessonDate>today||
      (
        r.dataset.lessonDate===today&&
        (r.dataset.lessonTime||'23:59')>=nowTime
      )
  );

  if(!target){
    target=rows[rows.length-1];
  }

  box.scrollTop=Math.max(
    0,
    target.offsetTop-
    box.offsetTop-
    box.clientHeight/2+
    target.offsetHeight/2
  );
}
function studentDetail(s){
  const st=studentStats(s);
  const today=localISO(new Date());

  const lessonKey=l=>
    String(l.date)+
    (l.time
      ?'T'+String(l.time).slice(0,5)
      :'T23:59');

  const allLessons=st.ls.slice().sort(
    (a,b)=>lessonKey(a).localeCompare(lessonKey(b))
  );

  const topups=payments
    .filter(p=>p.student===s.name)
    .sort(
      (a,b)=>String(b.date).localeCompare(String(a.date))
    );

  const lessonsHtml=allLessons.length
    ?allLessons.map(l=>{
      const now=new Date();

      const past=
        String(l.date)<today||
        (
          String(l.date)===today&&
          String(l.time||'23:59').slice(0,5)<
          String(now.getHours()).padStart(2,'0')+
          ':'+
          String(now.getMinutes()).padStart(2,'0')
        );

      const statusText=
        studentLessonStatusText(l,s);

      const statusCls=
        studentLessonStatusClass(l,s);

      return '<div class="flex justify-between items-center gap-3 border-b border-slate-200 py-2 '+
        (
          [
            'rescheduled',
            'cancelled_charge',
            'cancelled_free'
          ].includes(l.status)
            ?'line-through opacity-60'
            :''
        )+
        '" data-lesson-date="'+esc(l.date)+
        '" data-lesson-time="'+
        esc(String(l.time||'23:59').slice(0,5))+
        '"><div><span>'+
        esc(l.date)+
        (
          l.time
            ?' · '+esc(displayTime(l.time))
            :''
        )+
        '</span>'+
        (
          l.comment
            ?'<div class="text-xs text-slate-500 mt-1 no-underline" style="text-decoration:none">'+
              esc(l.comment)+
              '</div>'
            :''
        )+
        '</div><div class="relative shrink-0">'+

        (
          past
            ?'<button type="button" onclick="event.stopPropagation();toggleStudentAttendanceMenu(\''+
              esc(l.id)+'-'+esc(s.id)+
              '\')" class="status '+statusCls+
              ' cursor-pointer hover:opacity-80">'+
              esc(statusText)+
              '</button>'+

              '<div id="student-attendance-menu-'+
              esc(l.id)+'-'+esc(s.id)+
              '" class="student-attendance-menu hidden absolute right-0 top-full mt-1 z-30 bg-white border rounded-xl shadow-xl p-1 w-64">'+

              '<button type="button" class="block w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 text-xs" onclick="setStudentAttendance(\''+
              esc(l.id)+'\',\''+
              esc(s.id)+
              '\',\'conducted\')">Проведено</button>'+

              '<button type="button" class="block w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 text-xs" onclick="setStudentAttendance(\''+
              esc(l.id)+'\',\''+
              esc(s.id)+
              '\',\'cancelled_charge\')">Не посетил, списать оплату</button>'+

              '<button type="button" class="block w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 text-xs" onclick="setStudentAttendance(\''+
              esc(l.id)+'\',\''+
              esc(s.id)+
              '\',\'cancelled_free\')">Не посетил, не списывать оплату</button>'+

              '</div>'

            :'<span class="status '+
              statusCls+
              '">'+
              esc(statusText)+
              '</span>'
        )+
        '</div></div>';

    }).join('')

    :'<span class="text-slate-400">Занятий нет</span>';

  return '<div class="space-y-2 text-sm mb-4">'+

    '<div><span class="text-slate-400">Внесено</span><br><b>'+
    money(st.income)+
    '</b></div>'+

    '<div><span class="text-slate-400">Списано</span><br><b>'+
    money(st.expenses)+
    '</b></div>'+

    '<div><span class="text-slate-400">Баланс</span><br><b>'+
    money(st.bal)+
    '</b></div>'+

    '</div>'+

    '<div class="grid grid-cols-2 gap-2 text-sm mb-4">'+

    '<div><span class="text-slate-400">Проведенных занятий</span><br><b>'+
    st.ls.filter(
      l=>l.status==='conducted'
    ).length+
    '</b></div>'+

    '<div><span class="text-slate-400">Стоимость за занятие</span><br><b>'+
    money(s.price||0)+
    '</b></div>'+

    '</div>'+

    '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">'+

    '<div>'+

    '<div class="flex items-center justify-between mb-2">'+
    '<h4 class="font-semibold">Пополнения</h4>'+

    '<button onclick="openStudentPayment(\''+
    esc(s.id)+
    '\')" class="text-xs font-semibold text-indigo-700 hover:underline">Внести оплату</button>'+

    '</div>'+

    '<div class="teacher-detail-list space-y-1 text-sm">'+

    (
      topups.map(p=>
        '<div class="flex justify-between border-b border-slate-200 py-1">'+
        '<span>'+
        esc(p.date)+
        '</span>'+

        '<b class="text-emerald-600">+'+
        money(p.amount)+
        '</b>'+

        '</div>'
      ).join('')||

      '<span class="text-slate-400">Пополнений нет</span>'
    )+

    '</div>'+

    '</div>'+

    '</div>'+

    '<div class="mt-5">'+
    '<h4 class="font-semibold mb-2">Все занятия</h4>'+

    '<div id="student-lessons-'+
    esc(s.id)+
    '" class="student-lessons-scroll teacher-detail-list space-y-1 text-sm border-t border-slate-200 pt-2">'+
    lessonsHtml+
    '</div>'+

    '</div>'+

    '</div>';
}

function toggleStudentDetail(id){
  const e=document.getElementById('detail-'+id);

  e?.classList.toggle('hidden');

  if(!e?.classList.contains('hidden')){
    requestAnimationFrame(
      ()=>scrollStudentLessonsToNearest(id)
    );
  }
}

function toggleStudentMenu(id){
  document.querySelectorAll('[id^="menu-"]').forEach(x=>{
    if(x.id!=='menu-'+id){
      x.classList.add('hidden');
    }
  });

  document
    .getElementById('menu-'+id)
    ?.classList.toggle('hidden');
}

async function openStudentEdit(id){
  const s=students.find(
    x=>String(x.id)===String(id)
  );

  if(!s)return;

  document.getElementById('student-edit-id').value=id;
  document.getElementById('student-edit-name').value=s.name;
  document.getElementById('student-edit-email').value=s.email||'';
  document.getElementById('student-edit-telegram').value=s.telegram||'';
  document.getElementById('student-edit-price').value=
    String(s.price??40);

  showModal('student-modal');
}

async function saveStudent(){
  try{
    const id=
      document.getElementById('student-edit-id').value;

    const s=students.find(
      x=>String(x.id)===String(id)
    );

    const name=
      document.getElementById('student-edit-name')
      .value.trim();

    const email=
      document.getElementById('student-edit-email')
      .value.trim()||null;

    const telegram=
      document.getElementById('student-edit-telegram')
      .value.trim()||null;

    const price=
      Number(
        document.getElementById('student-edit-price').value
      );

    if(!s||!name)return;

    const old=s.name;

    if(old!==name){
      await db(
        '/lessons?student=eq.'+
        encodeURIComponent(old),
        {
          method:'PATCH',
          headers:{
            ...headers,
            Prefer:'return=minimal'
          },
          body:JSON.stringify({
            student:name
          })
        }
      );

      await db(
        '/payments?student=eq.'+
        encodeURIComponent(old),
        {
          method:'PATCH',
          headers:{
            ...headers,
            Prefer:'return=minimal'
          },
          body:JSON.stringify({
            student:name
          })
        }
      );
    }

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
          name,
          price,
          email,
          telegram
        })
      }
    );

    closeModal('student-modal');

    await loadData();
    renderStudents();

  }catch(e){
    showError(e);
  }
}
async function copyStudentLink(id){
  const url=new URL(location.href);
  url.search='';
  url.searchParams.set('student',id);

  try{
    await navigator.clipboard.writeText(url.toString());
    alert('Ссылка для ученика скопирована.');
  }catch(e){
    prompt('Скопируйте ссылку:',url.toString());
  }
}

async function toggleArchive(id){
  const s=students.find(x=>String(x.id)===String(id));
  if(!s)return;

  try{
    await db(
      '/students?id=eq.'+encodeURIComponent(id),
      {
        method:'PATCH',
        headers:{...headers,Prefer:'return=minimal'},
        body:JSON.stringify({archived:!s.archived})
      }
    );

    await loadData();
    renderStudents();
  }catch(e){
    showError(e);
  }
}

async function removeStudent(id){
  const s=students.find(x=>String(x.id)===String(id));
  if(!s)return;

  const ok=confirm(
    'Вы уверены, что хотите удалить ученика '+s.name+
    '? Все прошедшие и будущие занятия, информация об оплатах будет удалена.'
  );

  if(!ok)return;

  try{
    for(const l of lessons.filter(x=>x.student===s.name)){
      await db(
        '/lessons?id=eq.'+encodeURIComponent(l.id),
        {
          method:'DELETE',
          headers
        }
      );
    }

    for(const p of payments.filter(x=>x.student===s.name)){
      await db(
        '/payments?id=eq.'+encodeURIComponent(p.id),
        {
          method:'DELETE',
          headers
        }
      );
    }

    await db(
      '/students?id=eq.'+encodeURIComponent(id),
      {
        method:'DELETE',
        headers
      }
    );

    await loadData();
    renderStudents();
  }catch(e){
    showError(e);
  }
}

function renderGroups(){
  const c=document.getElementById('groups-list');

  c.innerHTML=groups.length
    ?groups.map(g=>{
      const members=students.filter(
        s=>!s.archived&&
        String(s.group_id)===String(g.id)
      );

      const total=members.reduce(
        (a,s)=>a+studentStats(s).bal,
        0
      );

      const memberHtml=members.length
        ?members.map(s=>{
          const st=studentStats(s);

          return '<div class="flex justify-between items-center py-2">'+
            '<span class="font-medium">'+
            esc(s.name)+
            ' <span class="text-xs text-slate-500">'+
            money(s.price??40)+
            ' ('+
            money(st.bal)+
            ')</span></span>'+
            '<button onclick="removeFromGroup(\''+
            esc(g.id)+'\',\''+
            esc(s.id)+
            '\')" class="text-xs text-red-600">Убрать</button>'+
            '</div>';
        }).join('')

        :'<div class="flex items-center justify-between gap-3">'+
          '<span class="text-sm text-slate-400">Учеников в группе пока нет</span>'+
          '<button onclick="event.stopPropagation();addStudentToGroup(\''+
          esc(g.id)+
          '\')" class="shrink-0 px-3 py-2 rounded-xl bg-purple-50 text-purple-700 text-xs font-semibold hover:bg-purple-100">+ Добавить ученика</button>'+
          '</div>';

      return '<div class="border rounded-2xl overflow-hidden">'+
        '<button onclick="toggleGroup(\''+
        esc(g.id)+
        '\')" class="w-full p-3 flex justify-between items-center hover:bg-slate-50">'+
        '<span class="font-semibold">'+
        esc(g.name)+
        '</span>'+
        '<span class="text-sm font-bold px-2 py-1 rounded-lg '+
        balanceClass(total)+
        '">'+
        money(total)+
        '</span>'+
        '</button>'+

        '<div id="group-'+
        esc(g.id)+
        '" class="hidden border-t bg-slate-50 p-3">'+
        memberHtml+
        '</div>'+
        '</div>';
    }).join('')

    :'<div class="text-sm text-slate-400">Групп пока нет</div>';
}

function addStudentToGroup(groupId){
  const group=groups.find(
    g=>String(g.id)===String(groupId)
  );

  if(!group)return;

  const available=students
    .filter(
      s=>!s.archived&&
      String(s.group_id)!==String(groupId)
    )
    .sort(
      (a,b)=>String(a.name||'').localeCompare(
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
  ).textContent='Добавить ученика в группу';

  f.innerHTML=available.length
    ?'<div class="text-sm text-slate-500 mb-2">'+
      esc(group.name)+
      '</div>'+
      '<div class="max-h-80 overflow-y-auto space-y-1">'+
      available.map(s=>
        '<button onclick="confirmStudentToGroup(\''+
        esc(groupId)+'\',\''+
        esc(s.id)+
        '\')" class="w-full text-left px-3 py-3 rounded-xl hover:bg-purple-50 flex justify-between items-center">'+
        '<span>'+
        esc(s.name)+
        '</span>'+
        '<span class="text-xs text-slate-400">Добавить</span>'+
        '</button>'
      ).join('')+
      '</div>'

    :'<div class="text-sm text-slate-400 py-4 text-center">Нет доступных учеников</div>';

  showModal('group-choice-modal');
}

async function confirmStudentToGroup(groupId,studentId){
  try{
    await db(
      '/students?id=eq.'+
      encodeURIComponent(studentId),
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

    closeModal('group-choice-modal');

    await loadData();
    renderStudents();
  }catch(e){
    showError(e);
  }
}

function toggleGroup(id){
  document
    .getElementById('group-'+id)
    ?.classList.toggle('hidden');
}

function openAdd(type){
  showModal('add-modal');
  showAddForm(type||'student');
}

function showAddForm(type){
  const c=document.getElementById('add-form');

  if(type==='student'){
    c.innerHTML=`<div class="space-y-3">
      <input id="add-student-name" class="soft-input w-full rounded-xl px-3 py-2" placeholder="Имя">

      <input id="add-student-email" type="email" class="soft-input w-full rounded-xl px-3 py-2" placeholder="Email (необязательно)">

      <input id="add-student-telegram" class="soft-input w-full rounded-xl px-3 py-2" placeholder="Telegram (необязательно)">

      <label class="text-sm font-semibold">Группа
        <select id="add-student-group" class="soft-input mt-1 w-full rounded-xl px-3 py-2">
          <option value="">без группы</option>
          ${groups.map(g=>
            `<option value="${esc(g.id)}">${esc(g.name)}</option>`
          ).join('')}
        </select>
      </label>

      <button onclick="addStudent()" class="primary-btn w-full rounded-xl py-2 font-semibold">
        Добавить
      </button>
    </div>`;
  }

  if(type==='group'){
    c.innerHTML=`<div class="space-y-3">
      <input id="add-group-name" class="soft-input w-full rounded-xl px-3 py-2" placeholder="Название группы">

      <button onclick="addGroup()" class="primary-btn w-full rounded-xl py-2 font-semibold">
        Создать группу
      </button>
    </div>`;
  }

  if(type==='payment'){
    fillStudentSelects();

    c.innerHTML=`<div class="space-y-3">
      <select id="add-payment-student" class="soft-input w-full rounded-xl px-3 py-2"></select>

      <input id="add-payment-amount" type="number" step="0.01" class="soft-input w-full rounded-xl px-3 py-2" placeholder="Сумма">

      <input id="add-payment-date" type="date" value="${localISO(new Date())}" class="soft-input w-full rounded-xl px-3 py-2">

      <button onclick="addPayment()" class="primary-btn w-full rounded-xl py-2 font-semibold">
        Внести платеж
      </button>
    </div>`;

    fillStudentSelects();
  }
}

async function addStudent(){
  try{
    const name=document
      .getElementById('add-student-name')
      .value.trim();

    const email=document
      .getElementById('add-student-email')
      ?.value.trim()||null;

    const telegram=document
      .getElementById('add-student-telegram')
      ?.value.trim()||null;

    const gid=document
      .getElementById('add-student-group')
      .value;

    if(!name){
      return showError(
        new Error('Введите имя')
      );
    }

    const {
      data: { user },
      error: userError
    } = await supabaseClient.auth.getUser();

    if(userError || !user){
      throw new Error(
        'Пользователь не авторизован'
      );
    }

    await db(
      '/students',
      {
        method:'POST',
        headers:{
          ...headers,
          Prefer:'return=minimal'
        },
        body:JSON.stringify({
          name,
          price:40,
          group_id:gid||null,
          archived:false,
          email,
          telegram,
          teacher_id:user.id
        })
      }
    );

    closeModal('add-modal');

    await loadData();
    renderStudents();

  }catch(e){
    showError(e);
  }
}

async function addGroup(){
  const name=document
    .getElementById('add-group-name')
    .value.trim();

  if(!name)return;

  try{
    await db(
      '/groups',
      {
        method:'POST',
        headers:{
          ...headers,
          Prefer:'return=minimal'
        },
        body:JSON.stringify({name})
      }
    );

    closeModal('add-modal');

    await loadData();
    renderStudents();
  }catch(e){
    showError(e);
  }
}

function addToGroup(id){
  if(!groups.length){
    return alert('Сначала создайте группу');
  }

  const f=document.getElementById(
    'group-choice-form'
  );

  f.innerHTML=
    '<label class="text-sm font-semibold">Группа'+
    '<select id="choose-group" class="soft-input mt-1 w-full rounded-xl px-3 py-3">'+
    groups.map(g=>
      '<option value="'+
      esc(g.id)+
      '">'+
      esc(g.name)+
      '</option>'
    ).join('')+
    '</select></label>'+

    '<div class="flex gap-2 mt-4">'+

    '<button onclick="closeModal(\'group-choice-modal\')" class="flex-1 px-4 py-3 rounded-xl bg-slate-100">Отмена</button>'+

    '<button onclick="confirmAddToGroup(\''+
    id+
    '\')" class="flex-1 primary-btn rounded-xl py-3 font-semibold">Добавить</button>'+

    '</div>';

  showModal('group-choice-modal');
}

async function confirmAddToGroup(id){
  const gid=document
    .getElementById('choose-group')
    ?.value;

  if(!gid)return;

  try{
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
          group_id:gid
        })
      }
    );

    closeModal('group-choice-modal');

    await loadData();
    renderStudents();
  }catch(e){
    showError(e);
  }
}

async function removeFromGroup(gid,sid){
  try{
    await db(
      '/students?id=eq.'+
      encodeURIComponent(sid),
      {
        method:'PATCH',
        headers:{
          ...headers,
          Prefer:'return=minimal'
        },
        body:JSON.stringify({
          group_id:null
        })
      }
    );

    await loadData();
    renderStudents();
  }catch(e){
    showError(e);
  }
}

function openStudentPayment(id){
  const s=students.find(
    x=>String(x.id)===String(id)
  );

  if(!s)return;

  document.getElementById(
    'student-payment-id'
  ).value=s.id;

  document.getElementById(
    'student-payment-name'
  ).textContent=s.name;

  document.getElementById(
    'student-payment-amount'
  ).value='';

  showModal('student-payment-modal');

  setTimeout(
    ()=>document
      .getElementById('student-payment-amount')
      ?.focus(),
    50
  );
}

async function saveStudentPayment(){
  try{
    const id=document
      .getElementById('student-payment-id')
      .value;

    const raw=document
      .getElementById('student-payment-amount')
      .value.trim();

    const amount=Number(raw);

    const s=students.find(
      x=>String(x.id)===String(id)
    );

    if(
      !s||
      raw===''||
      !Number.isFinite(amount)||
      amount===0
    ){
      return showError(
        new Error(
          'Введите сумму, отличную от нуля'
        )
      );
    }

    await db(
      '/payments',
      {
        method:'POST',
        headers:{
          ...headers,
          Prefer:'return=minimal'
        },
        body:JSON.stringify({
          student:s.name,
          amount,
          date:localISO(new Date())
        })
      }
    );

    closeModal('student-payment-modal');

    await loadData();
    renderStudents();

    document
      .getElementById('detail-'+id)
      ?.classList.remove('hidden');

  }catch(e){
    showError(e);
  }
}

async function addPayment(){
  try{
    const student=document
      .getElementById('add-payment-student')
      .value;

    const amount=Number(
      document
        .getElementById('add-payment-amount')
        .value
    );

    const date=document
      .getElementById('add-payment-date')
      .value;

    if(!student||!amount||!date){
      return showError(
        new Error('Заполните данные платежа')
      );
    }

    await db(
      '/payments',
      {
        method:'POST',
        headers:{
          ...headers,
          Prefer:'return=minimal'
        },
        body:JSON.stringify({
          student,
          amount,
          date
        })
      }
    );

    closeModal('add-modal');

    await loadData();
    renderStudents();

  }catch(e){
    showError(e);
  }
}
