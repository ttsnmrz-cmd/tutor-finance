function studentStats(s){
  const groupLessonIds=new Set(
    lessonMembers
      .filter(m=>String(m.student_id)===String(s.id))
      .map(m=>String(m.lesson_id))
  );

  const ls=lessons.filter(
    l=>(!l.group_id&&String(l.student_id||'')===String(s.id))||groupLessonIds.has(String(l.id))
  );

  const income=payments
    .filter(p=>String(p.student_id||'')===String(s.id))
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

let nativeStudentListMode='students';
function switchNativeListTab(mode){
  nativeStudentListMode=mode==='groups'?'groups':'students';
  const studentsPanel=document.querySelector('#tab-students .native-students-panel');
  const groupsPanel=document.querySelector('#tab-students .native-groups-panel');
  studentsPanel?.classList.toggle('native-show-groups',nativeStudentListMode==='groups');
  groupsPanel?.classList.toggle('hidden',nativeStudentListMode!=='groups');
  document.getElementById('students-list')?.classList.toggle('hidden',nativeStudentListMode==='groups');
  const sort=document.querySelector('#tab-students .student-sort-wrap');
  sort?.classList.toggle('hidden',nativeStudentListMode==='groups');
  document.getElementById('native-tab-individual')?.classList.toggle('is-active',nativeStudentListMode==='students');
  document.getElementById('native-tab-groups')?.classList.toggle('is-active',nativeStudentListMode==='groups');
}
let nativeSelectedStudentId=null;
function renderStudents(){
  renderGroups();

  const show=false;
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
  if(!active.some(s=>String(s.id)===String(nativeSelectedStudentId)))nativeSelectedStudentId=active[0]?.id||null;
  renderNativeStudentDetail();
  switchNativeListTab(nativeStudentListMode);
}

function studentRow(s){
  const st=studentStats(s);
  const g=studentGroup(s.id);
  const isArchived=!!s.archived;
  const id=String(s.id);

  return `<div class="native-student-row border rounded-2xl overflow-hidden mb-2 ${isArchived?'opacity-60':''} ${String(nativeSelectedStudentId)===id?'is-selected':''}" data-student-id="${esc(id)}">
    <div onclick="toggleStudentDetail('${esc(id)}')" class="p-4 flex items-center gap-3 cursor-pointer hover:bg-slate-50">
      <div class="flex-1 min-w-0">
        <div class="font-semibold">${esc(s.name)}</div>
        <div class="text-xs text-slate-400">${esc(g?.name||'без группы')}${isArchived?' · архив':''}</div>
      </div>

      <div class="px-3 py-2 rounded-xl font-bold text-sm ${balanceClass(st.bal)}">
        ${money(st.bal)}
      </div>


    </div>

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
  const now=dateTimePartsInTimezone(new Date(),getTeacherTimezone());
  const lessonDate=String(l.date||'');
  const lessonTime=String(l.time||'23:59').slice(0,5);
  const isFuture=lessonDate>now.date||(lessonDate===now.date&&lessonTime>=now.time);

  if(a==='cancelled_charge')return isFuture?'Отменено — списать':'Не посетил, списать оплату';
  if(a==='cancelled_free')return isFuture?'Отменено — не списывать':'Не посетил, не списывать оплату';
  return statusLabels[l.status]||l.status;
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
    renderWeek();
    renderDay();

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
    .filter(p=>String(p.student_id||'')===String(s.id))
    .sort(
      (a,b)=>String(a.date).localeCompare(String(b.date))
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

            :'<button type="button" onclick="openEditLesson(\''+
              esc(l.id)+
              '\')" class="status '+statusCls+
              ' cursor-pointer hover:opacity-80" title="Редактировать занятие">'+
              esc(statusText)+
              '</button>'
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

    '<button type="button" onclick="openStudentPayment(\''+
    esc(s.id)+
    '\')" class="primary-btn inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold shadow-sm hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"><span aria-hidden="true" class="text-base leading-none">＋</span><span>Внести оплату</span></button>'+

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

let nativeStudentDetailTab='overview';
let nativeLessonDateFilter='all';
let nativeLessonStatusFilter='all';
function nativeStudentLessonRows(s,limit=Infinity,applyFilters=true){
  const st=studentStats(s);
  const sorted=st.ls.slice().sort((a,b)=>(String(b.date||'')+' '+String(b.time||'')).localeCompare(String(a.date||'')+' '+String(a.time||'')));
  const today=localISO(new Date());
  const filtered=sorted.filter(l=>{
    if(!applyFilters)return String(l.date||'')<=today;
    if(nativeLessonDateFilter==='past'&&String(l.date)>today)return false;
    if(nativeLessonDateFilter==='upcoming'&&String(l.date)<today)return false;
    if(nativeLessonStatusFilter!=='all'&&l.status!==nativeLessonStatusFilter)return false;
    return true;
  });
    return filtered.slice(0,limit).map(l=>'<button type="button" data-lesson-id="'+esc(l.id)+'" class="native-history-row" onclick="openEditLesson(\''+esc(l.id)+'\')"><span>'+esc(l.date)+' · '+esc(displayTime(l.time||''))+'</span><span>'+esc(l.comment||'—')+'</span><span class="native-history-status '+esc(studentLessonStatusClass(l,s))+'">'+esc(studentLessonStatusText(l,s))+'</span><strong>'+money(l.group_id?Number(lessonMembers.find(m=>String(m.lesson_id)===String(l.id)&&String(m.student_id)===String(s.id))?.price??s.price??0):Number(l.price||0))+'</strong></button>').join('')||'<p class="native-history-empty">Занятий нет</p>';
}
function nativeStudentPaymentRows(s,limit=Infinity){
  const items=payments.filter(p=>String(p.student_id||'')===String(s.id)).slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  return items.slice(0,limit).map(p=>'<div class="native-history-row"><span>'+esc(p.date)+'</span><span></span><span></span><strong class="text-emerald-600">+'+money(p.amount)+'</strong></div>').join('')||'<p class="native-history-empty">Платежей нет</p>';
}
function renderNativeStudentDetail(){
  const panel=document.getElementById('native-student-detail');
  if(!panel)return;
  const s=students.find(x=>String(x.id)===String(nativeSelectedStudentId));
  document.querySelectorAll('.native-student-row').forEach(row=>row.classList.toggle('is-selected',row.dataset.studentId===String(nativeSelectedStudentId)));
  if(!s){panel.innerHTML='<div class="native-student-empty">Выберите ученика</div>';return;}
  const st=studentStats(s);
  const id=esc(s.id);
  const tabs=[['overview','Overview'],['lessons','Lessons'],['notes',document.documentElement.lang==='ru'?'Заметки':'Notes'],['payments','Payments'],['homework','Homework']];
  const head='<div class="native-selected-heading"><div class="native-student-identity"><span class="native-student-avatar">'+esc((s.name||'?').charAt(0).toUpperCase())+'</span><div><h2>'+esc(s.name)+'</h2><p>'+esc(studentGroup(s.id)?.name||'Individual student')+'</p></div></div><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><button type="button" class="native-add-button" onclick="copyStudentLink(\''+id+'\',this)" title="Copy student cabinet link">⧉ Student link</button><div class="student-menu-wrap relative"><button type="button" class="native-student-edit" onclick="event.stopPropagation();toggleStudentMenu(\''+id+'\')" title="Student actions" aria-label="Student actions">✎</button><div id="menu-'+id+'" class="hidden absolute right-0 top-full z-30 bg-white border rounded-2xl shadow-xl p-2 w-56" style="min-width:220px"><button class="block w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100" onclick="openStudentEdit(\''+id+'\',\'general\')">Edit student&#39;s info</button><button class="block w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100" onclick="openStudentEdit(\''+id+'\',\'telegram\')">Edit Telegram settings</button><button class="block w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100" onclick="this.parentElement.classList.add(\'hidden\');addToGroup(\''+id+'\')">Add to group</button><button class="block w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100" onclick="this.parentElement.classList.add(\'hidden\');toggleArchive(\''+id+'\')">'+(s.archived?'Restore from archive':'Archive')+'</button><button class="block w-full text-left px-3 py-2 rounded-xl hover:bg-red-50 text-red-600" onclick="this.parentElement.classList.add(\'hidden\');removeStudent(\''+id+'\')">Delete student</button></div></div></div></div>';
  const nav='<div class="native-detail-tabs">'+tabs.map(([key,label])=>'<button type="button" class="'+(nativeStudentDetailTab===key?'is-active':'')+'" onclick="switchNativeStudentTab(\''+key+'\',this)">'+label+'</button>').join('')+'</div>';
  let content='';
  if(nativeStudentDetailTab==='overview'){
    content='<div class="native-overview-section"><div class="native-section-heading"><h3>Recent lessons</h3><button onclick="switchNativeStudentTab(\'lessons\')" aria-label="View all records">View all <span aria-hidden="true">→</span></button></div>'+nativeStudentLessonRows(s,3,false)+'</div><div class="native-overview-section"><div class="native-section-heading"><h3>Recent payments</h3><button onclick="switchNativeStudentTab(\'payments\')" aria-label="View all records">View all <span aria-hidden="true">→</span></button></div>'+nativeStudentPaymentRows(s,3)+'</div>';
  }else if(nativeStudentDetailTab==='lessons'){
    content='<div class="native-lesson-filters"><select aria-label="Filter lesson dates" onchange="nativeLessonDateFilter=this.value;renderNativeStudentDetail()"><option value="all" '+(nativeLessonDateFilter==='all'?'selected':'')+'>All dates</option><option value="past" '+(nativeLessonDateFilter==='past'?'selected':'')+'>Past</option><option value="upcoming" '+(nativeLessonDateFilter==='upcoming'?'selected':'')+'>Upcoming</option></select><select aria-label="Filter lesson status" onchange="nativeLessonStatusFilter=this.value;renderNativeStudentDetail()">'+[['all','All statuses'],['scheduled','Scheduled'],['conducted','Completed'],['rescheduled','Rescheduled'],['cancelled_charge','Cancelled · charged'],['cancelled_free','Cancelled · free']].map(([v,t])=>'<option value="'+v+'" '+(nativeLessonStatusFilter===v?'selected':'')+'>'+t+'</option>').join('')+'</select></div><div class="native-history-scroll">'+nativeStudentLessonRows(s)+'</div>';
  }else if(nativeStudentDetailTab==='homework'){
    content='<div id="native-homework-panel">Loading…</div>';
  }else if(nativeStudentDetailTab==='notes'){
    content='<div id="native-live-notes"></div>';
  }else{
    content='<div class="native-section-heading"><h3>Payments</h3><button class="native-add-button" onclick="openStudentPayment(\''+id+'\')">+ Add payment</button></div><div class="native-history-scroll">'+nativeStudentPaymentRows(s)+'</div>';
  }
  const persistentStats='<div class="native-student-stats"><div><span>Balance</span><strong>'+money(st.bal)+'</strong></div><div><span>Payments received</span><strong>'+money(st.income)+'</strong></div><div><span>Amount charged</span><strong>'+money(st.expenses)+'</strong></div><div><span>Lessons</span><strong>'+st.ls.length+'</strong></div></div>';
  panel.innerHTML=head+persistentStats+nav+'<div class="native-detail-body">'+content+'</div>';
  if(nativeStudentDetailTab==='lessons'&&nativeLessonDateFilter==='all'&&nativeLessonStatusFilter==='all'){
    const today=localISO(new Date());
    const last=st.ls.filter(l=>String(l.date||'')<=today&&['conducted','completed','cancelled_charge','cancelled_free'].includes(String(l.status||'').toLowerCase())).sort((a,b)=>(String(b.date||'')+' '+String(b.time||'')).localeCompare(String(a.date||'')+' '+String(a.time||'')))[0];
    const scroller=panel.querySelector('.native-history-scroll');
    const row=last&&Array.from(scroller?.querySelectorAll('[data-lesson-id]')||[]).find(el=>el.dataset.lessonId===String(last.id));
    if(row&&scroller)scroller.scrollTop=Math.max(0,row.offsetTop-scroller.offsetTop);
  }
  if(nativeStudentDetailTab==='homework')renderNativeHomework(s.id);
  if(nativeStudentDetailTab==='notes'&&typeof renderNativeLessonNotes==='function')renderNativeLessonNotes(s);
}
function switchNativeStudentTab(tab){
  nativeStudentDetailTab=['overview','lessons','notes','payments','homework'].includes(tab)?tab:'overview';
  renderNativeStudentDetail();
}
function toggleStudentDetail(id){
  nativeSelectedStudentId=id;
  nativeStudentDetailTab='overview';
  renderNativeStudentDetail();
}

// Close student/group action menus when clicking anywhere outside them.
if(!window.__profiActionMenuOutsideHandler){
  window.__profiActionMenuOutsideHandler=true;
  document.addEventListener('click',event=>{
    if(event.target.closest('.student-menu-wrap, .group-menu-wrap, .student-sort-wrap'))return;
    document.querySelectorAll('[id^="menu-"], [id^="group-menu-"]').forEach(menu=>menu.classList.add('hidden'));
    document.getElementById('student-sort-menu')?.classList.add('hidden');
    document.querySelectorAll('.group-card').forEach(card=>card.classList.remove('z-40'));
  });
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

function ensureStudentMeetField(){
 if(document.getElementById('student-edit-meet'))return;
 const price=document.getElementById('student-edit-price');
 if(!price)return;
 const label=document.createElement('label');label.className='text-sm font-semibold';label.textContent='Google Meet';
 const input=document.createElement('input');input.id='student-edit-meet';input.type='url';input.className='soft-input mt-1 w-full rounded-xl px-3 py-2';input.placeholder='https://meet.google.com/abc-defg-hij';
 label.append(input);price.closest('label').after(label);
}
async function openStudentEdit(id,tab='general'){
  const s=students.find(
    x=>String(x.id)===String(id)
  );

  if(!s)return;

  document.getElementById('student-edit-id').value=id;
  document.getElementById('student-edit-name').value=s.name;
  document.getElementById('student-edit-email').value=s.email||'';
  ensureStudentMeetField();
  document.getElementById('student-edit-meet').value=s.google_meet_url||'';
  document.getElementById('student-edit-telegram').value=s.telegram||'';
  document.getElementById('student-edit-price').value=
    String(s.price??40);
  const timezoneSelect=document.getElementById('student-edit-timezone');
  if(timezoneSelect)timezoneSelect.value=s.timezone||'Europe/Minsk';

  document.getElementById('student-notify-1h').checked=s.telegram_notify_1h!==false;
  document.getElementById('student-notify-10m').checked=s.telegram_notify_10m!==false;
  document.getElementById('student-notify-changes').checked=s.telegram_notify_changes===true;
  document.getElementById('student-notify-payments').checked=s.telegram_notify_payments===true;
  document.getElementById('student-notify-balance').checked=s.telegram_notify_balance!==false;

  const connected=!!s.telegram_chat_id;
  const status=document.getElementById('student-telegram-status');
  if(status){
    status.textContent=connected?'Telegram подключён':'Telegram не подключён';
    status.className='text-sm font-semibold '+(connected?'text-emerald-600':'text-amber-600');
  }

  const linkButton=document.getElementById('student-telegram-link-button');
  if(linkButton){
    linkButton.disabled=!s.telegram_link_token;
    linkButton.classList.toggle('opacity-50',!s.telegram_link_token);
  }

  switchStudentSettingsTab(tab);
  const modal=document.getElementById('student-modal');
  modal?.querySelectorAll('[data-student-settings-tab]').forEach(button=>button.style.display='none');
  const heading=modal?.querySelector('h2,h3');if(heading)heading.textContent=tab==='telegram'?'Edit Telegram settings':"Edit student's info";
  document.querySelectorAll('[id^="menu-"]').forEach(m=>m.classList.add('hidden'));
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
    const timezone=document.getElementById('student-edit-timezone')?.value||'Europe/Minsk';

    const telegram_notify_1h=document.getElementById('student-notify-1h').checked;
    const telegram_notify_10m=document.getElementById('student-notify-10m').checked;
    const telegram_notify_changes=document.getElementById('student-notify-changes').checked;
    const telegram_notify_payments=document.getElementById('student-notify-payments').checked;
    const telegram_notify_balance=document.getElementById('student-notify-balance').checked;

    if(!s||!name)return;

    const google_meet_url=document.getElementById('student-edit-meet').value.trim()||null;
    if(google_meet_url&&!/^https:\/\/meet\.google\.com\/[a-zA-Z0-9_-]+(?:\?[^\s#]*)?$/.test(google_meet_url)){switchStudentSettingsTab('general');alert(document.documentElement.lang==='en'?'Enter a valid Google Meet link.':'Введите корректную ссылку Google Meet.');return;}
    const oldPrice=Number(s.price??40);
    const priceChanged=Number.isFinite(price)&&price!==oldPrice;
    const updateFuturePrices=priceChanged&&confirm(
      'Стоимость занятия изменена: '+oldPrice+' → '+price+'.\n\nИзменить стоимость уже созданных будущих занятий для этого ученика?\n\nНажмите «ОК», чтобы обновить расписание, или «Отмена», чтобы новая цена применялась только к новым занятиям.'
    );

    const old=s.name;

    if(old!==name){
      // Update display snapshots only for records linked to this exact student ID.
      await db('/lessons?student_id=eq.'+encodeURIComponent(id),{
        method:'PATCH',headers:{...headers,Prefer:'return=minimal'},
        body:JSON.stringify({student:name})
      });
      await db('/payments?student_id=eq.'+encodeURIComponent(id),{
        method:'PATCH',headers:{...headers,Prefer:'return=minimal'},
        body:JSON.stringify({student:name})
      });
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
          telegram,
          google_meet_url,
          telegram_notify_1h,
          telegram_notify_10m,
          telegram_notify_changes,
          telegram_notify_payments,
          telegram_notify_balance,
          timezone
        })
      }
    );

    if(updateFuturePrices){
      const today=localISO(new Date());
      const futureLessons=lessons.filter(l=>String(l.date||'')>=today);

      // Update individual lessons belonging to this student.
      const individualLessons=futureLessons.filter(l=>
        !l.group_id&&String(l.student_id)===String(id)
      );
      for(const lesson of individualLessons){
        await db('/lessons?id=eq.'+encodeURIComponent(lesson.id),{
          method:'PATCH',
          headers:{...headers,Prefer:'return=minimal'},
          body:JSON.stringify({price})
        });
      }

      // Update only this student's price snapshot in future group lessons,
      // then recalculate each group total from all member snapshots.
      const memberRows=lessonMembersForStudent(id);
      const futureGroupIds=new Set(futureLessons.filter(l=>l.group_id).map(l=>String(l.id)));
      const futureMemberships=memberRows.filter(m=>futureGroupIds.has(String(m.lesson_id)));
      const affectedGroupLessonIds=new Set();
      for(const member of futureMemberships){
        await db('/lesson_members?id=eq.'+encodeURIComponent(member.id),{
          method:'PATCH',
          headers:{...headers,Prefer:'return=minimal'},
          body:JSON.stringify({price})
        });
        affectedGroupLessonIds.add(String(member.lesson_id));
      }
      for(const lessonId of affectedGroupLessonIds){
        await updateGroupLessonPrice(lessonId);
      }
    }

    closeModal('student-modal');

    await loadData();
    renderStudents();

  }catch(e){
    showError(e);
  }
}

async function copyTelegramStudentLink(id){
  const s=students.find(x=>String(x.id)===String(id));
  if(!s)return;

  if(!s.telegram_link_token){
    alert('Для ученика ещё не создан код подключения Telegram.');
    return;
  }

  const url='https://t.me/ProfiProfitMonitorBot?start='+encodeURIComponent(s.telegram_link_token);
  try{
    await navigator.clipboard.writeText(url);
    alert('Персональная ссылка на подключение Telegram скопирована. Отправь её ученику.');
  }catch(e){
    prompt('Скопируй персональную ссылку на Telegram:',url);
  }
}

async function copyStudentLink(id,button){
  const url=new URL(location.href);
  url.search='';
  url.searchParams.set('student',id);

  try{
    await navigator.clipboard.writeText(url.toString());
    if(button){const old=button.textContent;button.textContent='✓ Copied';setTimeout(()=>{button.textContent=old;},1800);}else alert('Ссылка для ученика скопирована.');
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

  const unlinkedLessons=lessons.filter(x=>!x.group_id&&!x.student_id&&x.student===s.name).length;
  const unlinkedPayments=payments.filter(x=>!x.student_id&&x.student===s.name).length;
  const legacyWarning=unlinkedLessons||unlinkedPayments
    ?'\n\nЕсть старые записи с таким же именем, но без ID ('+
      unlinkedLessons+' занятий, '+unlinkedPayments+' платежей). Они останутся без изменений, чтобы случайно не удалить чужие данные.'
    :'';
  const ok=confirm(
    'Вы уверены, что хотите удалить ученика '+s.name+
    '? Связанные по ID индивидуальные занятия и платежи будут удалены.'+
    legacyWarning
  );

  if(!ok)return;

  try{
    for(const l of lessons.filter(x=>!x.group_id&&String(x.student_id||'')===String(s.id))){
      await db(
        '/lessons?id=eq.'+encodeURIComponent(l.id),
        {
          method:'DELETE',
          headers
        }
      );
    }

    for(const p of payments.filter(x=>String(x.student_id||'')===String(s.id))){
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
        (a,s)=>a+Number(s.price??0),
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

      return '<div class="group-card relative border rounded-2xl overflow-visible">'+
        '<div class="p-3 flex flex-wrap gap-2 justify-between items-center hover:bg-slate-50">'+
        '<button onclick="toggleGroup(\''+
        esc(g.id)+
        '\')" class="min-w-0 flex-1 text-left font-semibold">'+
        esc(g.name)+
        '</button>'+
        '<div class="flex items-center gap-2">'+
        '<span class="text-sm font-bold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700">'+
        '<span class="block text-[10px] font-medium text-emerald-600 leading-tight">Ожидаемый платёж за занятие</span>'+
        '<span>'+money(total)+'</span>'+
        '</span>'+
        '<div class="group-menu-wrap relative">'+
        '<button onclick="event.stopPropagation();toggleGroupMenu(\''+esc(g.id)+'\')" class="w-9 h-9 rounded-xl bg-slate-100 text-xl" title="Действия с группой" aria-label="Действия с группой">⋮</button>'+
        '<div id="group-menu-'+esc(g.id)+'" class="hidden absolute right-0 top-10 z-30 bg-white border rounded-2xl shadow-xl p-2 w-48">'+
        '<button onclick="editGroup(\''+esc(g.id)+'\')" class="block w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100">Изменить название</button>'+
        '<button onclick="deleteGroup(\''+esc(g.id)+'\')" class="block w-full text-left px-3 py-2 rounded-xl hover:bg-red-50 text-red-600">Удалить группу</button>'+
        '</div>'+
        '</div>'+
        '</div>'+
        '</div>'+
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

function toggleGroupMenu(id){
  document.querySelectorAll('[id^="group-menu-"]').forEach(menu=>{
    menu.classList.add('hidden');
    menu.closest('.group-card')?.classList.remove('z-40');
  });
  document.querySelectorAll('[id^="menu-"]').forEach(menu=>menu.classList.add('hidden'));
  const menu=document.getElementById('group-menu-'+id);
  if(!menu)return;
  const isOpening=menu.classList.contains('hidden');
  menu.classList.toggle('hidden');
  menu.closest('.group-card')?.classList.toggle('z-40',isOpening);
}

async function editGroup(id){
  const group=groups.find(g=>String(g.id)===String(id));
  if(!group)return;

  const name=prompt('Новое название группы:',group.name||'');
  if(name===null)return;

  const trimmed=name.trim();
  if(!trimmed){
    alert('Название группы не может быть пустым.');
    return;
  }
  if(trimmed===group.name)return;

  try{
    await db('/groups?id=eq.'+encodeURIComponent(id),{
      method:'PATCH',
      headers:{...headers,Prefer:'return=minimal'},
      body:JSON.stringify({name:trimmed})
    });
    await loadData();
    renderStudents();
  }catch(e){
    showError(e);
  }
}

function openAdd(type){
  showModal('add-modal');
  showAddForm(type||'student');
}

function setAddTab(type){
  document.querySelectorAll('.add-tab').forEach(btn=>{
    btn.classList.remove('bg-indigo-600','text-white','shadow-sm');
    btn.classList.add('bg-slate-100','text-slate-600');
  });
  const active=document.getElementById('add-tab-'+type);
  if(active){
    active.classList.remove('bg-slate-100','text-slate-600');
    active.classList.add('bg-indigo-600','text-white','shadow-sm');
  }
}

function showAddForm(type){
  setAddTab(type);
  const c=document.getElementById('add-form');

  if(type==='student'){
    c.innerHTML=`<div class="space-y-3">
      <input id="add-student-name" class="soft-input w-full rounded-xl px-3 py-2" placeholder="Имя">

      <input id="add-student-email" type="email" class="soft-input w-full rounded-xl px-3 py-2" placeholder="Email (необязательно)">

      <input id="add-student-telegram" class="soft-input w-full rounded-xl px-3 py-2" placeholder="Telegram username (необязательно)">

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
      <select id="add-payment-student" required aria-label="Выберите ученика" onchange="document.getElementById('add-payment-submit').disabled=!this.value" class="soft-input w-full rounded-xl px-3 py-2"></select>

      <input id="add-payment-amount" type="number" step="0.01" class="soft-input w-full rounded-xl px-3 py-2" placeholder="Сумма">

      <input id="add-payment-date" type="date" value="${localISO(new Date())}" class="soft-input w-full rounded-xl px-3 py-2">

      <button id="add-payment-submit" disabled onclick="addPayment()" class="primary-btn w-full rounded-xl py-2 font-semibold">
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

    // Free plan: up to 10 active students per teacher.
    const existingStudents=await db(
      '/students?select=id,archived&teacher_id=eq.'+
      encodeURIComponent(user.id)
    );
    const activeStudentCount=(existingStudents||[]).filter(
      student=>student.archived!==true
    ).length;
    if(activeStudentCount>=10){
      throw new Error(
        'В бесплатном тарифе можно добавить до 10 активных учеников. Для большего количества потребуется платный тариф.'
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

async function deleteGroup(id){
  const group=groups.find(g=>String(g.id)===String(id));
  if(!group)return;

  const members=students.filter(s=>String(s.group_id)===String(id));
  if(!confirm('Удалить группу «'+group.name+'»?\n\nУченики останутся в ProfiProfit, но будут отвязаны от группы.'))return;

  try{
    if(members.length){
      await db('/students?group_id=eq.'+encodeURIComponent(id),{
        method:'PATCH',
        headers:{...headers,Prefer:'return=minimal'},
        body:JSON.stringify({group_id:null})
      });
    }

    try{
      await db('/groups?id=eq.'+encodeURIComponent(id),{
        method:'DELETE',
        headers:{...headers,Prefer:'return=minimal'}
      });
    }catch(deleteError){
      // Restore memberships if deletion is blocked by a database relation.
      for(const student of members){
        await db('/students?id=eq.'+encodeURIComponent(student.id),{
          method:'PATCH',
          headers:{...headers,Prefer:'return=minimal'},
          body:JSON.stringify({group_id:id})
        });
      }
      throw deleteError;
    }

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
    const {data:{session},error:sessionError}=await supabaseClient.auth.getSession();
    if(sessionError||!session?.user?.id||!session.access_token){
      throw new Error('Сессия истекла. Войдите в аккаунт снова.');
    }
    const user=session.user;
    headers.Authorization='Bearer '+session.access_token;

    await db(
      '/groups',
      {
        method:'POST',
        headers:{
          ...headers,
          Prefer:'return=minimal'
        },
        body:JSON.stringify({name,teacher_id:user.id})
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

  document.getElementById(
    'student-payment-date'
  ).value=localISO(new Date());

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

    const date=document
      .getElementById('student-payment-date')
      .value;

    const amount=Number(raw);

    const s=students.find(
      x=>String(x.id)===String(id)
    );

    const {data:{session},error:sessionError}=await supabaseClient.auth.getSession();
    if(sessionError||!session?.user?.id||!session.access_token){
      throw new Error('Сессия истекла. Войдите в аккаунт снова.');
    }
    const user=session.user;
    headers.Authorization='Bearer '+session.access_token;

    if(
      !s||
      raw===''||
      !Number.isFinite(amount)||
      amount===0||
      !date
    ){
      return showError(
        new Error(
          'Введите сумму, отличную от нуля'
        )
      );
    }

    const createdPayments=await db(
      '/payments',
      {
        method:'POST',
        headers:{
          ...headers,
          Prefer:'return=representation'
        },
        body:JSON.stringify({
          student:s.name,
          student_id:s.id,
          amount,
          date,
          teacher_id:user.id
        })
      }
    );

    const createdPayment=Array.isArray(createdPayments)?createdPayments[0]:createdPayments;
    if(createdPayment?.id){
      try{
        const {data,error}=await supabaseClient.functions.invoke('notify-payment',{
          body:{payment_id:String(createdPayment.id)}
        });
        if(error)console.warn('Payment saved, but Telegram notification failed:',error);
        else if(data?.errors?.length)console.warn('Payment saved, but some Telegram notifications failed:',data.errors);
      }catch(notificationError){
        console.warn('Payment saved, but Telegram notification failed:',notificationError);
      }
    }

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
    const studentValue=document.getElementById('add-payment-student').value;
    if(!studentValue)return showError(new Error(getLanguage()==='en'?'Select a student':'Выберите ученика'));
    const s=students.find(x=>String(x.id)===String(studentValue.replace(/^student:/,'')));

    const amount=Number(
      document
        .getElementById('add-payment-amount')
        .value
    );

    const date=document
      .getElementById('add-payment-date')
      .value;

    if(!s||!amount||!date){
      return showError(
        new Error('Заполните данные платежа')
      );
    }

    const {data:{session},error:sessionError}=await supabaseClient.auth.getSession();
    if(sessionError||!session?.user?.id||!session.access_token){
      throw new Error('Сессия истекла. Войдите в аккаунт снова.');
    }
    const user=session.user;
    headers.Authorization='Bearer '+session.access_token;

    const createdPayments=await db(
      '/payments',
      {
        method:'POST',
        headers:{
          ...headers,
          Prefer:'return=representation'
        },
        body:JSON.stringify({
          student:s.name,
          student_id:s.id,
          amount,
          date,
          teacher_id:user.id
        })
      }
    );

    const createdPayment=Array.isArray(createdPayments)?createdPayments[0]:createdPayments;
    if(createdPayment?.id){
      try{
        const {data,error}=await supabaseClient.functions.invoke('notify-payment',{
          body:{payment_id:String(createdPayment.id)}
        });
        if(error)console.warn('Payment saved, but Telegram notification failed:',error);
        else if(data?.errors?.length)console.warn('Payment saved, but some Telegram notifications failed:',data.errors);
      }catch(notificationError){
        // The payment is already safely saved; a notification failure must not
        // make the user think the payment itself failed or invite a duplicate.
        console.warn('Payment saved, but Telegram notification failed:',notificationError);
      }
    }

    closeModal('add-modal');

    await loadData();
    renderStudents();

  }catch(e){
    showError(e);
  }
}

function switchStudentSettingsTab(tab){const modal=document.getElementById('student-modal');if(!modal)return;for(const name of ['general','telegram']){document.getElementById('student-settings-'+name)?.classList.toggle('hidden',name!==tab);modal.querySelector('[data-student-settings-tab="'+name+'"]')?.setAttribute('aria-pressed',String(name===tab));}}

async function renderNativeHomework(studentId){
 const panel=document.getElementById('native-homework-panel');if(!panel)return;
 const ru=document.documentElement.lang==='ru',tr=(en,rus)=>ru?rus:en;
 try{
  const rows=await db('/homework_assignments?select=id,title,status,assigned_at,instructions,material_plan_id,section_id,material_snapshot&unassigned_at=is.null&student_id=eq.'+encodeURIComponent(studentId)+'&order=assigned_at.desc',{headers});
  if(!panel.isConnected)return;
  panel.innerHTML='<div class="native-section-heading"><h3>'+tr('Homework','Домашняя работа')+'</h3><button type="button" class="native-add-button" data-assign>+ '+tr('Assign homework','Назначить')+'</button></div><div class="native-history-scroll">'+(rows.map(r=>'<div style="display:flex;gap:8px;align-items:center"><button style="flex:1" type="button" data-homework-id="'+esc(r.id)+'" class="native-history-row"><strong>'+esc(r.title)+'</strong><span>'+esc(String(r.assigned_at).slice(0,10))+'</span><span>'+esc(({assigned:tr('Assigned','Назначено'),in_progress:tr('In progress','В процессе'),submitted:tr('Submitted','Сдано'),reviewed:tr('Reviewed','Проверено'),returned:tr('Returned','На исправлении')})[r.status]||r.status)+'</span></button><button type="button" data-manage="'+esc(r.id)+'">⋯</button></div>').join('')||'<p class="native-history-empty">'+tr('No homework assigned','Нет домашних заданий')+'</p>')+'</div>';
  panel.querySelector('[data-assign]').onclick=()=>openNativeHomeworkAssign(studentId);
  panel.querySelectorAll('[data-manage]').forEach(b=>b.onclick=()=>openHomeworkManage(studentId,rows.find(r=>r.id===b.dataset.manage))); 
  panel.querySelectorAll('[data-homework-id]').forEach(b=>b.onclick=()=>openNativeHomeworkReview(studentId,b.dataset.homeworkId));
 }catch(e){if(panel.isConnected)panel.textContent=String(e.message||e);}
}
async function openNativeHomeworkAssign(studentId){
 const ru=document.documentElement.lang==='ru',tr=(en,rus)=>ru?rus:en;
 const d=document.createElement('dialog');d.className='app-card';d.style.cssText='width:min(480px,92vw);padding:24px;border:1px solid var(--border-color);border-radius:18px;background:var(--card-bg);color:var(--text-color)';
 d.innerHTML='<form style="display:grid;gap:12px"><h3>'+tr('Assign homework','Назначить домашнюю работу')+'</h3><label>'+tr('Material and section','Материал и секция')+'<select required style="display:block;width:100%" name="section"><option value="">'+tr('Loading…','Загрузка…')+'</option></select></label><div data-exercises></div><label>'+tr('Comment','Комментарий')+'<textarea style="display:block;width:100%" name="comment"></textarea></label><p role="status"></p><div style="display:flex;justify-content:space-between"><button type="button" data-cancel>'+tr('Cancel','Отмена')+'</button><button type="submit" class="native-add-button" disabled>'+tr('Assign','Назначить')+'</button></div></form>';
 document.body.append(d);d.addEventListener('close',()=>d.remove());d.showModal();
 const form=d.querySelector('form'),select=form.elements.section,submit=form.querySelector('[type=submit]'),status=form.querySelector('[role=status]');
 form.querySelector('[data-cancel]').onclick=()=>d.close();
 try{
 const plans=await db('/teaching_lesson_plans?select=id,body',{headers});
 select.replaceChildren(new Option(tr('Choose homework','Выберите задание'),''));
 for(const p of plans)for(const s of p.body?.stages||[])if(s.homework&&(p.body.blocks||[]).some(b=>b.stage===s.id&&!b.hiddenFromStudent))select.add(new Option(p.body.title+' · '+s.name,JSON.stringify([p.id,s.id])));
 if(select.options.length===1)status.textContent=tr('No saved Homework sections with exercises','Нет сохранённых секций Homework с упражнениями');
 select.onchange=async()=>{submit.disabled=true;const box=form.querySelector('[data-exercises]');box.replaceChildren();if(!select.value)return;const value=select.value,[plan,section]=JSON.parse(value);try{const assigned=await homeworkRpc('get_assigned_homework_exercises',{p_student_id:studentId,p_plan_id:plan});if(select.value!==value)return;for(const b of plans.find(p=>p.id===plan).body.blocks.filter(b=>b.stage===section&&!b.hiddenFromStudent)){const hits=assigned.filter(x=>x.exercise_id===b.id),locked=hits.some(x=>x.status!=='reviewed');const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=b.id;input.disabled=locked;input.checked=!hits.length;label.style.display='block';label.append(input,' '+(b.title||b.type||b.id)+(locked?' · '+tr('Already assigned','Уже назначено'):hits.length?' · '+tr('Reviewed','Проверено'):''));box.append(label);}const refresh=()=>submit.disabled=!box.querySelector('input:checked');box.onchange=refresh;refresh();}catch(e){status.textContent=String(e.message||e);}};
 }catch(e){status.textContent=String(e.message||e);}
 form.onsubmit=async e=>{e.preventDefault();if(!select.value||submit.disabled)return;submit.disabled=true;try{const [plan,section]=JSON.parse(select.value);await homeworkRpc('assign_homework_selected',{p_student_id:studentId,p_plan_id:plan,p_section_id:section,p_exercise_ids:[...form.querySelectorAll('[data-exercises] input:checked')].map(x=>x.value),p_instructions:form.elements.comment.value});d.close();if(String(nativeSelectedStudentId)===String(studentId)&&nativeStudentDetailTab==='homework')renderNativeHomework(studentId);}catch(err){status.textContent=String(err.message||err);submit.disabled=false;}};
}


async function homeworkRpc(name,args){return db('/rpc/'+name,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(args)});}
async function openHomeworkManage(studentId,row){
 const tr=(en,ru)=>document.documentElement.lang==='ru'?ru:en;
 const d=document.createElement('dialog');d.className='app-card';d.style.cssText='width:min(480px,92vw);padding:24px;background:var(--card-bg);color:var(--text-color);border:1px solid var(--border-color);border-radius:18px';
 const editable=['assigned','in_progress','returned'].includes(row.status);
 d.innerHTML='<div style="display:grid;gap:12px"><h3>'+esc(row.title)+'</h3><button data-preview>'+tr('Preview','Просмотр')+'</button><label>'+tr('Comment','Комментарий')+'<textarea style="display:block;width:100%"></textarea></label><button data-comment>'+tr('Save comment','Сохранить комментарий')+'</button>'+(editable?'<button data-edit>'+tr('Edit exercises','Изменить упражнения')+'</button><div data-blocks></div><button data-unassign>'+tr('Unassign','Отозвать')+'</button>':'')+'<p role="status"></p><button data-close>'+tr('Close','Закрыть')+'</button></div>';
 document.body.append(d);d.addEventListener('close',()=>d.remove());d.showModal();d.querySelector('textarea').value=row.instructions||'';
 const run=async(fn)=>{try{await fn();d.close();renderNativeHomework(studentId);}catch(e){d.querySelector('[role=status]').textContent=String(e.message||e);}};
 d.querySelector('[data-close]').onclick=()=>d.close();
 d.querySelector('[data-preview]').onclick=()=>{d.close();openNativeHomeworkReview(studentId,row.id);};
 d.querySelector('[data-comment]').onclick=()=>run(()=>homeworkRpc('manage_homework',{p_assignment_id:row.id,p_action:'edit_comment',p_instructions:d.querySelector('textarea').value}));
 if(!editable)return;
 d.querySelector('[data-unassign]').onclick=()=>{if(confirm(tr('Unassign homework? Student access will be removed; answers will be retained.','Отозвать работу? Доступ ученика будет закрыт, ответы сохранятся.')))run(()=>homeworkRpc('manage_homework',{p_assignment_id:row.id,p_action:'unassign'}));};
 d.querySelector('[data-edit]').onclick=async()=>{const box=d.querySelector('[data-blocks]');box.replaceChildren();try{const plans=await db('/teaching_lesson_plans?select=id,body&id=eq.'+encodeURIComponent(row.material_plan_id),{headers});const assigned=await homeworkRpc('get_assigned_homework_exercises',{p_student_id:studentId,p_plan_id:row.material_plan_id});const original=row.material_snapshot.blocks||[],ids=new Set(original.map(b=>b.id));const candidates=[...original,...(plans[0]?.body?.blocks||[]).filter(b=>b.stage===row.section_id&&!b.hiddenFromStudent&&!ids.has(b.id))];for(const b of candidates){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=b.id;input.checked=ids.has(b.id);input.disabled=!input.checked&&assigned.some(x=>x.exercise_id===b.id&&x.assignment_id!==row.id&&x.status!=='reviewed');label.style.display='block';label.append(input,' '+(b.title||b.type||b.id));box.append(label);}const save=document.createElement('button');save.textContent=tr('Save exercises','Сохранить упражнения');save.onclick=()=>{const selected=[...box.querySelectorAll('input:checked')].map(x=>x.value),removed=[...ids].filter(id=>!selected.includes(id));if(removed.length&&!confirm(tr('Remove selected exercises?','Удалить выбранные упражнения?')))return;run(()=>homeworkRpc('edit_homework_exercises',{p_assignment_id:row.id,p_add_ids:selected.filter(id=>!ids.has(id)),p_remove_ids:removed}));};box.append(save);}catch(e){d.querySelector('[role=status]').textContent=String(e.message||e);}};
}
async function openNativeHomeworkReview(studentId,assignmentId){
 const tr=(en,ru)=>window.getLanguage?.()==='en'?en:ru;
 const d=document.createElement('dialog');d.className='app-card';d.style.width='min(1100px,94vw)';
 const title=document.createElement('h2');title.textContent=tr('Homework review','Проверка домашней работы');
 const close=document.createElement('button');close.type='button';close.className='pp-student-return';close.textContent=tr('Close','Закрыть');close.onclick=()=>d.close();
 const host=document.createElement('div');host.textContent=tr('Loading…','Загрузка…');
 const feedback=document.createElement('textarea');feedback.placeholder=tr('Teacher feedback','Комментарий преподавателя');
 const status=document.createElement('p');status.setAttribute('role','status');
 const actions=document.createElement('div');actions.style.cssText='display:flex;gap:12px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap';
 const accept=document.createElement('button'),sendBack=document.createElement('button');
 for(const b of [accept,sendBack]){b.type='button';b.className='native-add-button';b.disabled=true;}
 accept.textContent=tr('Mark as reviewed','Принять работу');sendBack.textContent=tr('Return for correction','Вернуть на исправление');
 const header=document.createElement('header');header.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px';title.style.cssText='margin:0;min-width:0;font-size:18px;font-weight:700';close.style.cssText='flex:none;margin:0';header.append(title,close);
 const style=document.createElement('style');style.textContent='.pp-homework-review .mb-preview-top{display:none!important}.pp-homework-review .mb-preview-workspace{padding-top:0!important;margin-top:0!important}.pp-homework-review .mb-student-preview{padding:0!important;min-height:0!important;gap:0!important}';
 d.classList.add('pp-homework-review');actions.append(sendBack,accept);d.append(style,header,host,feedback,status,actions);document.body.append(d);
 let cleanup;d.addEventListener('close',()=>{cleanup?.();d.remove();},{once:true});d.showModal();
 try{
  const rows=await db('/homework_assignments?select=id,title,status,material_snapshot,answers,teacher_feedback&student_id=eq.'+encodeURIComponent(studentId)+'&id=eq.'+encodeURIComponent(assignmentId),{headers});
  const row=rows?.[0];if(!row)throw Error(tr('Homework not found','Задание не найдено'));if(!d.isConnected)return;
  title.textContent=row.title+' › '+tr('Homework review','Проверка домашней работы');
  feedback.value=row.teacher_feedback||'';feedback.readOnly=row.status!=='submitted';
  accept.disabled=sendBack.disabled=row.status!=='submitted';
  const plan={...row.material_snapshot,stages:row.material_snapshot.stages.map(s=>({...s,homework:false}))};
  let attempts=0;
  function mount(){if(!host.isConnected)return;if(typeof window.mountProfiProfitHomework==='function'){host.replaceChildren();cleanup=window.mountProfiProfitHomework(host,plan,supabaseClient,{id:'review:'+row.id,answers:row.answers||{},readOnly:true,onChange:()=>{}});}else if(++attempts<30)setTimeout(mount,300);else host.textContent=tr('Classroom unavailable','Редактор недоступен');}
  mount();
  async function review(returned){
   accept.disabled=sendBack.disabled=true;
   try{await db('/rpc/review_homework',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({p_assignment_id:row.id,p_feedback:feedback.value,p_return:returned})});d.close();if(String(nativeSelectedStudentId)===String(studentId)&&nativeStudentDetailTab==='homework')void renderNativeHomework(studentId);}
   catch(e){status.textContent=String(e.message||e);accept.disabled=sendBack.disabled=false;}
  }
  accept.onclick=()=>review(false);sendBack.onclick=()=>review(true);
 }catch(e){host.textContent=String(e.message||e);}
}
