function studentStats(s){
  const groupLessonIds=new Set(
    lessonMembers
      .filter(m=>String(m.student_id)===String(s.id))
      .map(m=>String(m.lesson_id))
  );

  const ls=lessons.filter(
    l=>l.student===s.name || groupLessonIds.has(String(l.id))
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

  return {
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

  if(studentSort==='name_asc')
    active.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'ru',{sensitivity:'base'}));

  if(studentSort==='name_desc')
    active.sort((a,b)=>String(b.name||'').localeCompare(String(a.name||''),'ru',{sensitivity:'base'}));

  if(studentSort==='new'||studentSort==='old')
    active.sort((a,b)=>{
      const ai=students.indexOf(a),bi=students.indexOf(b);
      return studentSort==='new'?bi-ai:ai-bi;
    });

  return active;
}

function renderStudents(){
  renderGroups();

  const show=document.getElementById('show-archived').checked;
  const active=show?students.slice():sortedActiveStudents();

  if(show){
    if(studentSort==='name_asc')
      active.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'ru',{sensitivity:'base'}));

    if(studentSort==='name_desc')
      active.sort((a,b)=>String(b.name||'').localeCompare(String(a.name||''),'ru',{sensitivity:'base'}));

    if(studentSort==='new'||studentSort==='old')
      active.sort((a,b)=>{
        const ai=students.indexOf(a),bi=students.indexOf(b);
        return studentSort==='new'?bi-ai:ai-bi;
      });
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
        <button onclick="event.stopPropagation();toggleStudentMenu('${esc(id)}')" class="w-9 h-9 rounded-xl bg-slate-100 text-xl">⋮</button>

        <div id="menu-${esc(id)}" class="hidden absolute right-0 top-10 z-20 bg-white border rounded-2xl shadow-xl p-2 w-56">
          <button onclick="openStudentEdit('${esc(id)}')" class="block w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100">Изменить</button>
          <button onclick="addToGroup('${esc(id)}')" class="block w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100">Включить в группу</button>
          <button onclick="copyStudentLink('${esc(id)}')" class="block w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100">Ссылка для ученика</button>
          <button onclick="toggleArchive('${esc(id)}')" class="block w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100">${isArchived?'Вернуть из архива':'Заархивировать'}</button>
          <button onclick="removeStudent('${esc(id)}')" class="block w-full text-left px-3 py-2 rounded-xl hover:bg-red-50 text-red-600">Удалить ученика</button>
        </div>
      </div>
    </div>

    <div id="detail-${esc(id)}" class="hidden border-t bg-slate-50 p-4">
      ${studentDetail(s)}
    </div>
  </div>`;
}
function studentDetail(s){const st=studentStats(s),today=localISO(new Date()),lessonKey=l=>String(l.date)+(l.time?'T'+String(l.time).slice(0,5):'T23:59'),allLessons=st.ls.slice().sort((a,b)=>lessonKey(a).localeCompare(lessonKey(b))),topups=payments.filter(p=>p.student===s.name).sort((a,b)=>String(b.date).localeCompare(String(a.date)));const lessonsHtml=allLessons.length?allLessons.map(l=>{const now=new Date(),past=String(l.date)<today||(String(l.date)===today&&String(l.time||'23:59').slice(0,5)<String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0')),statusText=studentLessonStatusText(l,s),statusCls=studentLessonStatusClass(l,s);return '<div class="flex justify-between items-center gap-3 border-b border-slate-200 py-2 '+(['rescheduled','cancelled_charge','cancelled_free'].includes(l.status)?'line-through opacity-60':'')+'" data-lesson-date="'+esc(l.date)+'" data-lesson-time="'+esc(String(l.time||'23:59').slice(0,5))+'"><div><span>'+esc(l.date)+(l.time?' · '+esc(displayTime(l.time)):'')+'</span>'+(l.comment?'<div class="text-xs text-slate-500 mt-1 no-underline" style="text-decoration:none">'+esc(l.comment)+'</div>':'')+'</div><div class="relative shrink-0">'+(past?'<button type="button" onclick="event.stopPropagation();toggleStudentAttendanceMenu(\''+esc(l.id)+'-'+esc(s.id)+'\')" class="status '+statusCls+' cursor-pointer hover:opacity-80">'+esc(statusText)+'</button><div id="student-attendance-menu-'+esc(l.id)+'-'+esc(s.id)+'" class="student-attendance-menu hidden absolute right-0 top-full mt-1 z-30 bg-white border rounded-xl shadow-xl p-1 w-64"><button type="button" class="block w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 text-xs" onclick="setStudentAttendance(\''+esc(l.id)+'\',\''+esc(s.id)+'\',\'conducted\')">Проведено</button><button type="button" class="block w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 text-xs" onclick="setStudentAttendance(\''+esc(l.id)+'\',\''+esc(s.id)+'\',\'cancelled_charge\')">Не посетил, списать оплату</button><button type="button" class="block w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 text-xs" onclick="setStudentAttendance(\''+esc(l.id)+'\',\''+esc(s.id)+'\',\'cancelled_free\')">Не посетил, не списывать оплату</button></div>':'<span class="status '+statusCls+'">'+esc(statusText)+'</span>')+'</div></div>'}).join(''):'<span class="text-slate-400">Занятий нет</span>';return '<div class="space-y-2 text-sm mb-4"><div><span class="text-slate-400">Внесено</span><br><b>'+money(st.income)+'</b></div><div><span class="text-slate-400">Списано</span><br><b>'+money(st.expenses)+'</b></div><div><span class="text-slate-400">Баланс</span><br><b>'+money(st.bal)+'</b></div></div><div class="grid grid-cols-2 gap-2 text-sm mb-4"><div><span class="text-slate-400">Проведенных занятий</span><br><b>'+st.ls.filter(l=>l.status==='conducted').length+'</b></div><div><span class="text-slate-400">Стоимость за занятие</span><br><b>'+money(s.price||0)+'</b></div></div><div class="grid grid-cols-1 md:grid-cols-2 gap-4"><div><div class="flex items-center justify-between mb-2"><h4 class="font-semibold">Пополнения</h4><button onclick="openStudentPayment(\''+esc(s.id)+'\')" class="text-xs font-semibold text-indigo-700 hover:underline">Внести оплату</button></div><div class="teacher-detail-list space-y-1 text-sm">'+(topups.map(p=>'<div class="flex justify-between border-b border-slate-200 py-1"><span>'+esc(p.date)+'</span><b class="text-emerald-600">+'+money(p.amount)+'</b></div>').join('')||'<span class="text-slate-400">Пополнений нет</span>')+'</div></div></div><div class="mt-5"><h4 class="font-semibold mb-2">Все занятия</h4><div id="student-lessons-'+esc(s.id)+'" class="student-lessons-scroll teacher-detail-list space-y-1 text-sm border-t border-slate-200 pt-2">'+lessonsHtml+'</div></div></div>'}
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
  return statusClass[a]||statusClass[l.status]||'bg-slate-100 text-slate-700';
}

async function setStudentAttendance(lessonId,studentId,status){
  try{
    const l=lessons.find(x=>String(x.id)===String(lessonId));
    const s=students.find(x=>String(x.id)===String(studentId));

    if(!l||!s)return;

    if(l.group_id){
      const m=lessonMembers.find(
        x=>String(x.lesson_id)===String(l.id)&&
        String(x.student_id)===String(s.id)
      );

      if(!m)
        throw new Error('Ученик не добавлен в это групповое занятие');

      await db(
        '/lesson_members?id=eq.'+encodeURIComponent(m.id),
        {
          method:'PATCH',
          headers:{...headers,Prefer:'return=minimal'},
          body:JSON.stringify({
            attendance_status:status==='conducted'?null:status,
            charged:status!=='cancelled_free'
          })
        }
      );
    }else{
      await db(
        '/lessons?id=eq.'+encodeURIComponent(l.id),
        {
          method:'PATCH',
          headers:{...headers,Prefer:'return=minimal'},
          body:JSON.stringify({
            status:status==='conducted'?'conducted':status
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
