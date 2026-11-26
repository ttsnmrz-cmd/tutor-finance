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

supabaseClient.auth.onAuthStateChange((event,session)=>{
  if(session?.access_token){
    setRestAuthToken(session).catch(()=>{});
  }
});

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

function datePartsInTimezone(date,timezone){
  const parts=new Intl.DateTimeFormat('en-CA',{
    timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(date);
  const result={};
  parts.forEach(p=>{if(p.type!=='literal')result[p.type]=p.value;});
  return {date:result.year+'-'+result.month+'-'+result.day};
}
function dateTimePartsInTimezone(date,timezone){
  const parts=new Intl.DateTimeFormat('en-GB',{
    timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  }).formatToParts(date);
  const result={};
  parts.forEach(p=>{if(p.type!=='literal')result[p.type]=p.value;});
  return {date:result.year+'-'+result.month+'-'+result.day,time:result.hour+':'+result.minute};
}
function zonedDateTimeToTimestamp(date,time,timezone){
  const dm=String(date||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const tm=String(time||'').replace('.',':').match(/^(\d{1,2}):(\d{2})/);
  if(!dm||!tm||!isValidTimezone(timezone))return NaN;
  const target=Date.UTC(Number(dm[1]),Number(dm[2])-1,Number(dm[3]),Number(tm[1]),Number(tm[2]));
  let guess=target;
  for(let i=0;i<4;i++){
    const parts=dateTimePartsInTimezone(new Date(guess),timezone);
    const m=parts.date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const t=parts.time.split(':').map(Number);
    const represented=Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]),t[0],t[1]);
    const correction=target-represented;
    guess+=correction;
    if(correction===0)break;
  }
  return guess;
}
function lessonTimestamp(l){
  return zonedDateTimeToTimestamp(l?.date,l?.time,l?.timezone||'Europe/Minsk');
}
function lessonDateTimeInTimezone(l,timezone){
  const ts=lessonTimestamp(l);
  if(!Number.isFinite(ts))return {date:l?.date||'',time:String(l?.time||'11:00').slice(0,5)};
  return dateTimePartsInTimezone(new Date(ts),timezone);
}
function todayISOInTimezone(timezone){
  return datePartsInTimezone(new Date(),timezone).date;
}
function dateAtLocalNoon(date){
  return new Date(String(date||todayISOInTimezone(getTeacherTimezone()))+'T12:00:00');
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
const TEACHER_TIMEZONE_KEY='profiprofit-teacher-timezone';
let teacherTimezone='Europe/Minsk';
let teacherTimezoneUserId=null;
function isValidTimezone(timezone){
  if(typeof timezone!=='string'||!timezone)return false;
  try{new Intl.DateTimeFormat('en-US',{timeZone:timezone}).format(new Date());return true;}
  catch(e){return false;}
}
function getTeacherTimezone(){
  return isValidTimezone(teacherTimezone)?teacherTimezone:'Europe/Minsk';
}
async function loadTeacherTimezone(userId){
  teacherTimezoneUserId=userId||null;
  let timezone='Europe/Minsk';
  if(userId){
    const rows=await db('/profiles?id=eq.'+encodeURIComponent(userId)+'&select=id,name,timezone,telegram_username,telegram_chat_id,telegram_link_token,telegram_connected_at');
    if(Array.isArray(rows)&&rows[0]){
      if(isValidTimezone(rows[0].timezone))timezone=rows[0].timezone;
      window.teacherProfile=rows[0];
      window.currentTeacherName=String(rows[0].name||'').trim();
      const nameInput=document.getElementById('teacher-display-name');
      if(nameInput)nameInput.value=window.currentTeacherName;
      const telegramInput=document.getElementById('teacher-telegram-username');
      if(telegramInput)telegramInput.value=rows[0].telegram_username||'';
      renderTeacherTelegramStatus(rows[0]);
    }
  }
  teacherTimezone=timezone;
  try{localStorage.setItem(TEACHER_TIMEZONE_KEY,timezone);}catch(e){}
  selectedDate=todayISOInTimezone(timezone);
  weekAnchor=dateAtLocalNoon(selectedDate);
  const select=document.getElementById('teacher-timezone-select');
  if(select)select.value=timezone;
}

function renderTeacherTelegramStatus(profile={}){
  const status=document.getElementById('teacher-telegram-status');
  const linkBox=document.getElementById('teacher-telegram-link');
  const connectButton=document.getElementById('teacher-telegram-connect');
  if(!status)return;
  const connected=!!profile.telegram_chat_id;
  status.textContent=connected?'Подключён ✓':'Не подключён';
  status.className='text-sm font-semibold '+(connected?'text-emerald-600':'text-amber-600');
  if(linkBox){
    linkBox.value=profile.telegram_link_token?'https://t.me/ProfiProfitMonitorBot?start=teacher_'+profile.telegram_link_token:'';
    linkBox.classList.toggle('hidden',!profile.telegram_link_token||connected);
  }
  if(connectButton)connectButton.textContent=profile.telegram_link_token&&!connected?'Обновить ссылку подключения':'Создать ссылку подключения';
}
async function createTeacherTelegramLink(){
  try{
    const {data:{user},error}=await supabaseClient.auth.getUser();
    if(error)throw error;
    if(!user?.id)throw new Error('Войдите в аккаунт.');
    const token=crypto.randomUUID();
    await db('/profiles?on_conflict=id',{
      method:'POST',headers:{...headers,Prefer:'resolution=merge-duplicates,return=minimal'},
      body:JSON.stringify({id:user.id,telegram_link_token:token,telegram_chat_id:null,telegram_connected_at:null})
    });
    renderTeacherTelegramStatus({telegram_link_token:token});
    const link=document.getElementById('teacher-telegram-link');
    if(link){link.classList.remove('hidden');link.select();}
  }catch(e){showError(e);}
}
async function copyTeacherTelegramLink(){
  const link=document.getElementById('teacher-telegram-link')?.value;
  if(!link)return;
  try{await navigator.clipboard.writeText(link);alert('Ссылка скопирована. Открой её в Telegram и нажми Start.');}
  catch(e){const input=document.getElementById('teacher-telegram-link');input?.select();alert('Ссылка выделена — скопируй её вручную.');}
}

async function saveTeacherDisplayName(){
  try{
    const input=document.getElementById('teacher-display-name');
    const name=String(input?.value||'').trim();
    if(name.length>80)throw new Error('Имя должно быть не длиннее 80 символов.');
    const {data:{user},error}=await supabaseClient.auth.getUser();
    if(error)throw error;
    if(!user?.id)throw new Error('Войдите в аккаунт, чтобы сохранить имя.');
    await db('/profiles?on_conflict=id',{
      method:'POST',
      headers:{...headers,Prefer:'resolution=merge-duplicates,return=minimal'},
      body:JSON.stringify({id:user.id,name:name||null})
    });
    window.currentTeacherName=name;
    window.teacherProfile={...(window.teacherProfile||{}),name};
    if(typeof renderDashboard==='function')renderDashboard();
    alert('Имя сохранено.');
  }catch(e){showError(e);}
}

async function saveTeacherTelegramUsername(){
  try{
    const input=document.getElementById('teacher-telegram-username');
    const username=String(input?.value||'').trim().replace(/^@/,'');
    if(username&&!/^[A-Za-z0-9_]{5,32}$/.test(username)){
      throw new Error('Укажи Telegram username: от 5 до 32 символов, латинские буквы, цифры и _.');
    }
    const {data:{user},error}=await supabaseClient.auth.getUser();
    if(error)throw error;
    if(!user?.id)throw new Error('Войдите в аккаунт, чтобы сохранить Telegram.');
    await db('/profiles?on_conflict=id',{
      method:'POST',
      headers:{...headers,Prefer:'resolution=merge-duplicates,return=minimal'},
      body:JSON.stringify({id:user.id,telegram_username:username||null})
    });
    if(input)input.value=username?'@'+username:'';
    alert('Контакт для учеников сохранён.');
  }catch(e){showError(e);}
}
async function setTeacherTimezone(timezone){
  try{
    if(!isValidTimezone(timezone))throw new Error('Некорректный часовой пояс');
    const {data:{user},error}=await supabaseClient.auth.getUser();
    if(error)throw error;
    if(!user?.id)throw new Error('Войдите в аккаунт, чтобы сохранить часовой пояс.');
    const response=await db('/profiles?on_conflict=id',{
      method:'POST',
      headers:{...headers,Prefer:'resolution=merge-duplicates,return=minimal'},
      body:JSON.stringify({id:user.id,timezone})
    });
    teacherTimezone=timezone;
    teacherTimezoneUserId=user.id;
    try{localStorage.setItem(TEACHER_TIMEZONE_KEY,timezone);}catch(e){}
    selectedDate=todayISOInTimezone(timezone);
    weekAnchor=dateAtLocalNoon(selectedDate);
    const select=document.getElementById('teacher-timezone-select');
    if(select)select.value=timezone;
    if(typeof renderWeek==='function')renderWeek();
    if(typeof renderDay==='function')renderDay();
    alert('Часовой пояс сохранён в профиле. Календарь обновлён.');
  }catch(e){
    showError(e);
    const select=document.getElementById('teacher-timezone-select');
    if(select)select.value=getTeacherTimezone();
  }
}
document.addEventListener('DOMContentLoaded',()=>{
  const select=document.getElementById('teacher-timezone-select');
  if(select)select.value=getTeacherTimezone();
});
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

async function setRestAuthToken(session){
  if(!session?.access_token)return false;
  headers={
    ...headers,
    Authorization:'Bearer '+session.access_token
  };
  return true;
}

async function refreshRestAuthSession(){
  const {data,error}=await supabaseClient.auth.refreshSession();
  if(error)throw error;
  await setRestAuthToken(data?.session);
  return data?.session||null;
}

async function db(path,opt={},retryAuth=true){
  // Keep REST requests aligned with the current Supabase Auth session.
  try{
    const {data:{session}}=await supabaseClient.auth.getSession();
    await setRestAuthToken(session);
  }catch(e){
    console.warn('Could not read Supabase auth session:',e);
  }

  const r=await fetch(API+path,{
    ...opt,
    headers:{
      ...headers,
      ...(opt.headers||{})
    }
  });

  const t=await r.text();

  // A restored browser session can occasionally contain a JWT whose iat
  // is rejected by PostgREST as being in the future. Refresh the Auth
  // session once and retry the same request with the new access token.
  if(!r.ok && retryAuth && /PGRST303|JWT issued at future/i.test(t)){
    await refreshRestAuthSession();
    return db(path,opt,false);
  }

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
    db('/students?select=id,name,price,group_id,archived,email,telegram,telegram_chat_id,telegram_link_token,telegram_connected_at,telegram_notify_1h,telegram_notify_10m,telegram_notify_changes,telegram_notify_payments,telegram_notify_balance,google_meet_url,timezone'),
    db('/lessons?select=id,student,student_id,series_id,date,time,timezone,price,status,duration,group_id,comment'),
    db('/payments?select=id,student,student_id,amount,date'),
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

  const start=lessonTimestamp(l);
  if(!Number.isFinite(start))return null;
  return start+duration*60000;
}

const TAB_PATHS={dashboard:'/dashboard',calendar:'/calendar',students:'/students',materials:'/materials',admin:'/admin',settings:'/settings'};
function getTabFromPath(){
  const path=location.pathname.replace(/\/+$/,'')||'/';
  const entry=Object.entries(TAB_PATHS).find(([,route])=>route===path);
  return entry?.[0]==='calendar'?'dashboard':entry?.[0]||'dashboard';
}
function switchTab(t,options={}){
  if(t==='materials' && options.history!==false && !document.getElementById('tab-materials')?.classList.contains('hidden')){
    if(!window.dispatchEvent(new Event('profiprofit:return-material-library',{cancelable:true})))return;
  }
  if(t!=='materials' && !document.getElementById('tab-materials')?.classList.contains('hidden')){
    window.dispatchEvent(new Event('profiprofit:leave-materials'));
  }
  const allowed=['dashboard','calendar','students','materials','admin','settings'];
  if(!allowed.includes(t))t='dashboard';
  if(t==='calendar')t='dashboard';
  if(t==='admin'&&!platformAdmin)t='dashboard';
  ['dashboard','calendar','students','materials','admin','settings'].forEach(name=>{
    document.getElementById('tab-'+name)?.classList.toggle('hidden',t!==name);
    const side=document.querySelector('.native-sidebar [data-native-tab="'+name+'"]');
    if(side){side.classList.toggle('is-active',t===name);side.setAttribute('aria-current',t===name?'page':'false');}
    const nav=document.getElementById('nav-'+name);
    if(nav){
      nav.className='px-4 py-2 rounded-xl font-semibold '+(t===name?'bg-indigo-600 text-white':'bg-slate-100');
      if(name==='admin'&&!platformAdmin)nav.classList.add('hidden');
    }
  });
  const nextPath=TAB_PATHS[t];
  if(options.history!==false&&location.pathname!==nextPath){
    const method=options.replace?'replaceState':'pushState';
    history[method]({tab:t},'',nextPath+location.search+location.hash);
  }
  if(t==='admin')loadPlatformAdminDashboard();
  if(t==='materials')loadIntegratedMaterials();
}
window.addEventListener('popstate',()=>{
  if(!document.getElementById('teacher-app')?.classList.contains('hidden')){
    switchTab(getTabFromPath(),{history:false});
  }
});

function dashboardLessonCharge(l){
  if(!charge.has(l.status))return 0;
  if(!l.group_id)return Number(l.price||0);
  const members=lessonMembersFor(l);
  if(members.length)return members.reduce((sum,m)=>{if(m.charged===false)return sum;const s=students.find(x=>String(x.id)===String(m.student_id));return sum+Number(m.price??s?.price??0);},0);
  return lessonPriceTotal(l);
}

function dashboardStudentStats(student){
  const groupLessonIds=new Set(
    lessonMembersForStudent(student.id).map(m=>String(m.lesson_id))
  );
  const studentLessons=lessons.filter(l=>
    (!l.group_id&&String(l.student_id||'')===String(student.id))||groupLessonIds.has(String(l.id))
  );
  const income=payments.filter(p=>String(p.student_id||'')===String(student.id))
    .reduce((sum,p)=>sum+Number(p.amount||0),0);
  const expenses=studentLessons.filter(l=>charge.has(l.status))
    .reduce((sum,l)=>{
      if(!l.group_id)return sum+Number(l.price||0);
      const member=lessonMembersFor(l).find(m=>String(m.student_id)===String(student.id));
      return sum+(member&&member.charged!==false?Number(member.price??student.price??0):0);
    },0);
  return {ls:studentLessons,income,expenses,bal:income-expenses};
}

function lessonMembersForStudent(studentId){
  return lessonMembers.filter(m=>String(m.student_id)===String(studentId));
}

function renderTeacherHeaderGreeting(){
 const actions=document.querySelector('#teacher-header .teacher-header-actions');if(!actions)return;
 let el=actions.querySelector('.pp-teacher-greeting');if(!el){el=document.createElement('span');el.className='pp-teacher-greeting';actions.prepend(el);}
 const name=String(window.currentTeacherName||window.teacherProfile?.name||window.currentUser?.user_metadata?.full_name||window.currentUser?.user_metadata?.name||'').trim();
 el.textContent=(window.getLanguage?.()==='en'?'Hello':'Привет')+(name?', '+name:'')+'!';
}
function renderDashboard(){
 renderTeacherHeaderGreeting();
  const now=new Date(), today=localISO(now), month=today.slice(0,7);
  const active=students.filter(s=>!s.archived);
  const monthLessons=lessons.filter(l=>String(l.date||'').startsWith(month));
  const earnedMonth=monthLessons.reduce((sum,l)=>sum+dashboardLessonCharge(l),0);
  const earnedAll=lessons.reduce((sum,l)=>sum+dashboardLessonCharge(l),0);
  const receivedMonth=payments.filter(p=>String(p.date||'').startsWith(month)).reduce((sum,p)=>sum+Number(p.amount||0),0);
  const todayCount=lessons.filter(l=>l.date===today).length;
  const low=active.map(student=>{const stats=dashboardStudentStats(student);const price=Number(student.price||0);const remaining=price>0?Math.floor((stats.bal+1e-9)/price):Infinity;return {student,stats,price,remaining,status:stats.bal<0?'debt':remaining<=1?'topup':remaining===2?'low':'ok'};}).filter(x=>x.status!=='ok').sort((a,b)=>a.stats.bal-b.stats.bal);
  const en=typeof getLanguage==='function'&&getLanguage()==='en';
  let userName=String(
    window.currentTeacherName ||
    window.teacherProfile?.name ||
    window.currentUser?.user_metadata?.full_name ||
    window.currentUser?.user_metadata?.name ||
    window.currentUser?.email?.split('@')[0] ||
    ''
  ).trim();
  const duplicateName=userName.match(/^(.+?)\\s*\\(\\s*([^)]+)\\s*\\)$/);
  if(duplicateName&&duplicateName[1].trim().toLocaleLowerCase()===duplicateName[2].trim().toLocaleLowerCase()){
    userName=duplicateName[1].trim();
  }
  const greetingHour=Number(new Intl.DateTimeFormat('en-GB',{
    timeZone:getTeacherTimezone(),hour:'2-digit',hourCycle:'h23'
  }).format(now));
  const greeting=en
    ?(greetingHour<12?'Good morning':greetingHour<18?'Good afternoon':'Good evening')
    :(greetingHour<12?'Доброе утро':greetingHour<18?'Добрый день':'Добрый вечер');
  const greetingTitle=document.getElementById('dashboard-greeting-title');
  const greetingKicker=document.getElementById('dashboard-greeting-kicker');
  if(greetingTitle)greetingTitle.textContent=greeting+(userName?', '+userName:'')+'!';
  if(greetingKicker)greetingKicker.textContent=en?'Welcome to ProfiProfit':'Рады видеть тебя в ProfiProfit';
  const dashboardDate=document.getElementById('dashboard-date');if(dashboardDate)dashboardDate.textContent=now.toLocaleDateString(en?'en-US':'ru-RU',{month:'long',year:'numeric'});
  const cards=[
    {label:en?'Active students':'Активные ученики',value:active.length,icon:'♙',action:"switchTab('students')"},
    {label:en?'Accrued this month':'Начислено за месяц',value:money(earnedMonth),icon:'₿'},
    {label:en?'Earned all time':'Заработано за всё время',value:money(earnedAll),icon:'↗'},
    {label:en?'Lessons today':'Занятий сегодня',value:todayCount,icon:'▦',action:'openTodayCalendar()'},
    {label:en?'Payments received this month':'Получено платежей за месяц',value:money(receivedMonth),icon:'＋',action:"switchTab('students')"},
    {label:en?'Low student balances':'Низкие балансы',value:low.length,icon:'!',action:"switchTab('students')"}
  ];
  document.getElementById('dashboard-cards').innerHTML=cards.map(c=>'<button '+(c.action?'onclick="'+c.action+'"':'')+' class="app-card rounded-2xl p-4 md:p-5 text-left border min-w-0"><div class="flex items-center justify-between gap-2 mb-3"><span class="text-xs md:text-sm text-slate-500">'+c.label+'</span><span class="text-xl">'+c.icon+'</span></div><div class="text-xl md:text-2xl font-bold break-words">'+c.value+'</div></button>').join('');
  document.getElementById('dashboard-summary') && (document.getElementById('dashboard-summary').innerHTML='<div class="flex justify-between gap-3"><span class="text-sm text-slate-500">'+(en?'Lessons this month':'Занятий в этом месяце')+'</span><strong>'+monthLessons.length+'</strong></div><div class="flex justify-between gap-3"><span class="text-sm text-slate-500">'+(en?'Lessons today':'Занятий сегодня')+'</span><strong>'+todayCount+'</strong></div><div class="flex justify-between gap-3"><span class="text-sm text-slate-500">'+(en?'Active students':'Активных учеников')+'</span><strong>'+active.length+'</strong></div>');
  const lowContainer=document.getElementById('dashboard-low-balances');
  if(lowContainer)lowContainer.innerHTML=low.length?low.slice(0,5).map(x=>{const label=x.status==='debt'?(en?'Debt':'Задолженность'):x.status==='topup'?(en?'Top up needed':'Нужно пополнить'):(en?'Low balance':'Низкий баланс');const color=x.status==='debt'?'text-red-700':x.status==='topup'?'text-orange-600':'text-amber-600';const count=x.status==='debt'?'':(en?' · '+x.remaining+' lessons left':' · осталось занятий: '+x.remaining);return '<button onclick="switchTab(\'students\')" class="w-full flex flex-col gap-1 text-left border-b last:border-0 py-2"><span class="flex justify-between gap-3"><span class="font-medium">'+esc(x.student.name)+'</span><span class="text-sm '+color+'">'+label+'</span></span><span class="flex justify-between gap-3 text-xs text-slate-500"><span>'+money(x.stats.bal)+count+'</span></span></button>';}).join(''):'<p class="text-sm text-slate-500">'+(en?'No low balances':'Нет учеников с низким балансом')+'</p>';
}

function openTodayCalendar(){selectedDate=todayISOInTimezone(getTeacherTimezone());weekAnchor=dateAtLocalNoon(selectedDate);switchTab('dashboard');renderWeek();document.getElementById('dashboard-calendar')?.scrollIntoView({block:'start',behavior:'smooth'});}
function fillStudentSelects(){
  const active=sortedActiveStudents();

  const studentOptions=active
    .map(s=>
      `<option value="student:${esc(s.id)}">${esc(s.name)}</option>`
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

  if(p){const previous=p.value;p.innerHTML='<option value="" disabled selected>Выберите ученика</option>'+studentOptions;if(previous&&Array.from(p.options).some(o=>o.value===previous))p.value=previous;const button=document.getElementById('add-payment-submit');if(button)button.disabled=!p.value;}
}

function updateLessonGroupButton(){
  const e=document.getElementById(
    'lesson-add-to-group-btn'
  );

  const sel=document.getElementById('edit-student');

  if(!e||!sel)return;

  const selectedId=sel.value.startsWith('student:')?sel.value.slice(8):'';
  const s=students.find(x=>String(x.id)===String(selectedId));

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
        timezone:getTeacherTimezone(),
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

    const studentValue=document.getElementById(
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
      !studentValue||
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

      const previousStatus=l?.status;
      const statusChanged=!!l&&previousStatus!==status;
      const shouldOfferChangeNotice=statusChanged&&["rescheduled","cancelled_charge","cancelled_free"].includes(status);
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
              timezone:getTeacherTimezone(),
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
              student:students.find(s=>String(s.id)===String(studentValue.replace(/^student:/,'')))?.name||l.student,
              student_id:students.find(s=>String(s.id)===String(studentValue.replace(/^student:/,'')))?.id||l.student_id||null,
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
      }

      if(shouldOfferChangeNotice){
        const notify=await askTelegramChangeNotification();
        if(notify){
          const {data,error}=await supabaseClient.functions.invoke("notify-lesson-change",{
            body:{event:status==="rescheduled"?"rescheduled":"cancelled",lesson_ids:[String(id)]}
          });
          if(error)showError(new Error("Занятие изменено, но уведомление отправить не удалось: "+error.message));
          else showNotificationResult(data);
        }
      }
    }else{
      const groupId=
        studentValue.startsWith('group:')
          ?studentValue.slice(6)
          :null;
      const individualStudentId=studentValue.startsWith('student:')?studentValue.slice(8):null;
      const individualStudent=students.find(s=>String(s.id)===String(individualStudentId));
      if(!groupId&&!individualStudent)throw new Error('Не удалось определить ученика по ID. Обновите страницу и попробуйте снова.');

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
              student:individualStudent.name,
              student_id:individualStudent.id,
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
            p.comment,
            null,
            p.seriesId
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
        p.comment,
        null,
        null
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

function showNotificationResult(data){
  const results=Array.isArray(data?.results)?data.results:[];
  const sent=results.reduce((n,x)=>n+Number(x.sent||0),0);
  const failed=results.reduce((n,x)=>n+Number(x.failed||0),0);
  const skipped=results.reduce((n,x)=>n+Number(x.skipped_count||0),0);
  const errorLabels={
    lesson_lookup_failed:'ошибка чтения занятия',
    lesson_members_lookup_failed:'ошибка чтения участников группы',
    students_lookup_failed:'ошибка поиска учеников',
  };
  const skippedLabels={
    invalid_deleted_snapshot:'неполные данные удалённого занятия',
    lesson_not_found:'занятие не найдено',
    no_lesson_members:'у группового занятия нет участников',
    no_students_found:'ученики не найдены',
    lesson_has_no_student:'занятие не связано с учеником',
  };
  const errors=[...new Set(results.map(x=>errorLabels[x.error]).filter(Boolean))];
  const reasons=[...new Set(results.map(x=>skippedLabels[x.skipped]).filter(Boolean))];
  const details=[];
  if(errors.length)details.push('Причины ошибок: '+errors.join('; ')+'.');
  if(reasons.length)details.push('Пропущено: '+reasons.join('; ')+'.');
  if(failed||skipped||!sent){
    showError(new Error('Telegram: отправлено '+sent+', ошибки '+failed+', пропущено '+skipped+'. '+(details.join(' ')||'Проверьте подключение и настройки уведомлений.')));
  }else{
    alert('Telegram-уведомления отправлены: '+sent);
  }
}
async function deleteLesson(id){
  if(lessonDeleteInProgress)return false;
  if(!confirm('Удалить это занятие?'))return false;
  const lesson=lessons.find(x=>String(x.id)===String(id));
  const notify=!!lesson&&confirm('Удалить занятие. Отправить ученику уведомление об удалении в Telegram?');
  lessonDeleteInProgress=true;
  showBlockingLoader('Удаляем занятие…');
  try{
    await db(
      '/lessons?id=eq.'+encodeURIComponent(id),
      {method:'DELETE',headers}
    );
    if(notify){
      const studentIds=lesson.group_id?lessonMembersFor(lesson).map(m=>String(m.student_id)):(lesson.student_id?[String(lesson.student_id)]:[]);
      const {data,error}=await supabaseClient.functions.invoke('notify-lesson-change',{
        body:{event:'deleted',deleted_lessons:[{lesson_id:String(lesson.id),date:lesson.date,time:lesson.time,student_ids:studentIds}]}
      });
      if(error)showError(new Error('Занятие удалено, но уведомление отправить не удалось: '+error.message));
      else showNotificationResult(data);
    }
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
  // Older recurring lessons were created before series_id existed. For those
  // records, identify the same recurring slot by group/student + time +
  // duration + timezone, rather than blocking "this and following".
  const legacy=!l.series_id;
  if(legacy&&!isGroup&&!l.student_id){
    showError(new Error('У этого старого занятия нет ни идентификатора серии, ни привязки к ученику. Безопасно определить следующие занятия невозможно.'));
    return;
  }
  const sameSlot=x=>{
    if(x.date<l.date)return false;
    if(String(x.time||'').slice(0,5)!==String(l.time||'').slice(0,5))return false;
    if(Number(x.duration||60)!==Number(l.duration||60))return false;
    if(String(x.timezone||'Europe/Minsk')!==String(l.timezone||'Europe/Minsk'))return false;
    if(isGroup)return String(x.group_id||'')===String(l.group_id);
    return !x.group_id&&String(x.student_id||'')===String(l.student_id);
  };
  const targets=legacy
    ?lessons.filter(sameSlot)
    :lessons.filter(x=>String(x.series_id)===String(l.series_id)&&x.date>=l.date);
  if(!targets.some(x=>String(x.id)===String(l.id))){
    showError(new Error('Не удалось безопасно определить занятия этой серии. Ничего не удалено.'));
    return;
  }
  if(!confirm(
    (legacy?'Старое расписание: ':'')+
    (isGroup
      ?'удалить это групповое занятие и все следующие занятия этой группы начиная с '+l.date+'?'
      :'удалить это занятие и все следующие у этого ученика начиная с '+l.date+'?')+
    (legacy?' Будут выбраны занятия того же ученика/группы, времени, длительности и часового пояса.':'')
  ))return;
  const notify=targets.length>0&&confirm('Удалить занятия. Отправить ученикам уведомление об удалении расписания в Telegram?');

  lessonDeleteInProgress=true;
  showBlockingLoader('Удаляем занятия…');
  const deletedIds=[];
  try{
    for(const x of targets){
      await db('/lessons?id=eq.'+encodeURIComponent(x.id),{
        method:'DELETE',
        headers
      });
      deletedIds.push(String(x.id));
    }

    if(notify){
      const deletedLessons=targets.filter(x=>deletedIds.includes(String(x.id))).map(x=>({
        lesson_id:String(x.id),date:x.date,time:x.time,
        student_ids:x.group_id?lessonMembersFor(x).map(m=>String(m.student_id)):(x.student_id?[String(x.student_id)]:[])
      }));
      const {data,error}=await supabaseClient.functions.invoke('notify-lesson-change',{
        body:{event:'deleted',deleted_lessons:deletedLessons}
      });
      if(error)showError(new Error('Занятия удалены, но уведомление отправить не удалось: '+error.message));
      else showNotificationResult(data);
    }

    closeLessonModal();
    await loadData();
    renderWeek();
    renderDay();
  }catch(e){
    if(deletedIds.length){
      try{
        await loadData();
        renderWeek();
        renderDay();
      }catch(refreshError){
        console.error('Could not refresh lessons after partial deletion:',refreshError);
      }
      const deletedDates=targets
        .filter(x=>deletedIds.includes(String(x.id)))
        .map(x=>x.date);
      const remainingDates=targets
        .filter(x=>!deletedIds.includes(String(x.id)))
        .map(x=>x.date);
      showError(new Error(
        'Удалось удалить '+deletedIds.length+' из '+targets.length+' занятий. '+
        'Удалены даты: '+deletedDates.join(', ')+'. '+
        'Не удалены даты: '+remainingDates.join(', ')+'. '+
        'Telegram-уведомление не отправлялось. Ошибка: '+(e?.message||e)
      ));
    }else{
      showError(e);
    }
  }finally{
    lessonDeleteInProgress=false;
    hideBlockingLoader();
  }
}

function askTelegramChangeNotification(){
  return new Promise(resolve=>{
    const en=typeof getLanguage==='function'&&getLanguage()==='en';
    const overlay=document.createElement('div');
    overlay.className='fixed inset-0 modal-bg z-[100] flex items-center justify-center p-4';
    const card=document.createElement('div');
    card.className='app-card rounded-2xl p-5 w-full max-w-sm space-y-4 shadow-2xl';
    const title=document.createElement('h3');
    title.className='text-base font-semibold';
    title.textContent=en?'Schedule updated. Send a Telegram notification to the student?':'Расписание изменено. Отправить ученику уведомление в Telegram?';
    const actions=document.createElement('div');
    actions.className='flex gap-3';
    const send=document.createElement('button');
    send.type='button';
    send.className='primary-btn flex-1 rounded-xl px-3 py-2 font-semibold';
    send.textContent=en?'Send':'Отправить';
    const skip=document.createElement('button');
    skip.type='button';
    skip.className='soft-input flex-1 rounded-xl px-3 py-2 font-semibold';
    skip.textContent=en?"Don't send":'Не отправлять';
    const finish=value=>{
      overlay.remove();
      resolve(value);
    };
    send.addEventListener('click',()=>finish(true));
    skip.addEventListener('click',()=>finish(false));
    overlay.addEventListener('click',event=>{if(event.target===overlay)finish(false)});
    card.append(title,actions);
    actions.append(send,skip);
    overlay.append(card);
    document.body.append(overlay);
  });
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

const TURNSTILE_SITE_KEY='0x4AAAAAAFWyPC9oBP3FKPXq';
let turnstileWidgetId=null;
let turnstileWidgetContainerId='';
let turnstileRegisterToken='';
function onTurnstileLoad(){
  renderTurnstileWidget();
}
function renderTurnstileWidget(){
  if(!window.turnstile)return;
  const loginForm=document.getElementById('auth-login-form');
  const registerForm=document.getElementById('auth-register-form');
  const isRegister=registerForm&&!registerForm.classList.contains('hidden');
  const containerId=isRegister?'turnstile-register-container':'turnstile-login-container';
  const container=document.getElementById(containerId);
  if(!container||(!isRegister&&(!loginForm||loginForm.classList.contains('hidden'))))return;
  if(turnstileWidgetId!==null&&turnstileWidgetContainerId===containerId)return;
  if(turnstileWidgetId!==null){
    try{window.turnstile.remove(turnstileWidgetId)}catch(e){}
    turnstileWidgetId=null;
    turnstileRegisterToken='';
  }
  turnstileWidgetContainerId=containerId;
  turnstileWidgetId=window.turnstile.render(container,{
    sitekey:TURNSTILE_SITE_KEY,
    callback:token=>{turnstileRegisterToken=token;},
    'expired-callback':()=>{turnstileRegisterToken='';},
    'error-callback':()=>{turnstileRegisterToken='';}
  });
}
function resetTurnstileWidget(){
  turnstileRegisterToken='';
  if(window.turnstile&&turnstileWidgetId!==null){
    try{window.turnstile.reset(turnstileWidgetId)}catch(e){}
  }
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
  renderTurnstileWidget();
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

  if(!turnstileRegisterToken){
    renderTurnstileWidget();
    errorEl.textContent='Подтвердите проверку Cloudflare и дождитесь её завершения.';
    return;
  }

  try{
    const {data,error}=await supabaseClient.auth.signUp({
      email,
      password,
      options:{
        emailRedirectTo:'https://ttsnmrz-cmd.github.io/tutor-finance/',
        captchaToken:turnstileRegisterToken
      }
    });

    if(error)throw error;

    resetTurnstileWidget();

    // Supabase may return a successful-looking response for an existing
    // confirmed email to avoid exposing account existence through an error.
    if(data.user && Array.isArray(data.user.identities) && data.user.identities.length===0){
      errorEl.className='text-sm text-red-600';
      errorEl.textContent='Аккаунт с такой почтой уже зарегистрирован. Войдите или восстановите пароль.';
      return;
    }

    if(data.session){
      location.reload();
      return;
    }

    errorEl.className='text-sm text-emerald-600';
    errorEl.textContent='Аккаунт создан. Проверьте email для подтверждения.';
  }catch(e){
    console.error(e);
    resetTurnstileWidget();
    errorEl.className='text-sm text-red-600';
    errorEl.textContent=e.message||'Не удалось зарегистрироваться';
  }
}

let platformAdmin=false;
function formatPlatformDate(value){
  if(!value)return '—';
  const date=new Date(value);
  return Number.isNaN(date.getTime())?'—':date.toLocaleString('ru-RU');
}
async function initializePlatformMonitoring(){
  try{ await supabaseClient.rpc('record_teacher_activity'); }
  catch(e){ console.warn('Could not record teacher activity:',e); }
  try{
    const {data,error}=await supabaseClient.rpc('get_platform_admin_dashboard');
    platformAdmin=!error&&!!data;
  }catch(e){ platformAdmin=false; }
  const nav=document.getElementById('nav-admin');
  if(nav)nav.classList.toggle('hidden',!platformAdmin);
  const menu=document.getElementById('profile-menu');
  if(menu){
    let entry=menu.querySelector('[data-platform-admin-entry]');
    if(!entry){entry=document.createElement('button');entry.type='button';entry.className='profile-menu-item';entry.dataset.platformAdminEntry='1';entry.onclick=()=>{if(!platformAdmin)return;menu.classList.add('hidden');document.getElementById('teacher-header')?.classList.remove('pp-mobile-profile');document.getElementById('profile-menu-button')?.setAttribute('aria-expanded','false');switchTab('admin');};menu.insertBefore(entry,menu.querySelector('.profile-menu-divider'));}
    entry.hidden=!platformAdmin;entry.style.display=platformAdmin?'':'none';entry.textContent=window.getLanguage?.()==='en'?'Admin':'Админ';
  }
  renderTeacherHeaderGreeting();
}
async function loadPlatformAdminDashboard(){
  const panel=document.getElementById('platform-admin-content');
  if(!panel)return;
  panel.innerHTML='<p class="text-sm text-slate-500">Загружаем данные…</p>';
  try{
    const {data,error}=await supabaseClient.rpc('get_platform_admin_dashboard');
    if(error)throw error;
    if(!data||!Array.isArray(data.teachers))throw new Error('Нет доступа к админ-панели');
    const teachers=data.teachers;
    panel.innerHTML=
      '<div class="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">'+
      '<div class="app-card rounded-2xl p-4"><div class="text-sm text-slate-500">Всего учителей</div><div class="text-2xl font-bold mt-1">'+Number(data.total_teachers||0)+'</div></div>'+
      '<div class="app-card rounded-2xl p-4"><div class="text-sm text-slate-500">Новых за 7 дней</div><div class="text-2xl font-bold mt-1">'+Number(data.new_last_7_days||0)+'</div></div>'+
      '<div class="app-card rounded-2xl p-4 col-span-2 lg:col-span-1"><div class="text-sm text-slate-500">Активны за 7 дней</div><div class="text-2xl font-bold mt-1">'+Number(data.active_last_7_days||0)+'</div></div></div>'+
      '<div class="overflow-x-auto app-card rounded-2xl"><table class="w-full text-sm"><thead><tr class="text-left border-b border-slate-200"><th class="p-3">Учитель</th><th class="p-3">Регистрация</th><th class="p-3">Ученики</th><th class="p-3">Занятия</th><th class="p-3">Последнее использование</th></tr></thead><tbody>'+
      teachers.map(t=>'<tr class="border-b border-slate-100"><td class="p-3 font-medium">'+esc(t.email||t.id)+'</td><td class="p-3 whitespace-nowrap">'+esc(formatPlatformDate(t.registered_at))+'</td><td class="p-3">'+Number(t.students_count||0)+'</td><td class="p-3">'+Number(t.lessons_count||0)+'</td><td class="p-3 whitespace-nowrap">'+esc(formatPlatformDate(t.last_seen_at))+'</td></tr>').join('')+
      '</tbody></table></div>';
  }catch(e){
    const nav=document.getElementById('nav-admin');
    if(nav)nav.classList.add('hidden');
    panel.innerHTML='<p class="text-sm text-red-600">Не удалось загрузить админ-панель. Проверь, что миграция 008 применена и твой user ID добавлен в platform_admins.</p>';
    console.error('Platform admin dashboard error:',e);
  }
}
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'){
    supabaseClient.auth.getSession().then(({data})=>{
      if(data?.session)supabaseClient.rpc('record_teacher_activity').then(()=>{}).catch(()=>{});
    }).catch(()=>{});
  }
});

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

  if(!turnstileRegisterToken){
    renderTurnstileWidget();
    errorEl.textContent='Подтвердите проверку Cloudflare и дождитесь её завершения.';
    return;
  }

  try{

    const {
      data,
      error
    } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
      options:{captchaToken:turnstileRegisterToken}
    });

    resetTurnstileWidget();

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
    await initializePlatformMonitoring();

    // Populate the dashboard immediately after login instead of leaving
    // its empty placeholders visible until the user changes tabs.
    renderDashboard();
    renderWeek();
    renderDay();
    renderStudents();
    switchTab(getTabFromPath(),{replace:true});

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
let publicStudentWeekAnchor=null;
let publicStudentCalendarLessons=[];
let publicStudentLiveStatuses=new Map();

function switchPublicStudentTab(tab){
 ensureStudentPortalLayout();
 if(!['dashboard','lessons','finances'].includes(tab))return;
 document.querySelectorAll('[data-student-tab]').forEach(b=>b.classList.toggle('is-active',b.dataset.studentTab===tab));
 ['dashboard','lessons','finances'].forEach(t=>document.getElementById('student-portal-'+t)?.classList.toggle('hidden',t!==tab));
}
async function openPublicCalendarLesson(index){
 const l=publicStudentCalendarLessons[index];
 if(!l||['cancelled_free','cancelled_charge','rescheduled'].includes(l.status))return;
 const live=publicStudentLiveStatuses.get(String(l.id));
 if(!live?.has_material){window.alert('Please wait until your teacher assigns a material to this lesson.');return;}


 const studentId=new URLSearchParams(location.search).get('student');
 try{
  const {data,error}=await supabaseClient.rpc('get_public_student_lesson_material',{p_student_id:studentId,p_calendar_lesson_id:Number(l.id)});
  if(error)throw error;
  if(!data?.plan)throw Error('Lesson material is not available.');
  sessionStorage.setItem('pp-student-live-lesson',JSON.stringify({studentId,lessonId:Number(l.id)}));
 showPublicLessonMaterial(data,studentId,Number(l.id));
 }catch(e){window.alert('Unable to open lesson: '+(e.message||e));}
}
function ensureStudentQuickActions(){
 const header=document.querySelector('#student-public-view .student-brand-header[data-shared-header="1"]');
 if(!header)return null;
 let bar=document.querySelector('#student-public-view .pp-student-quick-actions');
 if(!bar){bar=document.createElement('div');bar.className='pp-student-quick-actions';header.after(bar);}
 let meet=bar.querySelector('.pp-student-meet');
 if(!meet){meet=document.createElement('a');meet.className='pp-student-join pp-student-meet';meet.target='_blank';meet.rel='noopener noreferrer';meet.textContent='Google Meet ↗';bar.append(meet);}
 let url;try{url=new URL(publicStudent?.google_meet_url||'');}catch{}
 meet.hidden=!(url?.protocol==='https:'&&url.hostname==='meet.google.com');
 if(!meet.hidden)meet.href=url.href;else meet.removeAttribute('href');
 return bar;
}
function updatePublicJoinButton(){
 const header=ensureStudentQuickActions();
 if(!header)return;
 let button=header.querySelector('.pp-student-join:not(.pp-student-homework):not(.pp-student-meet)');
 if(!button){button=document.createElement('button');button.type='button';button.className='pp-student-join';header.prepend(button);}
 const candidates=publicStudentCalendarLessons.filter(l=>!['cancelled_free','cancelled_charge','rescheduled'].includes(l.status)&&publicStudentLiveStatuses.get(String(l.id))?.has_material);
 const lesson=candidates.find(l=>publicCalendarTimeStatus(l)==='in_progress')||candidates.find(l=>publicCalendarTimeStatus(l)==='scheduled')||candidates[candidates.length-1];
 button.hidden=!lesson;
 button.textContent=window.getLanguage?.()==='en'?'Join lesson →':'Перейти на занятие →';
 button.onclick=async()=>{if(!lesson||button.disabled)return;button.disabled=true;try{await openPublicCalendarLesson(publicStudentCalendarLessons.indexOf(lesson));}finally{button.disabled=false;}};
}
let publicJoinPolling=false;
function startPublicJoinPolling(studentId){
 if(publicJoinPolling)return;publicJoinPolling=true;
 async function refresh(){
  try{const {data,error}=await supabaseClient.rpc('get_public_student_live_status',{p_student_id:studentId});
   if(!error&&Array.isArray(data)){const next=new Map(data.map(x=>[String(x.calendar_lesson_id),x]));const changed=JSON.stringify([...next])!==JSON.stringify([...publicStudentLiveStatuses]);publicStudentLiveStatuses=next;renderPublicStudentCalendar();updatePublicJoinButton();}
  }catch(e){console.warn('Live lesson status refresh failed',e);}
  finally{setTimeout(refresh,3000);}
 }
 setTimeout(refresh,3000);
}
function studentPortalSidebar(onNavigate){
 // Clone the actual teacher workspace navigation, rather than recreating it.
 const original=document.querySelector('#teacher-app .native-sidebar');
 if(!original)throw new Error('Teacher sidebar component is unavailable');
 const nav=original.cloneNode(true);
 nav.className='native-sidebar pp-student-native-sidebar';
 // Same toggle icon and visual states as the teacher sidebar; only navigation targets differ.
 const teacherToggle=original.querySelector('.native-sidebar-toggle');
 const studentToggle=nav.querySelector('.native-sidebar-toggle');
 if(teacherToggle&&studentToggle)studentToggle.innerHTML=teacherToggle.innerHTML;
 nav.setAttribute('aria-label','Student navigation');
 nav.querySelectorAll('[onclick]').forEach(el=>el.removeAttribute('onclick'));
 const label=nav.querySelector('.native-sidebar-label');if(label)label.textContent='STUDENT WORKSPACE';
 const footer=nav.querySelector('.native-sidebar-footer');if(footer)footer.textContent='ProfiProfit · Student workspace';
 const buttons=[...nav.querySelectorAll('[data-native-tab]')];
 const items=[['dashboard','Dashboard'],['lessons','Lessons'],['finances','Payments']];
 buttons.forEach((button,i)=>{
  if(!items[i]){button.remove();return;}
  const [tab,title]=items[i];button.dataset.studentTab=tab;button.removeAttribute('data-native-tab');
  button.classList.toggle('is-active',tab==='dashboard');
  const caption=button.querySelector('.native-nav-text');if(caption)caption.textContent=title;
  button.title=title;button.onclick=()=>onNavigate(tab);
 });
 const toggle=nav.querySelector('.native-sidebar-toggle');
 if(toggle){toggle.onclick=()=>{const layout=nav.closest('.native-layout');if(!layout)return;layout.classList.toggle('sidebar-collapsed');localStorage.setItem('pp-student-sidebar-collapsed',layout.classList.contains('sidebar-collapsed')?'1':'0');};}
 return nav;
}
function restoreStudentSidebar(layout){
 if(localStorage.getItem('pp-student-sidebar-collapsed')==='1')layout.classList.add('sidebar-collapsed');
}

/* One shared AppHeader DOM contract for teacher, student dashboard and live lesson.
   Role-specific actions live inside .app-header-actions; geometry is CSS-only. */
function prepareAppHeader(header,role){
 if(!header)return null;
 header.classList.add('app-header');
 header.dataset.appHeaderRole=role;
 const brand=header.querySelector(':scope > .app-header-brand, :scope > button:not(#pp-mobile-menu):not([data-mobile-menu])');
 if(brand)brand.classList.add('app-header-brand');
 const actions=header.querySelector(':scope > .teacher-header-actions, :scope > .pp-student-header-actions');
 if(actions)actions.classList.add('app-header-actions');
 return header;
}
/* Initialize the teacher's shared header even when no student portal is opened. */
document.addEventListener('DOMContentLoaded',()=>prepareAppHeader(document.getElementById('teacher-header'),'teacher'));
function createAppHeader(role){
 const teacher=document.getElementById('teacher-header');
 if(!teacher)return null;
 prepareAppHeader(teacher,'teacher');
 if(role==='teacher')return teacher;
 const header=teacher.cloneNode(true);
 header.querySelector('#pp-mobile-menu')?.remove();
 header.removeAttribute('id');
 header.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
 header.querySelectorAll('[onclick]').forEach(el=>el.removeAttribute('onclick'));
 header.querySelector('.teacher-header-actions')?.remove();
 const brand=header.querySelector(':scope > button:not(#pp-mobile-menu):not([data-mobile-menu])');
 if(brand){brand.onclick=null;brand.removeAttribute('title');brand.style.cursor='default';}
 const subtitle=brand?.querySelector('.text-slate-500');
 if(subtitle){subtitle.removeAttribute('data-i18n');subtitle.textContent=homeworkText('Your space to learn','Твоё пространство для учёбы');}
 return prepareAppHeader(header,role);
}
const ppStudentBackgrounds={
 cars:{en:'Racing cars',ru:'Машинки',color:'#182b45',art:'<path d="M0 180L320 20M0 230L320 70" stroke="#71839a" stroke-width="38"/><path d="M0 205L320 45" stroke="#f4d36c" stroke-width="3" stroke-dasharray="16 14"/><g transform="translate(85 72) rotate(-25 65 35)"><rect x="0" y="12" width="130" height="48" rx="18" fill="#e34b43"/><rect x="36" y="16" width="55" height="40" rx="10" fill="#17283c"/><path d="M8 20h15M8 52h15M108 20h14M108 52h14" stroke="#f8e9ae" stroke-width="6"/><path d="M28 12v48M98 12v48" stroke="#f7f7f7" stroke-width="4"/></g>'},
 space:{en:'Space',ru:'Космос',color:'#191d45',art:'<g fill="#e6e9ff"><circle cx="20" cy="30" r="2"/><circle cx="170" cy="35" r="3"/><circle cx="290" cy="90" r="2"/><circle cx="65" cy="180" r="3"/><circle cx="240" cy="210" r="2"/></g><circle cx="95" cy="85" r="38" fill="#9b78d5"/><ellipse cx="95" cy="85" rx="65" ry="12" fill="none" stroke="#e4bd8c" stroke-width="8" transform="rotate(-25 95 85)"/><circle cx="245" cy="155" r="29" fill="#5a9cce"/><path d="M220 145q25 25 50 0" fill="none" stroke="#91d3c5" stroke-width="9"/>'},
 animals:{en:'Animals',ru:'Животные',color:'#426b59',art:'<g fill="#91b894"><path d="M0 220L60 65l60 155M210 220l55-160 55 160"/><circle cx="25" cy="35" r="18"/><circle cx="290" cy="30" r="20"/></g><g transform="translate(110 65)"><path d="M0 0L45 22 90 0 83 65 45 100 7 65Z" fill="#dc8a47"/><path d="M7 48L45 100 83 48 45 65Z" fill="#fff0d6"/><circle cx="26" cy="43" r="5" fill="#28312d"/><circle cx="64" cy="43" r="5" fill="#28312d"/><circle cx="45" cy="72" r="6" fill="#28312d"/></g>'},
 gaming:{en:'Gaming',ru:'Игровой мир',color:'#77a9c6',art:'<g shape-rendering="crispEdges"><path d="M0 170h40v-35h40v-35h40v35h40v35h40v-65h40v-35h40v35h40v135H0Z" fill="#437b65"/><path d="M0 190h320v50H0Z" fill="#806047"/><path d="M0 180h320v20H0Z" fill="#83b94e"/><path d="M35 30h60v15h20v15H20V45h15ZM210 20h60v15h20v15h-95V35h15Z" fill="#e7f2ef"/><path d="M145 145h30v30h-30Z" fill="#eac15e"/><path d="M150 150h20v5h-20Z" fill="#fff2b0"/></g>'}
};
const ppWallpaperKeys=['cars','space','animals','gaming'];
for(const key of ppWallpaperKeys){ppStudentBackgrounds['wallpaper-'+key]={...ppStudentBackgrounds[key],wallpaper:key+'.webp'};}
function ppStudentBackgroundKey(){return 'pp-student-background:'+new URLSearchParams(location.search).get('student');}
function ppStudentBackgroundChoice(){try{return localStorage.getItem(ppStudentBackgroundKey())||'default';}catch{return 'default';}}
function ppStudentBackgroundImage(key){const item=ppStudentBackgrounds[key];if(item?.wallpaper){const url=supabaseClient.storage.from('classroom-backgrounds').getPublicUrl(item.wallpaper).data.publicUrl;return 'url("'+url+'")';}return item?'url("data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240"><rect width="320" height="240" fill="'+item.color+'"/>'+item.art+'</svg>')+'")':'none';}
function ppApplyStudentBackground(){
 if(!new URLSearchParams(location.search).get('student'))return;
 const key=ppStudentBackgroundChoice(),item=ppStudentBackgrounds[key];
 document.documentElement.style.setProperty('--pp-personal-bg',ppStudentBackgroundImage(key));
 document.documentElement.toggleAttribute('data-pp-student-background',!!item);
 document.documentElement.toggleAttribute('data-pp-wallpaper',!!item?.wallpaper);
 if(!document.getElementById('pp-personal-background-css')){const style=document.createElement('style');style.id='pp-personal-background-css';style.textContent='html[data-pp-student-background] #student-public-view,html[data-pp-student-background] #student-live-material{background-image:linear-gradient(#ffffff55,#ffffff55),var(--pp-personal-bg)!important;background-size:auto,320px 240px!important;background-repeat:repeat!important}html[data-theme="dark"][data-pp-student-background] #student-public-view,html[data-theme="dark"][data-pp-student-background] #student-live-material{background-image:linear-gradient(#16132088,#16132088),var(--pp-personal-bg)!important}html[data-pp-student-background] #student-live-material .pp-student-live-main{background:transparent!important}html[data-pp-wallpaper] #student-public-view,html[data-pp-wallpaper] #student-live-material{background-size:cover!important;background-position:center!important;background-repeat:no-repeat!important;background-attachment:fixed!important}html[data-pp-student-background] #student-public-view :is(.app-card,section,div):has(> #public-week-calendar),html[data-pp-student-background] #student-public-view :is(.app-card,section,div):has(> #public-lessons-history){background:color-mix(in srgb,var(--card-bg,#fff) 75%,transparent)!important;backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}';document.head.append(style);}
}
function ppOpenStudentBackgrounds(){
 const en=window.getLanguage?.()==='en';const d=document.createElement('dialog');d.style.cssText='margin:auto;width:min(480px,92vw);max-height:85vh;overflow:auto;padding:20px;border:1px solid #827a9066;border-radius:16px;background:'+(document.documentElement.dataset.theme==='dark'?'#292536;color:#eeeaf5':'#fff;color:#1f242d');
 const h=document.createElement('h2');h.textContent=en?'Personalize your classroom':'Оформление кабинета';h.style.cssText='font-size:20px;font-weight:700;margin:0 0 16px';d.append(h);
 const grid=document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px';
 for(const key of ['default','wallpapers-heading',...ppWallpaperKeys.map(k=>'wallpaper-'+k),'illustrations-heading',...ppWallpaperKeys]){if(key.endsWith('-heading')){const heading=document.createElement('h3');heading.style.cssText='grid-column:1/-1;font-size:14px;font-weight:700;margin:8px 0 0';heading.textContent=key==='wallpapers-heading'?(en?'Wallpapers':'Обои'):(en?'Illustrations':'Иллюстрации');grid.append(heading);continue;}const item=ppStudentBackgrounds[key],b=document.createElement('button');b.type='button';b.style.cssText='border:1px solid #827a9066;border-radius:10px;padding:8px;color:inherit;text-align:left';const preview=document.createElement('div');preview.style.cssText='height:90px;border-radius:6px;margin-bottom:6px;background-color:#827a9022;background-size:cover;background-position:center';preview.style.backgroundImage=ppStudentBackgroundImage(key);const label=document.createElement('span');label.textContent=(item?(en?item.en:item.ru):(en?'Default':'Стандартный'))+(ppStudentBackgroundChoice()===key?' ✓':'');b.append(preview,label);b.onclick=()=>{try{localStorage.setItem(ppStudentBackgroundKey(),key);}catch{alert(en?'Unable to save background':'Не удалось сохранить фон');return;}ppApplyStudentBackground();d.close();};grid.append(b);}
 d.append(grid);const close=document.createElement('button');close.type='button';close.textContent=en?'Close':'Закрыть';close.style.cssText='margin-top:16px;padding:8px 14px;border:1px solid #827a9066;border-radius:8px';close.onclick=()=>d.close();d.append(close);d.addEventListener('close',()=>d.remove(),{once:true});document.body.append(d);d.showModal();
}
function installStudentProfileMenu(actions){
 ppApplyStudentBackground();
 actions.querySelectorAll('.pp-student-settings,.pp-student-theme-toggle').forEach(n=>n.remove());
 const wrap=document.createElement('div');wrap.className='pp-student-settings';
 const trigger=document.createElement('button');trigger.type='button';trigger.className='pp-student-settings-trigger';trigger.setAttribute('aria-label','Profile settings');trigger.setAttribute('aria-expanded','false');
 trigger.innerHTML='<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg>';
 const menu=document.createElement('div');menu.className='pp-student-settings-menu';menu.hidden=true;
 const close=()=>{menu.hidden=true;trigger.setAttribute('aria-expanded','false');};
 function refresh(){const en=window.getLanguage?.()==='en',dark=document.documentElement.dataset.theme==='dark';menu.replaceChildren();
 for(const [lang,label] of [['ru','Русский'],['en','English']]){const b=document.createElement('button');b.type='button';b.textContent=label+(lang===(en?'en':'ru')?' ✓':'');b.onclick=()=>{window.setLanguage?.(lang);close();location.reload();};menu.append(b);}
 const theme=document.createElement('button');theme.type='button';theme.textContent=dark?(en?'☀ Light theme':'☀ Светлая тема'):(en?'☾ Dark theme':'☾ Тёмная тема');theme.onclick=()=>{if(typeof toggleDarkMode==='function')toggleDarkMode();refresh();close();};menu.append(theme);const background=document.createElement('button');background.type='button';background.textContent=en?'🎨 Background':'🎨 Фон кабинета';background.onclick=()=>{close();ppOpenStudentBackgrounds();};menu.append(background);}
 trigger.onclick=()=>{if(!menu.hidden){close();return;}refresh();menu.hidden=false;trigger.setAttribute('aria-expanded','true');};
 wrap.addEventListener('focusout',e=>{if(!wrap.contains(e.relatedTarget))close();});wrap.addEventListener('keydown',e=>{if(e.key==='Escape'){close();trigger.focus();}});
 wrap.append(trigger,menu);actions.append(wrap);
}
function syncStudentPortalHeader(){
 // The student portal uses the actual teacher header DOM, not a second brand implementation.
 const portal=document.getElementById('student-public-view');
 const old=portal?.querySelector('.student-brand-header');
 if(!portal||!old||old.dataset.sharedHeader==='1')return;
 const header=createAppHeader('student');
 if(!header)return;
 header.classList.add('student-brand-header');
 header.dataset.sharedHeader='1';
 old.replaceWith(header);
 // Keep the balance in the shared header; the existing balance renderer updates
 // the same #public-dashboard-balance node after it has been moved.
 const dashboardBalance=document.getElementById('public-dashboard-balance');
 const balanceCard=dashboardBalance?.closest('.student-theme-panel');
 if(balanceCard){
   balanceCard.classList.add('pp-student-header-balance');
   const actions=document.createElement('div');
   actions.className='pp-student-header-actions app-header-actions';
   actions.append(balanceCard);
   // Move the existing student name node (not a duplicate) to the far right.
   // The dashboard renderer can continue updating #public-student-title.
   const studentTitle=document.getElementById('public-student-title');
   const greeting=studentTitle?.parentElement;
   if(greeting){
     greeting.classList.add('pp-student-header-greeting');
     const tagline=greeting.querySelector('p');
     if(tagline)tagline.remove();
     actions.append(greeting);
   }
   header.append(actions);
   installStudentProfileMenu(actions);
 }
}
function ensureStudentPortalLayout(){
 const portal=document.getElementById('student-public-view');
 if(!portal)return;
 syncStudentPortalHeader();
 if(portal.classList.contains('pp-student-one-page'))return;
 const content=portal.querySelector('#student-public-content');
 if(!content)return;
 // One-page student dashboard: no sidebar, tabs or cloned navigation.
 const oldTabs=content.querySelector('.student-portal-tabs');
 if(oldTabs)oldTabs.remove();
 ['dashboard','lessons','finances'].forEach(tab=>document.getElementById('student-portal-'+tab)?.classList.remove('hidden'));
 portal.classList.add('pp-student-one-page');
 if(document.getElementById('pp-student-shell-styles'))return;
 const style=document.createElement('style');style.id='pp-student-shell-styles';style.textContent=`
 #student-public-view{max-width:none!important}
 #student-public-view>.app-card{max-width:none!important}
 .pp-student-layout{align-items:start}
 .pp-student-layout>#student-public-content{flex:1;min-width:0}
 /* Teacher and student use the same cloned .native-sidebar component and
    the same static stylesheet. No student-only sidebar geometry or colors. */
 .pp-student-native-sidebar.native-sidebar{min-width:0;align-self:start}
 .pp-student-native-sidebar [data-student-tab]{display:flex;align-items:center}
 .pp-student-native-sidebar [data-student-tab].is-active{background:#EAE5F2;color:#4E2A84}
 .pp-student-live-main{width:100%}
 #student-live-material .pp-student-live-notes{min-height:0}
 #student-live-material .pp-student-live-content{align-items:stretch}

 #student-live-material .pp-student-live-layout{min-height:calc(100vh - 90px)}
 #student-live-material .pp-student-live-main{display:flex;flex-direction:column;min-height:calc(100vh - 120px)}
 #student-live-material .pp-student-live-content{flex:1;min-height:calc(100vh - 155px)}
 #student-live-material .pp-student-pointer{min-width:0;display:flex;flex-direction:column}
 #student-live-material .pp-student-pointer>div{flex:1;min-height:0}
 #student-live-material .pp-student-live-notes{display:flex;flex-direction:column}
 #student-live-material .pp-student-live-notes textarea{flex:1;min-height:0;resize:none;border:0;outline:0;box-shadow:none;cursor:default}
 #student-live-material .pp-student-profile-wrap{position:relative}
 #student-live-material .pp-student-profile-button{width:44px;height:44px;border-radius:12px;background:#eee8f7;color:#4b287e;font-size:26px}
 #student-live-material .pp-student-profile-menu{position:absolute;right:0;top:52px;z-index:100;background:var(--card-bg);color:var(--text-color);border:1px solid #e4dcef;box-shadow:0 12px 30px #24143225;border-radius:12px;padding:14px;min-width:190px}
 #student-live-material .pp-student-profile-menu[hidden]{display:none}
 #student-live-material .pp-student-profile-menu label,#student-live-material .pp-student-profile-menu button{display:block;margin-top:14px}
 #student-live-material .pp-student-profile-menu select{padding:5px}
 #student-live-material .pp-student-live-main{background:var(--card-bg);border-radius:var(--pp-classroom-radius,16px);padding:18px}
 #student-live-material .pp-student-pointer{background:transparent;border-radius:var(--pp-classroom-radius,16px);overflow:hidden}
 #student-live-material .pp-student-profile-menu{min-width:240px;padding:18px;border-radius:18px;font-size:15px}
 #student-live-material .pp-student-menu-title{display:block;color:#746e84;font-size:14px;font-weight:600;margin-bottom:18px}
 #student-live-material .pp-student-profile-menu label{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0;padding:12px 0}
 #student-live-material .pp-student-profile-menu select{border:0;background:#f2f0f5;border-radius:9px;padding:9px;color:#4b287e}
 #student-live-material .pp-student-profile-menu button{width:100%;text-align:left;margin:0;padding:13px 0;color:inherit;background:transparent;border:0}
 #student-live-material .pp-student-profile-button{display:grid;place-items:center}
 /* Keep the student lesson aligned with the teacher's compact classroom layout. */
 /* Header uses the exact teacher DOM and its existing classes. */
 
 #student-live-material .pp-student-live-layout{padding:10px;gap:10px}
 #student-live-material .pp-student-live-main{padding:12px 16px}
 #student-live-material .pp-student-live-content{gap:12px}
 
 #student-live-material .pp-student-live-header{display:flex;align-items:center;justify-content:space-between}
 #student-live-material .pp-student-live-layout{padding:14px}
 

 #student-live-material .mb-builder.mb-student-preview .mb-student-card{border-color:var(--border-color)!important}
 #student-live-material .mb-builder.mb-student-preview .mb-preview-notes{border-color:var(--border-color)!important}
 #student-live-material .pp-student-live-main{min-width:0;flex:1}
 #student-live-material .pp-student-live-content{display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,27%);gap:14px}
 #student-live-material .pp-student-live-notes{background:var(--card-bg);border:1px solid var(--border-color);border-radius:var(--pp-classroom-radius,16px);padding:14px}
 #student-live-material .pp-student-live-notes textarea{width:100%;min-height:340px;background:var(--accent-soft);border-radius:10px;padding:12px;resize:vertical}
 #student-live-material .pp-student-live-tools{display:flex;gap:10px;align-items:center;margin-bottom:12px}
 #student-live-material .pp-student-pointer{position:relative}
 #student-live-material .pp-student-pointer canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none;z-index:2;pointer-events:none}
 #student-live-material .pp-student-pointer.drawing canvas{pointer-events:auto;cursor:crosshair}
 @media(max-width:780px){#student-live-material .pp-student-live-content{grid-template-columns:1fr}.pp-student-sidebar{width:58px}.pp-student-sidebar-label{display:none}}
 
 #student-live-material .pp-student-live-notes{background:var(--card-bg)!important;color:var(--text-color)!important;border-radius:var(--pp-classroom-radius,16px)!important;overflow:hidden}
 #student-live-material .pp-student-pointer,#student-live-material .pp-student-pointer>div,#student-live-material .pp-student-pointer .mb-builder{background:transparent!important;box-shadow:none!important}
 #student-live-material .pp-student-notes-content{background:var(--accent-soft)!important;color:var(--text-color)!important}
 #student-live-material .pp-student-live-main{color:var(--text-color)}

`;document.head.append(style);
}
// The public student dashboard is rendered before its first tab click.
// Initialize the shared teacher-style shell as soon as the portal becomes visible.
function initializePublicStudentShell(){
 const portal=document.getElementById('student-public-view');
 const content=document.getElementById('student-public-content');
 if(!portal||!content||portal.classList.contains('hidden')||content.classList.contains('hidden'))return false;
 ensureStudentPortalLayout();
 return portal.classList.contains('pp-student-one-page');
}
function watchPublicStudentShell(){
 const portal=document.getElementById('student-public-view');
 if(!portal)return;
 if(initializePublicStudentShell())return;
 const observer=new MutationObserver(()=>{
  if(initializePublicStudentShell())observer.disconnect();
 });
 observer.observe(portal,{attributes:true,attributeFilter:['class'],subtree:true});
}
if(document.readyState==='loading'){
 document.addEventListener('DOMContentLoaded',watchPublicStudentShell,{once:true});
}else{
 watchPublicStudentShell();
}

function showPublicLessonMaterial(data,studentId,lessonId){
 ensureStudentPortalLayout();
 let overlay=document.getElementById('student-live-material');
 if(!overlay){overlay=document.createElement('div');overlay.id='student-live-material';overlay.style.cssText='position:fixed;inset:0;z-index:99999;background:#f4f5f7;overflow:auto';document.body.append(overlay);}
 overlay._classroomCleanup?.();
 overlay._classroomCleanup=null;
 overlay.replaceChildren();
 // Reuse the SAME student dashboard header, including balance and theme toggle.
 const sourceHeader=document.querySelector('#student-public-view .app-header[data-shared-header="1"]');
 const header=sourceHeader ? sourceHeader.cloneNode(true) : createAppHeader('student');
 prepareAppHeader(header,'student');
 if(header){
   header.querySelectorAll(':scope > button:not(.app-header-brand)').forEach(node=>node.remove());
   header.querySelector('.pp-student-join')?.remove();
   header.querySelector('.pp-student-homework')?.remove();
   header.removeAttribute('id');
   header.classList.add('pp-student-live-header','student-brand-header');
   header.dataset.sharedHeader='1';
   header.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
   header.querySelectorAll('[onclick]').forEach(node=>node.removeAttribute('onclick'));
   const back=document.createElement('button');
   back.type='button';back.className='pp-student-return';
   back.textContent='← Back to dashboard';
   back.addEventListener('click',()=>{sessionStorage.removeItem('pp-student-live-lesson');overlay._classroomCleanup?.();overlay.remove();});
   const actions=header.querySelector('.pp-student-header-actions');
   if(actions){
     installStudentProfileMenu(actions);
     actions.prepend(back);
   }else header.append(back);
   overlay.append(header);
 }
 const layout=document.createElement('div');layout.className='pp-student-live-layout pp-student-live-one-page';
 const main=document.createElement('main');main.className='pp-student-live-main';
 const columns=document.createElement('div');columns.className='pp-student-live-content';
 const drawWrap=document.createElement('div');drawWrap.className='pp-student-pointer';
 const host=document.createElement('div');drawWrap.append(host);
 const notes=document.createElement('aside');notes.className='pp-student-live-notes';const notesTitle=document.createElement('h3');notesTitle.textContent='▤ Live Notes';notesTitle.style.cssText='font-weight:700;margin-bottom:12px';
 const noteArea=document.createElement('textarea');noteArea.placeholder='Teacher notes will appear here when live sharing is enabled.';noteArea.readOnly=true;notes.append(notesTitle,noteArea);
 columns.append(drawWrap,notes);main.append(columns);layout.append(main);overlay.append(layout);
 const richNotes=document.createElement('div');
 richNotes.className='pp-student-notes-content';
 richNotes.style.cssText='flex:1;min-height:340px;background:var(--accent-soft);color:var(--text-color);border-radius:10px;padding:12px;overflow:auto;overflow-wrap:anywhere;white-space:pre-wrap';
 richNotes.textContent=noteArea.placeholder;
 noteArea.replaceWith(richNotes);
 let previousNotes=null;
 async function refreshNotes(){
   if(!richNotes.isConnected)return;
   try{
     const response=await supabaseClient.rpc('get_public_calendar_notes',{p_student_id:studentId,p_calendar_lesson_id:lessonId});
     if(!richNotes.isConnected)return;
     if(response.error){if(previousNotes===null)richNotes.textContent='Could not load teacher notes. Retrying…';}
     else{const next=JSON.stringify(response.data);if(next!==previousNotes){previousNotes=next;renderSharedLessonNotes(richNotes,response.data);}}
   }catch{if(previousNotes===null&&richNotes.isConnected)richNotes.textContent='Could not load teacher notes. Retrying…';}
   finally{if(richNotes.isConnected)setTimeout(refreshNotes,1500);}
 }
 void refreshNotes();

 let materialSignature=JSON.stringify([data.session_id,data.plan]);
 function mountMaterial(next){
   overlay._classroomCleanup?.();
   overlay._classroomCleanup=window.mountProfiProfitStudentLesson(host,next.plan,supabaseClient,next.session_id,Number(lessonId));
 }
 if(typeof window.mountProfiProfitStudentLesson==='function')mountMaterial(data);
 else{host.textContent='Loading Classroom…';let count=0;const wait=setInterval(()=>{if(!host.isConnected){clearInterval(wait);return;}if(typeof window.mountProfiProfitStudentLesson==='function'){clearInterval(wait);mountMaterial(data);}else if(++count>30){clearInterval(wait);host.textContent='Classroom is unavailable. Please refresh the page.';}},300);}
 async function refreshMaterial(){
   if(!host.isConnected)return;
   try{
     const {data:next,error}=await supabaseClient.rpc('get_public_student_lesson_material',{p_student_id:studentId,p_calendar_lesson_id:lessonId});
     if(!host.isConnected||error||!next?.plan||typeof window.mountProfiProfitStudentLesson!=='function')return;
     const signature=JSON.stringify([next.session_id,next.plan]);
     if(signature!==materialSignature){
       sessionStorage.removeItem('student:'+next.session_id+':exercise');
       mountMaterial(next);
       materialSignature=signature;
     }
   }catch(e){console.warn('Live material refresh failed',e);}
   finally{if(host.isConnected)setTimeout(refreshMaterial,1500);}
 }
 setTimeout(refreshMaterial,1500);
}

function renderSharedLessonNotes(richNotes,value){
   const html=String(value?.html||'');
   if(!html){richNotes.textContent=value?.plain||'No teacher notes yet.';return;}
   const doc=new DOMParser().parseFromString(html,'text/html');
   const allowed=new Set(['B','STRONG','U','I','EM','UL','OL','LI','P','DIV','BR','SPAN','S','STRIKE']);
   function copy(node,parent){
     if(node.nodeType===3){parent.append(document.createTextNode(node.textContent));return;}
     if(node.nodeType!==1||['SCRIPT','STYLE','IFRAME','OBJECT'].includes(node.tagName))return;
     const target=allowed.has(node.tagName)?document.createElement(node.tagName.toLowerCase()):parent;
     if(target!==parent){
       if(node.tagName==='UL'||node.tagName==='OL'){
         target.style.setProperty('list-style-type',node.tagName==='UL'?'disc':'decimal','important');
         target.style.setProperty('padding-inline-start','1.5em','important');
       }
       if(node.tagName==='LI'){
         target.style.setProperty('display','list-item','important');
         target.style.setProperty('list-style-type','inherit','important');
       }
       parent.append(target);
     }
     for(const child of node.childNodes)copy(child,target);
   }
   const fragment=document.createDocumentFragment();
   for(const child of doc.body.childNodes)copy(child,fragment);
   richNotes.replaceChildren(fragment);
 }

function historyDateLabel(date){
 const d=new Date(String(date).slice(0,10)+'T12:00:00');
 if(!Number.isFinite(d.getTime()))return String(date||'');
 return d.toLocaleDateString(window.getLanguage?.()==='en'?'en-GB':'ru-RU',{day:'numeric',month:'long',year:'numeric'}).replace(/ г\.$/,' года');
}
function historyMaterialTitle(title){const t=String(title||'').trim();return t==='Live Notes'||/\d{4}-\d{2}-\d{2}$/.test(t)?'':t;}
async function renderPublicLessonsHistory(rows){
 const el=document.getElementById('public-lessons-history');if(!el)return;
 const past=Array.from(new Map(rows.filter(l=>['conducted','completed'].includes(l.status)).map(l=>[String(l.id),l])).values()).sort((a,b)=>(b.date+' '+b.time).localeCompare(a.date+' '+a.time));
 const studentId=new URLSearchParams(location.search).get('student');
 const layout=document.createElement('div');layout.className='pp-history-split';
 const makeColumn=title=>{const col=document.createElement('section'),heading=document.createElement('h3'),list=document.createElement('div');heading.textContent=title;list.className='pp-history-list';col.append(heading,list);layout.append(col);return list;};
 const lessons=makeColumn('Lessons'),notes=makeColumn('Notes');el.replaceChildren(layout);
 const cards=new Map(),withNotes=new Set();
 const filterLabel=document.createElement('label');filterLabel.style.cssText='display:flex;align-items:center;gap:8px;margin:8px 0 12px;font-size:13px;cursor:pointer';
 const filter=document.createElement('input');filter.type='checkbox';filter.style.cssText='width:16px!important;height:16px!important;min-height:0!important;flex:none;accent-color:#70509e';filter.disabled=true;
 const tr=(en,ru)=>document.documentElement.lang==='ru'?ru:en;
 filterLabel.append(filter,document.createTextNode(tr('Only lessons with notes','Только занятия с заметками')));lessons.before(filterLabel);
 const empty=document.createElement('p');empty.textContent=tr('No lessons with notes','Нет занятий с заметками');empty.style.display='none';lessons.append(empty);
 function applyNotesFilter(){for(const [id,button] of cards)button.style.display=filter.checked&&!withNotes.has(String(id))?'none':'';empty.style.display=filter.checked&&!withNotes.size?'':'none';}
 filter.onchange=applyNotesFilter;
 function label(l){return historyDateLabel(l.date);}
 function open(l,value){const dialog=document.getElementById('pp-student-lesson-dialog');if(!dialog)return;dialog.querySelector('[data-lesson-heading]').textContent=(historyMaterialTitle(value?.title)?historyMaterialTitle(value.title)+' · ':'')+label(l);renderSharedLessonNotes(dialog.querySelector('[data-lesson-notes]'),value);if(!dialog.open)dialog.showModal();}
 function card(l){const button=document.createElement('button');button.type='button';button.className='pp-student-lesson-row';button.textContent=label(l);return button;}
 for(const l of past){const button=card(l);cards.set(l.id,button);lessons.append(button);button.onclick=async()=>{const {data,error}=await supabaseClient.rpc('get_public_calendar_notes',{p_student_id:studentId,p_calendar_lesson_id:Number(l.id)});if(!error)open(l,data);};}
 if(!past.length){lessons.textContent='No completed lessons yet.';notes.textContent='No notes yet.';return;}
 notes.textContent='Loading notes…';let found=0,failed=false;
 for(let i=0;i<past.length;i+=8){const batch=await Promise.all(past.slice(i,i+8).map(async l=>{try{const {data,error}=await supabaseClient.rpc('get_public_calendar_notes',{p_student_id:studentId,p_calendar_lesson_id:Number(l.id)});return {l,data,error};}catch(error){return {l,error};}}));if(!layout.isConnected)return;
 for(const {l,data,error} of batch){if(error){failed=true;continue;}const plain=String(data?.plain||'').trim();if(!plain)continue;withNotes.add(String(l.id));if(!found++)notes.replaceChildren();const mark=document.createElement('span');mark.textContent=' ▤';mark.title='Has notes';cards.get(l.id)?.append(mark);const button=card(l);if(historyMaterialTitle(data?.title)){const heading=document.createElement('strong');heading.className='pp-note-title';heading.textContent=historyMaterialTitle(data.title);button.prepend(heading);}const excerpt=document.createElement('small');excerpt.textContent=plain.slice(0,140)+(plain.length>140?'…':'');button.append(excerpt);button.onclick=()=>open(l,data);notes.append(button);}
 }
 filter.disabled=failed;applyNotesFilter();
 if(!found)notes.textContent=failed?tr('Could not load all notes.','Не удалось загрузить все заметки.'):tr('No notes yet.','Пока нет заметок.');
}
function changePublicStudentWeek(offset){
  if(!publicStudentWeekAnchor)return;
  publicStudentWeekAnchor.setDate(publicStudentWeekAnchor.getDate()+offset*7);
  renderPublicStudentCalendar();
}

function publicCalendarTimeStatus(l){
 if(!['pending','scheduled','conducted','completed'].includes(l.status))return l.status;
 const now=dateTimePartsInTimezone(new Date(),isValidTimezone(publicStudent?.timezone)?publicStudent.timezone:'Europe/Minsk');
 const stamp=(date,time)=>Date.parse(date+'T'+String(time||'00:00').slice(0,5)+':00Z');
 const start=stamp(l.date,l.time),current=stamp(now.date,now.time);
 if(!Number.isFinite(start)||!Number.isFinite(current))return l.status;
 if(current>=start+Number(l.duration||60)*60000)return 'conducted';
 if(current>=start)return 'in_progress';
 return ['conducted','completed'].includes(l.status)?l.status:'scheduled';
}
function renderPublicStudentCalendar(lessonRows){
  if(Array.isArray(lessonRows))publicStudentCalendarLessons=lessonRows;
  const calendarLessons=publicStudentCalendarLessons;
  const grid=document.getElementById('public-week-calendar');
  const range=document.getElementById('public-week-range');
  if(!grid||!range){console.warn('Student calendar elements are missing from the page.');return;}
  if(!publicStudentWeekAnchor){
    const tz=isValidTimezone(publicStudent?.timezone)?publicStudent.timezone:'Europe/Minsk';
    const today=todayISOInTimezone(tz);
    publicStudentWeekAnchor=dateAtLocalNoon(today);
  }
  const start=new Date(publicStudentWeekAnchor);
  const day=start.getDay();
  start.setDate(start.getDate()+(day===0?-6:1-day));
  const lang=window.getLanguage?.()==='en'?'en-US':'ru-RU';
  const days=Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return d;});
  range.textContent=days[0].toLocaleDateString(lang,{day:'2-digit',month:'short'})+' — '+days[6].toLocaleDateString(lang,{day:'2-digit',month:'short',year:'numeric'});
  const today=todayISOInTimezone(isValidTimezone(publicStudent?.timezone)?publicStudent.timezone:'Europe/Minsk');
  grid.innerHTML=days.map(d=>{
    const key=localISO(d);
    const dayLessons=calendarLessons.filter(l=>l.date===key).sort((a,b)=>String(a.time||'').localeCompare(String(b.time||'')));
    return `<section class="calendar-day-column ${key===today?'is-today':''}">
      <div class="calendar-day-heading"><span class="calendar-weekday">${d.toLocaleDateString(lang,{weekday:'short'}).replace('.','')}</span><span class="calendar-day-number">${d.getDate()}</span></div>
      <div class="calendar-day-events">${dayLessons.length?dayLessons.map(l=>`<div class="calendar-event-card">
        <span class="calendar-event-time">${esc(displayTime(l.time))}</span>
        <span class="calendar-event-title ${['rescheduled','cancelled_charge','cancelled_free'].includes(l.status)?'is-cancelled':''}">${esc(l.student||'Занятие')}</span>
        <span class="calendar-event-meta">${l.duration||60} мин</span>
        <span class="calendar-event-meta">${esc(money(l.price??publicStudent?.price??0))}</span>
        <span class="status ${publicCalendarTimeStatus(l)==='in_progress'?'bg-green-100 text-green-800':statusClass[publicCalendarTimeStatus(l)]||'bg-slate-100 text-slate-700'}">${publicCalendarTimeStatus(l)==='in_progress'?'● In progress':statusLabels[publicCalendarTimeStatus(l)]||publicCalendarTimeStatus(l)}</span>
      </div>`).join(''):'<p class="calendar-empty-day">Нет занятий</p>'}</div>
    </section>`;
  }).join('');
}


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
    const live=await supabaseClient.rpc('get_public_student_live_status',{p_student_id:id});
    if(!live.error&&Array.isArray(live.data))publicStudentLiveStatuses=new Map(live.data.map(x=>[String(x.calendar_lesson_id),x]));
    else if(live.error)console.warn('Live status unavailable:',live.error.message);
    await openStudentCabinet();
    void refreshPublicHomework(id);
    // Restore an active lesson after a refresh, without requiring the student
    // to return to the dashboard or confirm joining again.
    try{
      const saved=JSON.parse(sessionStorage.getItem('pp-student-live-lesson')||'null');
      if(saved?.studentId===id&&Number.isSafeInteger(saved.lessonId)){
        const liveRow=publicStudentLiveStatuses.get(String(saved.lessonId));
        if(liveRow?.has_material){
          const resumed=await supabaseClient.rpc('get_public_student_lesson_material',{p_student_id:id,p_calendar_lesson_id:saved.lessonId});
          if(!resumed.error&&resumed.data?.plan)showPublicLessonMaterial(resumed.data,id,saved.lessonId);
          else sessionStorage.removeItem('pp-student-live-lesson');
        }else sessionStorage.removeItem('pp-student-live-lesson');
      }
    }catch(e){console.warn('Could not restore student lesson:',e);}


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

  const studentTimezone=isValidTimezone(publicStudent.timezone)?publicStudent.timezone:'Europe/Minsk';
  const ls=(publicStudentLessons||[]).map(l=>({
    ...l,
    ...lessonDateTimeInTimezone(l,studentTimezone)
  }));
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

  const nowParts=dateTimePartsInTimezone(new Date(),studentTimezone);
  const today=nowParts.date;
  const nowTime=nowParts.time;

  const future=ls
    .filter(
      l=>['pending','scheduled'].includes(l.status)&&(
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
    homeworkText('Hello, ','Привет, ')+publicStudent.name+'!';
  document.getElementById('public-student-meta').textContent=
    money(publicStudent.price||0);
  document.getElementById('public-paid').textContent=money(paid);
  document.getElementById('public-spent').textContent=money(spent);
  document.getElementById('public-balance').textContent=
    money(paid-spent);
  const conductedEl=document.getElementById('public-conducted');
  if(conductedEl){
    conductedEl.textContent=ls.filter(l=>l.status==='conducted').length;
  }

  const paymentsEl=document.getElementById('public-payments');
  if(paymentsEl)paymentsEl.innerHTML=
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

  const dashboardBalance=document.getElementById('public-dashboard-balance');if(dashboardBalance)dashboardBalance.textContent=money(paid-spent);
  const nextLesson=document.getElementById('public-next-lesson');if(nextLesson){const active=ls.find(l=>publicCalendarTimeStatus(l)==='in_progress');const next=active||future[0];nextLesson.textContent=next?(active?'🟢 Lesson in progress: ':'Next lesson: ')+next.date+' · '+displayTime(next.time):'No upcoming lessons scheduled.';}
  renderPublicLessonsHistory(ls);
  renderPublicStudentCalendar(ls);
  updatePublicJoinButton();
  startPublicJoinPolling(new URLSearchParams(location.search).get('student'));



  document.getElementById('student-public-login')
    .classList.add('hidden');
  document.getElementById('student-public-content')
    .classList.remove('hidden');


}

  async function initApp(){

  if(await initPublicStudent())return;

  try{

    const yearEl=document.getElementById('current-year');
    if(yearEl)yearEl.textContent=String(new Date().getFullYear());

    // On a full page refresh, prefer a freshly refreshed Auth session.
    // This avoids reusing a restored access token that PostgREST may reject
    // with PGRST303 ("JWT issued at future").
    let {
      data: { session },
      error
    } = await supabaseClient.auth.getSession();

    if(!error && session){
      try{
        const refreshed=await supabaseClient.auth.refreshSession();
        if(!refreshed.error && refreshed.data?.session){
          session=refreshed.data.session;
        }
      }catch(refreshError){
        console.warn('Could not refresh session on page load:',refreshError);
      }
    }

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

    window.currentUser=session.user;

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

    await loadTeacherTimezone(session.user?.id);

    // Supabase may still be finishing session restoration immediately
    // after a browser refresh. Give it one short retry instead of leaving
    // the dashboard empty if the first REST request races that process.
    let loaded=false;
    let lastError=null;
    for(let attempt=0;attempt<2&&!loaded;attempt++){
      try{
        await loadData();
        loaded=true;
      }catch(e){
        lastError=e;
        if(attempt===0){
          await new Promise(resolve=>setTimeout(resolve,500));
        }
      }
    }

    if(!loaded)throw lastError;
    await initializePlatformMonitoring();

    // A page refresh with an existing session goes through initApp(),
    // not loginTeacher(). Render the dashboard on this path too.
    renderDashboard();
    renderWeek();
    renderDay();
    renderStudents();
    switchTab(getTabFromPath(),{replace:true});

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
    '&select=student_id,price'
  );

  // A group lesson total is the sum of the member price snapshots.
  // Never recalculate old lessons from the students' current profile prices.
  const total=(members||[]).reduce(
    (sum,m)=>sum+Number(m.price??0),
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
  if(scope==='following'&&!ctx.anchor.series_id){
    showError(new Error('Это старое групповое занятие не имеет идентификатора серии. Массовое изменение участников недоступно.'));
    return;
  }

  try{
    const targets=
      scope==='one'
        ?[ctx.anchor]
        :lessons.filter(
          x=>String(x.series_id)===String(ctx.anchor.series_id)&&x.date>=ctx.anchor.date
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
  if(scope==='following'&&!ctx.anchor.series_id){
    showError(new Error('Это старое групповое занятие не имеет идентификатора серии. Массовое изменение участников недоступно.'));
    return;
  }

  try{
    const targets=
      scope==='one'
        ?[ctx.anchor]
        :lessons.filter(
          x=>String(x.series_id)===String(ctx.anchor.series_id)&&x.date>=ctx.anchor.date
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
document.addEventListener('click',event=>{
  if(!event.target.closest('#lesson-delete-menu'))closeLessonDeleteMenu();
  if(!event.target.closest('#lesson-save-menu'))closeLessonSaveMenu();
});

if(document.readyState === 'loading'){
  document.addEventListener(
    'DOMContentLoaded',
    initApp
  );
}else{
  initApp();
}


function openHelp(){
  document.getElementById('profile-menu')?.classList.add('hidden');
  document.getElementById('profile-menu-button')?.setAttribute('aria-expanded','false');
  const modal=document.getElementById('help-modal');
  if(modal){modal.classList.remove('hidden');modal.classList.add('flex');}
}
function closeHelp(){
  const modal=document.getElementById('help-modal');
  if(modal){modal.classList.add('hidden');modal.classList.remove('flex');}
}
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeHelp()});

async function loadNativeMaterials(){
 const status=document.getElementById('materials-status'),host=document.getElementById('materials-library');
 if(!status||!host)return;
 status.textContent='Загружаем материалы…';host.replaceChildren();
 try{
  const auth=await supabaseClient.auth.getUser();
  if(auth.error||!auth.data.user)throw Error('Войдите в ProfiProfit.');
  const teacher=auth.data.user.id;
  const [folders,materials]=await Promise.all([
   supabaseClient.from('learning_folders').select('id,title,parent_id,position').eq('teacher_id',teacher).order('position'),
   supabaseClient.from('learning_materials').select('id,title,folder_id,updated_at').eq('teacher_id',teacher).order('updated_at',{ascending:false})
  ]);
  if(folders.error||materials.error)throw Error('Библиотека ещё не подключена к основной базе ProfiProfit.');
  const fs=folders.data||[],ms=materials.data||[];
  const render=(parent,depth)=>{
   if(depth>30)return;
   fs.filter(f=>f.parent_id===parent).forEach(f=>{const row=document.createElement('div');row.className='rounded-xl bg-slate-50 px-3 py-2 font-semibold';row.style.marginLeft=(depth*16)+'px';row.textContent='📁 '+f.title;host.append(row);render(f.id,depth+1);});
   ms.filter(x=>x.folder_id===parent).forEach(x=>{const row=document.createElement('div');row.className='rounded-xl border border-slate-100 px-3 py-2';row.style.marginLeft=(depth*16)+'px';row.textContent='📄 '+x.title;host.append(row);});
  };
  render(null,0);status.textContent=fs.length+' папок · '+ms.length+' материалов';
  if(!fs.length&&!ms.length)status.textContent+=' — библиотека пока пустая.';
 }catch(error){status.textContent=error?.message||'Не удалось загрузить библиотеку.';}
}

// React Classroom mounts only in Materials and reuses this app's authenticated client.
let classroomMountCleanup=null;
async function loadIntegratedMaterials(){
 const host=document.getElementById('classroom-materials-root');
 if(!host)return loadNativeMaterials();
 if(classroomMountCleanup)return;
 if(typeof window.mountProfiProfitMaterials!=='function'){
  host.textContent='Classroom builder is unavailable; showing existing materials.';
  document.getElementById('native-materials-fallback')?.classList.remove('hidden');
  return loadNativeMaterials();
 }
 try{
  const {data,error}=await supabaseClient.auth.getUser();
  if(error||!data.user)throw Error('Please sign in again.');
  classroomMountCleanup=window.mountProfiProfitMaterials(host,data.user.id,supabaseClient);
 }catch(error){
  host.textContent='Cannot open Classroom: '+error.message;
  document.getElementById('native-materials-fallback')?.classList.remove('hidden');
  await loadNativeMaterials();
 }
}

 
// Homework uses the existing public cabinet credential and shared exercise renderer.
let publicHomeworkRows=[];
function homeworkText(en,ru){return window.getLanguage?.()==='en'?en:ru;}
async function refreshPublicHomework(studentId){
 ensureStudentPortalLayout();
 const actions=ensureStudentQuickActions();
 if(!actions)return;
 let button=actions.querySelector('.pp-student-homework');
 if(!button){button=document.createElement('button');button.type='button';button.className='pp-student-join pp-student-homework';actions.append(button);}
 button.hidden=false;
 button.textContent=homeworkText('Homework','Домашняя работа');
 button.onclick=()=>openPublicHomeworkList(studentId);
 try{
  const {data,error}=await supabaseClient.rpc('get_public_student_homework',{p_student_id:studentId});
  if(error)throw error;
  publicHomeworkRows=Array.isArray(data)?data:[];
  const count=publicHomeworkRows.filter(r=>['assigned','in_progress','returned'].includes(r.status)).length;
  button.textContent=homeworkText('Homework','Домашняя работа')+(count?' ('+count+')':'');
 }catch(e){console.warn('Homework list unavailable',e);}
}
async function openPublicHomeworkList(studentId){
 const dialog=document.createElement('dialog');dialog.className='app-card';dialog.style.cssText='width:min(640px,94vw);max-height:85vh;overflow:auto;background:var(--card-bg);color:var(--text-color)';
 const title=document.createElement('h2');title.textContent=homeworkText('Homework','Домашняя работа');
 const close=document.createElement('button');close.type='button';close.className='pp-student-return';close.textContent=homeworkText('Close','Закрыть');close.onclick=()=>dialog.close();
 const list=document.createElement('div');list.textContent=homeworkText('Loading…','Загрузка…');
 const headingRow=document.createElement('div');headingRow.className='pp-student-dialog-heading';headingRow.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px';title.style.margin='0';close.style.fontSize='14px';headingRow.append(title,close);dialog.append(headingRow,list);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
 try{
  const {data,error}=await supabaseClient.rpc('get_public_student_homework',{p_student_id:studentId});if(error)throw error;
  if(!dialog.isConnected)return;
  list.replaceChildren();
  const labels={assigned:homeworkText('Assigned','Назначено'),in_progress:homeworkText('In progress','В процессе'),submitted:homeworkText('Submitted','Сдано'),reviewed:homeworkText('Reviewed','Проверено'),returned:homeworkText('Returned','На исправлении')};
  for(const row of Array.isArray(data)?data:[]){
   const card=document.createElement('div');card.className='student-theme-panel';card.style.cssText='padding:12px;margin:10px 0';
   const heading=document.createElement('h3');heading.textContent=row.title;
   const meta=document.createElement('p');meta.textContent=(labels[row.status]||row.status)+(row.due_date?' · '+homeworkText('Due: ','До: ')+row.due_date:'');
   const note=document.createElement('p');note.textContent=row.instructions||'';
   const open=document.createElement('button');open.type='button';open.className='pp-student-join';open.textContent=homeworkText('Open homework','Открыть задание');
   open.onclick=async()=>{open.disabled=true;try{const {data:assignment,error}=await supabaseClient.rpc('get_public_student_homework_material',{p_student_id:studentId,p_assignment_id:row.id});if(error)throw error;if(!assignment?.plan)throw Error(homeworkText('Homework unavailable','Задание недоступно'));if(!dialog.isConnected)return;dialog.close();showPublicHomeworkMaterial(assignment,studentId);}catch(e){alert(e.message||e);}finally{open.disabled=false;}};
   card.append(heading);if(row.status!=='assigned')card.append(meta);if(row.instructions)card.append(note);card.append(open);list.append(card);
  }
  if(!list.children.length)list.textContent=homeworkText('No homework assigned','Нет домашних заданий');
  void refreshPublicHomework(studentId);
 }catch(e){list.textContent=homeworkText('Unable to load homework: ','Не удалось загрузить задания: ')+(e.message||e);}
}
function showPublicHomeworkMaterial(assignment,studentId){
 const overlay=document.createElement('div');overlay.id='student-live-material';overlay.dataset.mode='homework';overlay.style.cssText='position:fixed;inset:0;z-index:99999;background:var(--card-bg);overflow:auto';
 const source=document.querySelector('#student-public-view .app-header[data-shared-header="1"]');
 const header=source?source.cloneNode(true):createAppHeader('student');
 const back=document.createElement('button');back.type='button';back.className='pp-student-return';back.textContent=homeworkText('← Homework','← Домашняя работа');
 let cleanup,timer,queue=Promise.resolve(),dirty=false,busy=false;
 let answers=assignment.answers||{},readOnly=['submitted','reviewed'].includes(assignment.status);
 const status=document.createElement('span');
 const submit=document.createElement('button');submit.type='button';submit.className='pp-student-join';submit.textContent=homeworkText('Submit homework','Сдать домашнюю работу');submit.hidden=readOnly;
 function save(final=false){
  clearTimeout(timer);
  const snapshot=JSON.parse(JSON.stringify(answers));
  const task=queue.catch(()=>{}).then(async()=>{
   status.textContent=homeworkText('Saving…','Сохранение…');
   const {error}=await supabaseClient.rpc('save_public_student_homework',{p_student_id:studentId,p_assignment_id:assignment.id,p_answers:snapshot,p_submit:final});
   if(error)throw error;
   if(JSON.stringify(snapshot)===JSON.stringify(answers))dirty=false;
   status.textContent=final?homeworkText('Submitted','Сдано'):homeworkText('Saved','Сохранено');
  });
  queue=task;return task.catch(e=>{status.textContent=homeworkText('Not saved: ','Не сохранено: ')+(e.message||e);throw e;});
 }
 function onChange(next){if(readOnly||busy)return;answers=next;dirty=true;clearTimeout(timer);timer=setTimeout(()=>{void save().catch(()=>{});},500);}
 back.onclick=async()=>{if(busy)return;busy=true;try{if(dirty)await save();else await queue;cleanup?.();overlay.remove();void openPublicHomeworkList(studentId);}catch(e){alert(e.message||e);}finally{busy=false;}};
 submit.onclick=async()=>{if(busy||readOnly||!confirm(homeworkText('Submit this homework? You cannot edit it after submission.','Сдать работу? После сдачи редактирование будет недоступно.')))return;busy=true;submit.disabled=true;try{await save(true);readOnly=true;void refreshPublicHomework(studentId);const done=document.createElement('dialog');done.className='app-card';done.style.width='min(420px,92vw)';const heading=document.createElement('h2');heading.textContent=homeworkText('✓ Homework submitted','✓ Домашняя работа сдана');const message=document.createElement('p');message.textContent=homeworkText('Your homework has been submitted successfully.','Домашняя работа успешно отправлена преподавателю.');const finish=document.createElement('button');finish.type='button';finish.className='pp-student-join';finish.style.cssText='display:block;width:100%;margin-top:20px';finish.textContent=homeworkText('Close','Закрыть');finish.onclick=()=>done.close();done.append(heading,message,finish);document.body.append(done);done.addEventListener('close',()=>{done.remove();cleanup?.();overlay.remove();void openPublicHomeworkList(studentId);},{once:true});submit.hidden=true;done.showModal();}catch(e){alert(e.message||e);}finally{busy=false;submit.disabled=false;}};
 if(header){header.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));header.querySelectorAll('[onclick]').forEach(n=>n.removeAttribute('onclick'));header.querySelectorAll('.pp-student-join').forEach(n=>n.remove());const actions=header.querySelector('.pp-student-header-actions');if(actions){installStudentProfileMenu(actions);actions.prepend(back);}else header.append(back);overlay.append(header);}else overlay.append(back);
 const main=document.createElement('main');main.className='pp-student-live-main';
 const host=document.createElement('div');const toolbar=document.createElement('div');toolbar.className='pp-homework-toolbar';status.className='pp-homework-save-status';submit.classList.add('pp-homework-submit');toolbar.append(status,submit);main.append(toolbar,host);overlay.append(main);document.body.append(overlay);
 // The snapshot contains only the assigned section. Normalize its stage flag
 // for the existing student renderer, which excludes homework during live lessons.
 const plan={...assignment.plan,stages:assignment.plan.stages.map(s=>({...s,homework:false}))};
 let attempts=0;
 function mount(){if(!host.isConnected)return;if(typeof window.mountProfiProfitHomework==='function'){cleanup=window.mountProfiProfitHomework(host,plan,supabaseClient,{id:assignment.id,answers,readOnly,onChange});return;}if(++attempts<30){host.textContent=homeworkText('Loading…','Загрузка…');setTimeout(mount,300);}else host.textContent=homeworkText('Classroom unavailable. Refresh the page.','Редактор недоступен. Обновите страницу.');}
 mount();
}
