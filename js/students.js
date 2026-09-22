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
