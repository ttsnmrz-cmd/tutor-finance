function weekStart(d){
  const x=new Date(d);
  x.setHours(0,0,0,0);

  const day=x.getDay();

  x.setDate(
    x.getDate()+(day===0?-6:1-day)
  );

  return x;
}

function changeWeek(n){
  weekAnchor=weekStart(weekAnchor);

  weekAnchor.setDate(
    weekAnchor.getDate()+n*7
  );

  selectedDate=localISO(weekAnchor);

  renderWeek();
  renderDay();
}

function goToday(){
  weekAnchor=new Date();
  selectedDate=localISO(new Date());

  renderWeek();
  renderDay();
}

function displayTime(v){
  if(!v)return '';

  const a=String(v)
    .replace('.',':')
    .split(':');

  return String(Number(a[0])).padStart(2,'0')+
    '.'+
    String(a[1]||'00').padStart(2,'0');
}
function renderWeek(){
  const c=document.getElementById('week-calendar');

  const start=weekStart(weekAnchor);
  const today=localISO(new Date());
  const days=[];

  for(let i=0;i<7;i++){
    const d=new Date(start);
    d.setDate(d.getDate()+i);
    days.push(d);
  }

  document.getElementById('week-range').textContent=
    days[0].toLocaleDateString('ru-RU',{
      day:'2-digit',
      month:'long'
    })+
    ' — '+
    days[6].toLocaleDateString('ru-RU',{
      day:'2-digit',
      month:'long',
      year:'numeric'
    });

  c.innerHTML=days.map(d=>{
    const key=localISO(d);
    const has=lessons.some(l=>l.date===key);
    const sel=key===selectedDate;
    const isToday=key===today;

    return `<button onclick="selectDay('${key}')" class="flex flex-col items-center py-2">
      <div class="text-xs text-slate-400 mb-1">
        ${d.toLocaleDateString('ru-RU',{weekday:'short'}).replace('.','')}
      </div>
      <div class="day-circle ${sel?'selected ':''}${isToday?'today':''}">
        <span class="font-bold">${d.getDate()}</span>
        ${has?'<span class="day-dot"></span>':'<span class="h-[7px]"></span>'}
      </div>
    </button>`;
  }).join('');
}

function selectDay(k){
  selectedDate=k;
  renderWeek();
  renderDay();
}
function renderDay(){
  const title=document.getElementById('selected-day-title');

  const d=new Date(selectedDate+'T00:00:00');

  title.textContent=
    d.toLocaleDateString('ru-RU',{
      weekday:'long',
      day:'numeric',
      month:'long'
    });

  const ls=lessons
    .filter(l=>l.date===selectedDate)
    .sort(
      (a,b)=>
        String(a.time||'').localeCompare(
          String(b.time||'')
        )
    );

  document.getElementById('day-lessons').innerHTML=
    ls.length
      ?ls.map(l=>
        `<button onclick="openEditLesson('${esc(l.id)}')" class="w-full text-left border-b last:border-0 py-3 flex items-center gap-3 hover:bg-slate-50 rounded-xl px-2">
          <div class="w-16 font-bold">
            ${esc(displayTime(l.time))}
          </div>

          <div class="flex-1">
            <div class="font-semibold ${['rescheduled','cancelled_charge','cancelled_free'].includes(l.status)?'line-through opacity-60':''}">
              ${esc(lessonTitle(l))}
            </div>

            <div class="text-xs text-slate-500 ${['rescheduled','cancelled_charge','cancelled_free'].includes(l.status)?'line-through opacity-60':''}">
              ${l.duration||60} мин · ${money(lessonPriceTotal(l))}
            </div>

            ${l.comment
              ?'<div class="text-xs text-slate-500 mt-1">'+
                esc(l.comment)+
                '</div>'
              :''
            }
          </div>

          <span class="status ${statusClass[l.status]||'bg-slate-100'}">
            ${statusLabels[l.status]||l.status}
          </span>
        </button>`
      ).join('')
      :'<div class="py-8 text-center text-slate-400">На этот день занятий нет</div>';
}

/*
 * Teacher ownership and public student cabinet bridge.
 * Loaded after app.js, so the DOMContentLoaded handler in app.js
 * uses these patched global functions when it fires.
 */
(function(){
  const originalDb=window.db;

  function tableName(path){
    const m=String(path||'').match(/^\/(students|lessons|payments|groups|lesson_members)(?=[?]|$)/);
    return m&&m[1];
  }

  function currentUserId(){
    try{
      const token=(window.supabaseClient&&window.supabaseClient.auth)
        ?null:null;
    }catch(e){}
    return null;
  }

  window.db=async function(path,opt={}){
    const table=tableName(path);
    if(!table)return originalDb(path,opt);

    const sessionResult=await supabaseClient.auth.getSession();
    const session=sessionResult?.data?.session;
    const uid=session?.user?.id;

    // Public student pages use the dedicated SECURITY DEFINER RPC below.
    if(!uid)return originalDb(path,opt);

    let nextPath=String(path);
    const method=String(opt.method||'GET').toUpperCase();

    if(method==='GET'){
      nextPath += (nextPath.includes('?')?'&':'?')+
        'teacher_id=eq.'+encodeURIComponent(uid);
    }else if(['PATCH','DELETE'].includes(method)){
      nextPath += (nextPath.includes('?')?'&':'?')+
        'teacher_id=eq.'+encodeURIComponent(uid);
    }

    if(method==='POST'){
      let body=opt.body;
      try{
        const obj=typeof body==='string'?JSON.parse(body):(body||{});
        if(obj.teacher_id==null)obj.teacher_id=uid;
        opt={...opt,body:JSON.stringify(obj)};
      }catch(e){}
    }

    return originalDb(nextPath,opt);
  };

  window.initPublicStudent=async function(){
    const id=new URLSearchParams(location.search).get('student');
    if(!id)return false;

    document.getElementById('student-public-view')?.classList.remove('hidden');

    try{
      const {data,error}=await supabaseClient.rpc(
        'get_public_student_cabinet',
        {p_student_id:id}
      );

      if(error)throw error;

      if(!data?.student){
        document.getElementById('student-public-name').textContent='Ученик не найден';
        return true;
      }

      window.publicStudent=data.student;
      const ls=Array.isArray(data.lessons)?data.lessons:[];
      const ps=Array.isArray(data.payments)?data.payments:[];

      document.getElementById('student-public-name').textContent=
        'Ученик: '+publicStudent.name;

      const paid=ps.reduce((a,p)=>a+Number(p.amount||0),0);
      const charges=ls.filter(l=>charge.has(l.status)).sort((a,b)=>(String(b.date)+String(b.time)).localeCompare(String(a.date)+String(a.time)));
      const spent=charges.reduce((a,l)=>a+Number(l.price||0),0);
      const now=new Date();
      const today=localISO(now);
      const nowTime=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
      const future=ls.filter(l=>l.status==='pending'&&(l.date>today||(l.date===today&&String(l.time||'23:59').slice(0,5)>=nowTime))).sort((a,b)=>(String(a.date)+String(a.time)).localeCompare(String(b.date)+String(b.time)));
      const upcoming=future.slice(0,5);
      const cutoff=upcoming.length?upcoming[upcoming.length-1].date:null;
      const visible=ls.filter(l=>!cutoff||l.date<=cutoff).sort((a,b)=>(String(a.date)+String(a.time)).localeCompare(String(b.date)+String(b.time)));

      document.getElementById('public-student-title').textContent=publicStudent.name;
      document.getElementById('public-student-meta').textContent='Стоимость занятия: '+money(publicStudent.price||0);
      document.getElementById('public-paid').textContent=money(paid);
      document.getElementById('public-spent').textContent=money(spent);
      document.getElementById('public-balance').textContent=money(paid-spent);
      document.getElementById('public-conducted').textContent=ls.filter(l=>l.status==='conducted').length;
      document.getElementById('public-price').textContent=money(publicStudent.price||0);

      document.getElementById('public-payments').innerHTML=ps.sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(p=>
        `<div class="flex justify-between border-b border-slate-200 py-1"><span>${esc(p.date)}</span><b class="text-emerald-600">+${money(p.amount)}</b></div>`
      ).join('')||'<span class="text-slate-400">Пополнений нет</span>';

      document.getElementById('public-lessons').innerHTML=visible.map(l=>
        `<div class="rounded-2xl border border-slate-200 p-3 flex justify-between items-center gap-3"><div><div class="font-semibold">${esc(l.date)}</div><div class="text-xs text-slate-500">${esc(displayTime(l.time))} · ${l.duration||60} мин · ${money(l.price)}</div></div><span class="status ${statusClass[l.status]||'bg-slate-100 text-slate-700'} whitespace-nowrap">${statusLabels[l.status]||l.status}</span></div>`
      ).join('')||'<span class="text-slate-400">Занятий нет</span>';

      document.getElementById('student-public-login').classList.add('hidden');
      document.getElementById('student-public-content').classList.remove('hidden');

    }catch(e){
      console.error('public student cabinet:',e);
      document.getElementById('student-public-error').textContent=e.message||'Не удалось загрузить кабинет';
    }

    return true;
  };
})();
