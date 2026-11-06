function weekStart(d){
  const x=dateAtLocalNoon(localISO(d));
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
  selectedDate=todayISOInTimezone(getTeacherTimezone());
  weekAnchor=dateAtLocalNoon(selectedDate);

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
  const today=todayISOInTimezone(getTeacherTimezone());
  const days=[];

  for(let i=0;i<7;i++){
    const d=new Date(start);
    d.setDate(d.getDate()+i);
    days.push(d);
  }

  document.getElementById('week-range').textContent=
    days[0].toLocaleDateString((window.getLanguage?.()==='en'?'en-US':'ru-RU'),{
      day:'2-digit',
      month:'long'
    })+
    ' — '+
    days[6].toLocaleDateString((window.getLanguage?.()==='en'?'en-US':'ru-RU'),{
      day:'2-digit',
      month:'long',
      year:'numeric'
    });

  const lang=window.getLanguage?.()==='en'?'en-US':'ru-RU';
  c.className='calendar-week-grid';
  c.innerHTML=days.map(d=>{
    const key=localISO(d);
    const sel=key===selectedDate;
    const isToday=key===today;
    const dayLessons=lessons
      .map(l=>({...l,...lessonDateTimeInTimezone(l,getTeacherTimezone())}))
      .filter(l=>l.date===key)
      .sort((a,b)=>String(a.time||'').localeCompare(String(b.time||'')));

    return `<section class="calendar-day-column ${sel?'is-selected ':''}${isToday?'is-today':''}">
      <button type="button" onclick="selectDay('${key}')" class="calendar-day-heading">
        <span class="calendar-weekday">${d.toLocaleDateString(lang,{weekday:'short'}).replace('.','')}</span>
        <span class="calendar-day-number">${d.getDate()}</span>
      </button>
      <div class="calendar-day-events">
        ${dayLessons.length?dayLessons.map(l=>`
          <button type="button" onclick="openEditLesson('${esc(l.id)}')" class="calendar-event-card">
            <span class="calendar-event-time">${esc(displayTime(l.time))}</span>
            <span class="calendar-event-title ${['rescheduled','cancelled_charge','cancelled_free'].includes(l.status)?'is-cancelled':''}">${esc(lessonTitle(l))}</span>
            <span class="calendar-event-meta">${l.duration||60} мин · ${money(lessonPriceTotal(l))}</span>
            ${l.comment?`<span class="calendar-event-comment">${esc(l.comment)}</span>`:''}
            <span class="status ${statusClass[l.status]||'bg-slate-100'}">${statusLabels[l.status]||l.status}</span>
          </button>`).join(''):'<p class="calendar-empty-day">Нет занятий</p>'}
      </div>
      <button type="button" onclick="openNewLessonForDate('${key}')" class="calendar-add-day">+ Добавить</button>
    </section>`;
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
    d.toLocaleDateString((window.getLanguage?.()==='en'?'en-US':'ru-RU'),{
      weekday:'long',
      day:'numeric',
      month:'long'
    });

  const ls=lessons
    .map(l=>({...l,...lessonDateTimeInTimezone(l,getTeacherTimezone())}))
    .filter(l=>l.date===selectedDate)
    .sort((a,b)=>String(a.time||'').localeCompare(String(b.time||'')));

  const addLessonLink='<button type="button" onclick="openNewLessonForDate(selectedDate)" class="mt-2 inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50">+ <span>Добавить занятие</span></button>';
  document.getElementById('day-lessons').innerHTML=
    (ls.length
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
      :'')+addLessonLink;
}
