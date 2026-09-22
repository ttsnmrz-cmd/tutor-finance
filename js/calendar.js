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
