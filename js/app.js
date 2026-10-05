const { createClient } = supabase;

const THEME_STORAGE_KEY='profiprofit-theme';
function applyTheme(theme){
  const dark=theme==='dark';
  document.documentElement.dataset.theme=dark?'dark':'light';
  try{localStorage.setItem(THEME_STORAGE_KEY,dark?'dark':'light')}catch(e){}
  const label=document.getElementById('theme-toggle-label');
  const icon=document.getElementById('theme-toggle-icon');
  const lang=typeof getLanguage==='function'?getLanguage():'ru';
  if(label)label.textContent=dark?(lang==='en'?'Light theme':'Светлая тема'):(lang==='en'?'Dark theme':'Тёмная тема');
  if(icon)icon.innerHTML=dark?'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>':'<path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>';
}
function toggleDarkMode(){applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark')}
function toggleProfileMenu(){
  const menu=document.getElementById('profile-menu');
  const button=document.getElementById('profile-menu-button');
  if(!menu||!button)return;
  const opening=menu.classList.contains('hidden');
  menu.classList.toggle('hidden',!opening);
  button.setAttribute('aria-expanded',String(opening));
}
document.addEventListener('click',event=>{
  const wrap=document.querySelector('.profile-menu-wrap');
  if(wrap&&!wrap.contains(event.target)){
    document.getElementById('profile-menu')?.classList.add('hidden');
    document.getElementById('profile-menu-button')?.setAttribute('aria-expanded','false');
  }
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){
    document.getElementById('profile-menu')?.classList.add('hidden');
    document.getElementById('profile-menu-button')?.setAttribute('aria-expanded','false');
  }
});
document.addEventListener('DOMContentLoaded',()=>{
  initCurrency();
  let theme='light';
  try{theme=localStorage.getItem(THEME_STORAGE_KEY)==='dark'?'dark':'light'}catch(e){}
  applyTheme(theme);
});

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

const CURRENCY_STORAGE_KEY='profiprofit-currency';
const CURRENCY_SYMBOLS={BYN:'BYN',RUB:'₽',USD:'$',EUR:'€',PLN:'zł'};
let appCurrency='BYN';
function initCurrency(){
  try{const saved=localStorage.getItem(CURRENCY_STORAGE_KEY);if(CURRENCY_SYMBOLS[saved])appCurrency=saved;}catch(e){}
  const select=document.getElementById('currency-select');
  if(select)select.value=appCurrency;
  updateCurrencyLabel();
}
function setCurrency(currency){
  if(!CURRENCY_SYMBOLS[currency])return;
  appCurrency=currency;
  try{localStorage.setItem(CURRENCY_STORAGE_KEY,currency)}catch(e){}
  const select=document.getElementById('currency-select');
  if(select)select.value=currency;
  updateCurrencyLabel();
  if(typeof renderStudents==='function')renderStudents();
  if(typeof renderDashboard==='function')renderDashboard();
  if(typeof renderWeek==='function')renderWeek();
  if(typeof renderDay==='function')renderDay();
}
function updateCurrencyLabel(){
  const label=document.getElementById('currency-label');
  if(label)label.textContent=(typeof getLanguage==='function'&&getLanguage()==='en'?'Currency':'Валюта');
}
function money(n){
  return Number(n||0).toLocaleString((typeof getLanguage==='function'&&getLanguage()==='en'?'en-US':'ru-RU'),{
    maximumFractionDigits:2
  })+' '+CURRENCY_SYMBOLS[appCurrency];
}

function togglePasswordVisibility(inputId,button){
  const input=document.getElementById(inputId);
  if(!input||!button)return;
  const show=input.type==='password';
  input.type=show?'text':'password';
  button.setAttribute('aria-label',show?'Скрыть пароль':'Показать пароль');
  button.title=show?'Скрыть пароль':'Показать пароль';
  button.innerHTML=show
    ?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a15 15 0 0 1-3.1 3.9M6.2 6.2C3.5 8 2 12 2 12s3.5 7 10 7c1.2 0 2.3-.2 3.3-.6"/></svg>'
    :'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
}
function showError(e){
  console.error(e);
  const b=document.getElementById('error-box');
  b.textContent='Ошибка: '+(e.message||e);
  b.classList.remove('hidden');
  setTimeout(()=>b.classList.add('hidden'),5000);
}

async function db(path,opt={}){
  // Keep the REST API token in sync with Supabase's refreshed auth session.
  let authHeaders={};
  try{
    const {data:{session}}=await supabaseClient.auth.getSession();
    if(session?.access_token){
      authHeaders.Authorization='Bearer '+session.access_token;
      headers.Authorization=authHeaders.Authorization;
    }
  }catch(e){
    console.warn('Could not refresh REST auth headers:',e);
  }

  const r=await fetch(API+path,{
    ...opt,
    headers:{
      ...headers,
      ...authHeaders,
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

function lessonEndTimestamp(l){
  if(!l?.date)return null;

  const rawTime=String(l.time||'23:59').replace('.',':');
  const [hRaw,mRaw]=rawTime.split(':');
  const h=Number(hRaw);
  const m=Number(mRaw);

  if(!Number.isFinite(h)||!Number.isFinite(m))return null;

  const duration=Math.max(
    1,
    Number(l.duration)||60
  );

  const start=new Date(l.date+'T00:00:00');
  start.setHours(h,m,0,0);
  start.setMinutes(start.getMinutes()+duration);

  return start.getTime();
}

async function autoCompletePastLessons(){
  const now=Date.now();

  const due=lessons.filter(
    l=>
      l.status==='pending'&&
      lessonEndTimestamp(l)!==null&&
      lessonEndTimestamp(l)<=now
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
  ['dashboard','calendar','students'].forEach(name=>{
    document.getElementById('tab-'+name)?.classList.toggle('hidden',t!==name);
    const nav=document.getElementById('nav-'+name);
    if(nav)nav.className='px-4 py-2 rounded-xl font-semibold '+(t===name?'bg-indigo-600 text-white':'bg-slate-100');
  });
  if(t==='dashboard')renderDashboard();
  if(t==='calendar'){renderWeek();renderDay();}
  if(t==='students')renderStudents();
}

function dashboardLessonCharge(l){
  if(!charge.has(l.status))return 0;
  if(!l.group_id)return Number(l.price||0);
  const members=lessonMembersFor(l);
  if(members.length)return members.reduce((sum,m)=>{if(m.charged===false)return sum;const s=students.find(x=>String(x.id)===String(m.student_id));return sum+Number(m.price??s?.price??0);},0);
  return lessonPriceTotal(l);
}

function renderDashboard(){
  const now=new Date(), today=localISO(now), month=today.slice(0,7);
  const active=students.filter(s=>!s.archived);
  const monthLessons=lessons.filter(l=>String(l.date||'').startsWith(month));
  const earnedMonth=monthLessons.reduce((sum,l)=>sum+dashboardLessonCharge(l),0);
  const earnedAll=lessons.reduce((sum,l)=>sum+dashboardLessonCharge(l),0);
  const receivedMonth=payments.filter(p=>String(p.date||'').startsWith(month)).reduce((sum,p)=>sum+Number(p.amount||0),0);
  const todayCount=lessons.filter(l=>l.date===today).length;
  const low=active.map(student=>{const stats=studentStats(student);const price=Number(student.price||0);const remaining=price>0?Math.floor((stats.bal+1e-9)/price):Infinity;return {student,stats,price,remaining,status:stats.bal<0?'debt':remaining<=1?'topup':remaining===2?'low':'ok'};}).filter(x=>x.status!=='ok').sort((a,b)=>a.stats.bal-b.stats.bal);
  const en=typeof getLanguage==='function'&&getLanguage()==='en';
  document.getElementById('dashboard-date').textContent=now.toLocaleDateString(en?'en-US':'ru-RU',{month:'long',year:'numeric'});
  const cards=[
    {label:en?'Active students':'Активные ученики',value:active.length,icon:'♙',action:"switchTab('students')"},
    {label:en?'Accrued this month':'Начислено за месяц',value:money(earnedMonth),icon:'₿'},
    {label:en?'Earned all time':'Заработано за всё время',value:money(earnedAll),icon:'↗'},
    {label:en?'Lessons today':'Занятий сегодня',value:todayCount,icon:'▦',action:'openTodayCalendar()'},
    {label:en?'Payments received this month':'Получено платежей за месяц',value:money(receivedMonth),icon:'＋',action:"switchTab('students')"},
    {label:en?'Low student balances':'Низкие балансы',value:low.length,icon:'!',action:"switchTab('students')"}
  ];
  document.getElementById('dashboard-cards').innerHTML=cards.map(c=>'<button '+(c.action?'onclick="'+c.action+'"':'')+' class="app-card rounded-2xl p-4 md:p-5 text-left border min-w-0"><div class="flex items-center justify-between gap-2 mb-3"><span class="text-xs md:text-sm text-slate-500">'+c.label+'</span><span class="text-xl">'+c.icon+'</span></div><div class="text-xl md:text-2xl font-bold break-words">'+c.value+'</div></button>').join('');
  document.getElementById('dashboard-summary').innerHTML='<div class="flex justify-between gap-3"><span class="text-sm text-slate-500">'+(en?'Lessons this month':'Занятий в этом месяце')+'</span><strong>'+monthLessons.length+'</strong></div><div class="flex justify-between gap-3"><span class="text-sm text-slate-500">'+(en?'Lessons today':'Занятий сегодня')+'</span><strong>'+todayCount+'</strong></div><div class="flex justify-between gap-3"><span class="text-sm text-slate-500">'+(en?'Active students':'Активных учеников')+'</span><strong>'+active.length+'</strong></div>';
  const lowContainer=document.getElementById('dashboard-low-balances');
  lowContainer.innerHTML=low.length?low.slice(0,5).map(x=>{const label=x.status==='debt'?(en?'Debt':'Задолженность'):x.status==='topup'?(en?'Top up needed':'Нужно пополнить'):(en?'Low balance':'Низкий баланс');const color=x.status==='debt'?'text-red-700':x.status==='topup'?'text-orange-600':'text-amber-600';const count=x.status==='debt'?'':(en?' · '+x.remaining+' lessons left':' · осталось занятий: '+x.remaining);return '<button onclick="switchTab(\'students\')" class="w-full flex flex-col gap-1 text-left border-b last:border-0 py-2"><span class="flex justify-between gap-3"><span class="font-medium">'+esc(x.student.name)+'</span><span class="text-sm '+color+'">'+label+'</span></span><span class="flex justify-between gap-3 text-xs text-slate-500"><span>'+money(x.stats.bal)+count+'</span></span></button>';}).join(''):'<p class="text-sm text-slate-500">'+(en?'No low balances':'Нет учеников с низким балансом')+'</p>';
}

function openTodayCalendar(){selectedDate=localISO(new Date());weekAnchor=weekStart(new Date());switchTab('calendar');}
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
    renderStudents();
    switchTab('dashboard');

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

let lessonDeleteInProgress=false;

function showBlockingLoader(message='Удаляем занятие…'){
  let overlay=document.getElementById('blocking-operation-overlay');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='blocking-operation-overlay';
    overlay.setAttribute('role','status');
    overlay.setAttribute('aria-live','polite');
    overlay.style.cssText='position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,.38);backdrop-filter:blur(2px);padding:20px;';
    overlay.innerHTML='<div style="display:flex;flex-direction:column;align-items:center;gap:14px;min-width:190px;padding:24px 28px;border-radius:20px;background:white;box-shadow:0 20px 60px rgba(0,0,0,.2);color:#334155;font:600 14px system-ui,sans-serif;"><div style="width:36px;height:36px;border:4px solid #e0e7ff;border-top-color:#4f46e5;border-radius:50%;animation:profi-spin .8s linear infinite;"></div><span id="blocking-operation-message"></span><span style="font-size:12px;font-weight:400;color:#64748b;">Пожалуйста, подождите</span></div>';
    const style=document.createElement('style');
    style.id='blocking-operation-spinner-style';
    style.textContent='@keyframes profi-spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(style);
    document.body.appendChild(overlay);
  }
  const label=document.getElementById('blocking-operation-message');
  if(label)label.textContent=message;
  overlay.style.display='flex';
  document.querySelectorAll('#delete-one-btn,#delete-follow-btn').forEach(button=>{
    button.disabled=true;
    button.style.opacity='.5';
  });
}

function hideBlockingLoader(){
  const overlay=document.getElementById('blocking-operation-overlay');
  if(overlay)overlay.style.display='none';
  document.querySelectorAll('#delete-one-btn,#delete-follow-btn').forEach(button=>{
    button.disabled=false;
    button.style.opacity='';
  });
}

async function deleteLessonFromModal(){
  if(lessonDeleteInProgress)return;
  const id=document.getElementById('edit-id').value;
  if(!id)return;
  const deleted=await deleteLesson(id);
  if(deleted)closeLessonModal();
}

async function deleteLesson(id){
  if(lessonDeleteInProgress)return false;
  if(!confirm('Удалить это занятие?'))return false;
  lessonDeleteInProgress=true;
  showBlockingLoader('Удаляем занятие…');
  try{
    await db(
      '/lessons?id=eq.'+encodeURIComponent(id),
      {method:'DELETE',headers}
    );
    await loadData();
    renderWeek();
    renderDay();
    return true;
  }catch(e){
    showError(e);
    return false;
  }finally{
    lessonDeleteInProgress=false;
    hideBlockingLoader();
  }
}

async function deleteThisAndFollowingFromModal(){
  if(lessonDeleteInProgress)return;
  const id=document.getElementById('edit-id').value;
  const l=lessons.find(x=>String(x.id)===String(id));
  if(!l)return;

  const isGroup=!!l.group_id;
  if(!confirm(
    isGroup
      ?'Удалить это групповое занятие и все следующие занятия этой группы начиная с '+l.date+'?'
      :'Удалить это занятие и все следующие у этого ученика начиная с '+l.date+'?'
  ))return;

  lessonDeleteInProgress=true;
  showBlockingLoader('Удаляем занятия…');
  try{
    const targets=isGroup
      ?lessons.filter(x=>String(x.group_id)===String(l.group_id)&&x.date>=l.date)
      :lessons.filter(x=>x.student===l.student&&x.date>=l.date);

    for(const x of targets){
      await db('/lessons?id=eq.'+encodeURIComponent(x.id),{
        method:'DELETE',
        headers
      });
    }

    closeLessonModal();
    await loadData();
    renderWeek();
    renderDay();
  }catch(e){
    showError(e);
  }finally{
    lessonDeleteInProgress=false;
    hideBlockingLoader();
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

function showAuthMode(mode){
  const login=document.getElementById('auth-login-form');
  const register=document.getElementById('auth-register-form');
  const loginTab=document.getElementById('auth-tab-login');
  const registerTab=document.getElementById('auth-tab-register');
  if(!login||!register)return;

  const isLogin=mode==='login';
  login.classList.toggle('hidden',!isLogin);
  register.classList.toggle('hidden',isLogin);

  loginTab.classList.toggle('bg-white',isLogin);
  loginTab.classList.toggle('shadow-sm',isLogin);
  loginTab.classList.toggle('text-slate-500',!isLogin);

  registerTab.classList.toggle('bg-white',!isLogin);
  registerTab.classList.toggle('shadow-sm',!isLogin);
  registerTab.classList.toggle('text-slate-500',isLogin);
}

async function registerTeacher(){
  const email=document.getElementById('teacher-register-email').value.trim();
  const password=document.getElementById('teacher-register-password').value;
  const password2=document.getElementById('teacher-register-password2').value;
  const errorEl=document.getElementById('teacher-register-error');

  errorEl.textContent='';

  if(!email||!password||!password2){
    errorEl.textContent='Заполните все поля';
    return;
  }

  if(password!==password2){
    errorEl.textContent='Пароли не совпадают';
    return;
  }

  if(password.length<6){
    errorEl.textContent='Пароль должен содержать минимум 6 символов';
    return;
  }

  try{
    const {data,error}=await supabaseClient.auth.signUp({
      email,
      password,
      options:{
        emailRedirectTo:'https://ttsnmrz-cmd.github.io/tutor-finance/'
      }
    });

    if(error)throw error;

    if(data.session){
      location.reload();
      return;
    }

    errorEl.className='text-sm text-emerald-600';
    errorEl.textContent='Аккаунт создан. Проверьте email для подтверждения.';
  }catch(e){
    console.error(e);
    errorEl.className='text-sm text-red-600';
    errorEl.textContent=e.message||'Не удалось зарегистрироваться';
  }
}

async function loginTeacher(){

  const email =
    document.getElementById(
      'teacher-email-input'
    ).value.trim();

  const password =
    document.getElementById(
      'teacher-password-input'
    ).value;

  const errorEl =
    document.getElementById(
      'teacher-login-error'
    );

  errorEl.textContent = '';

  if(!email || !password){
    errorEl.textContent =
      'Введите email и пароль';

    return;
  }

  try{

    const {
      data,
      error
    } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if(error){
      throw error;
    }

    headers = {
      apikey: SUPABASE_KEY,
      Authorization:
        'Bearer '+data.session.access_token,
      'Content-Type':
        'application/json'
    };
document.getElementById('landing-page')?.classList.add('hidden');
    document.getElementById('teacher-app')?.classList.remove('hidden');
    document.getElementById('teacher-header')?.classList.remove('hidden');
    document.getElementById('teacher-main')?.classList.remove('hidden');

    await loadData();

    // Populate the dashboard immediately after login instead of leaving
    // its empty placeholders visible until the user changes tabs.
    renderDashboard();
    renderWeek();
    renderDay();
    renderStudents();
    switchTab('dashboard');

  }catch(e){

    console.error(e);

    errorEl.textContent =
      e.message ||
      'Не удалось войти';
  }
}
async function loginWithGoogle(){

  const { error } =
    await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo:   'https://ttsnmrz-cmd.github.io/tutor-finance/'
      }
    });

  if(error){
    console.error(error);

    document.getElementById(
      'teacher-login-error'
    ).textContent =
      error.message;
  }
}
async function teacherLogout(){

  await supabaseClient.auth.signOut();

  location.reload();
}

let publicStudent=null;
let publicStudentLessons=[];
let publicStudentPayments=[];

async function initPublicStudent(){
  const id=new URLSearchParams(location.search).get('student');

  if(!id)return false;

  const view=document.getElementById('student-public-view');
  const login=document.getElementById('student-public-login');
  const content=document.getElementById('student-public-content');
  const nameEl=document.getElementById('student-public-name');
  const errorEl=document.getElementById('student-public-error');

  view.classList.remove('hidden');
  nameEl.textContent='Загрузка...';
  errorEl.textContent='';

  try{
    // Use the Supabase client directly. This avoids relying on the mutable
    // REST headers used by the teacher session.
    const {data,error}=await supabaseClient.rpc(
      'get_public_student_cabinet',
      {p_student_id:id}
    );

    if(error)throw error;

    const raw=data;
    const result=Array.isArray(raw)?(raw[0]||null):raw;

    publicStudent=result?.student||null;
    publicStudentLessons=Array.isArray(result?.lessons)
      ?result.lessons
      :[];
    publicStudentPayments=Array.isArray(result?.payments)
      ?result.payments
      :[];

    if(!publicStudent){
      nameEl.textContent='Ученик не найден';
      errorEl.textContent='Проверьте ссылку ученика.';
      return true;
    }

    nameEl.textContent='Ученик: '+publicStudent.name;
    await openStudentCabinet();

  }catch(e){
    console.error('Public cabinet error:',e);
    nameEl.textContent='Личный кабинет';
    errorEl.textContent=
      e?.message||'Не удалось загрузить данные ученика.';
  }

  return true;
}

async function openStudentCabinet(){
  if(!publicStudent)return;

  const ls=publicStudentLessons||[];
  const ps=publicStudentPayments||[];

  const paid=ps.reduce(
    (sum,p)=>sum+Number(p.amount||0),
    0
  );

  const spent=ls
    .filter(l=>charge.has(l.status))
    .reduce(
      (sum,l)=>sum+Number(l.price||0),
      0
    );

  const now=new Date();
  const today=localISO(now);
  const nowTime=
    String(now.getHours()).padStart(2,'0')+':' +
    String(now.getMinutes()).padStart(2,'0');

  const future=ls
    .filter(
      l=>l.status==='pending'&&(
        l.date>today||
        (
          l.date===today&&
          String(l.time||'23:59').slice(0,5)>=nowTime
        )
      )
    )
    .sort(
      (a,b)=>
        (String(a.date)+String(a.time))
          .localeCompare(String(b.date)+String(b.time))
    );

  const upcoming=future.slice(0,5);
  const cutoff=upcoming.length
    ?upcoming[upcoming.length-1].date
    :null;

  const visible=ls
    .filter(l=>!cutoff||l.date<=cutoff)
    .sort(
      (a,b)=>
        (String(a.date)+String(a.time))
          .localeCompare(String(b.date)+String(b.time))
    );

  document.getElementById('public-student-title').textContent=
    publicStudent.name;
  document.getElementById('public-student-meta').textContent=
    'Стоимость занятия: '+money(publicStudent.price||0);
  document.getElementById('public-paid').textContent=money(paid);
  document.getElementById('public-spent').textContent=money(spent);
  document.getElementById('public-balance').textContent=
    money(paid-spent);
  document.getElementById('public-conducted').textContent=
    ls.filter(l=>l.status==='conducted').length;
  document.getElementById('public-price').textContent=
    money(publicStudent.price||0);

  document.getElementById('public-payments').innerHTML=
    ps
      .slice()
      .sort(
        (a,b)=>
          String(b.date).localeCompare(String(a.date))
      )
      .map(
        p=>
          '<div class="flex justify-between border-b border-slate-200 py-1">'+
            '<span>'+esc(p.date)+'</span>'+
            '<b class="text-emerald-600">+'+
              money(p.amount)+
            '</b>'+
          '</div>'
      )
      .join('')||
    '<span class="text-slate-400">Пополнений нет</span>';

  document.getElementById('public-lessons').innerHTML=
    visible
      .map(
        l=>
          '<div class="rounded-2xl border border-slate-200 p-3 flex justify-between items-center gap-3">'+
            '<div>'+
              '<div class="font-semibold">'+esc(l.date)+'</div>'+
              '<div class="text-xs text-slate-500">'+
                esc(displayTime(l.time))+' · '+
                (l.duration||60)+' мин · '+
                money(l.price)+
              '</div>'+
            '</div>'+
            '<span class="status '+
              (statusClass[l.status]||
                'bg-slate-100 text-slate-700')+
              ' whitespace-nowrap">'+
              (statusLabels[l.status]||l.status)+
            '</span>'+
          '</div>'
      )
      .join('')||
    '<span class="text-slate-400">Занятий нет</span>';

  document.getElementById('student-public-login')
    .classList.add('hidden');
  document.getElementById('student-public-content')
    .classList.remove('hidden');

  const box=document.getElementById('public-lessons');
  const target=
    visible.find(
      l=>
        l.date>today||
        (
          l.date===today&&
          String(l.time||'23:59').slice(0,5)>=nowTime
        )
    )||
    visible[visible.length-1];

  if(target){
    const el=[...box.children].find(
      x=>x.querySelector('.font-semibold')?.textContent===target.date
    );

    if(el){
      box.scrollTop=Math.max(
        0,
        el.offsetTop-box.offsetTop-12
      );
    }
  }
}

  async function initApp(){

  if(await initPublicStudent())return;

  try{

    const yearEl=document.getElementById('current-year');
    if(yearEl)yearEl.textContent=String(new Date().getFullYear());

    const {
      data: { session },
      error
    } = await supabaseClient.auth.getSession();

    if(error){
      throw error;
    }

    if(!session){
      document.getElementById('teacher-app')?.classList.remove('hidden');
      document.getElementById('landing-page')?.classList.remove('hidden');
      document.getElementById('teacher-header')?.classList.add('hidden');
      document.getElementById('teacher-main')?.classList.add('hidden');
      return;
    }

    document.getElementById('landing-page')?.classList.add('hidden');
    document.getElementById('teacher-app')?.classList.remove('hidden');
    document.getElementById('teacher-header')?.classList.remove('hidden');
    document.getElementById('teacher-main')?.classList.remove('hidden');

    headers = {
      apikey: SUPABASE_KEY,
      Authorization:
        'Bearer '+session.access_token,
      'Content-Type':
        'application/json'
    };

    await loadData();

    // A page refresh with an existing session goes through initApp(),
    // not loginTeacher(). Render the dashboard on this path too.
    renderDashboard();
    renderWeek();
    renderDay();
    renderStudents();
    switchTab('dashboard');

  }catch(e){

    console.error(
      'initApp error:',
      e
    );

    showError(e);
  }
}

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
            price:Number(st.price??0),
            teacher_id:(await supabaseClient.auth.getUser()).data.user?.id
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
if(document.readyState === 'loading'){
  document.addEventListener(
    'DOMContentLoaded',
    initApp
  );
}else{
  initApp();
}

