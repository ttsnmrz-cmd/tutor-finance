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
  if(!c)return;
  const start=weekStart(weekAnchor);
  const today=todayISOInTimezone(getTeacherTimezone());
  const lang=window.getLanguage?.()==='en'?'en-US':'ru-RU';
  const days=Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return d;});
  const range=document.getElementById('week-range');
  if(range)range.textContent=days[0].toLocaleDateString(lang,{day:'numeric',month:'short'})+' – '+days[6].toLocaleDateString(lang,{day:'numeric',month:'short',year:'numeric'});
  const hourStart=7,hourEnd=23,pxPerHour=72;
  const dateLessons=lessons.map(l=>({...l,...lessonDateTimeInTimezone(l,getTeacherTimezone())}));
  const weekKeys=new Set(days.map(d=>localISO(d)));
  const weekStartMinutes=dateLessons.filter(l=>weekKeys.has(l.date)).map(l=>{
    const m=String(l.time||'').replace('.',':').match(/^([0-9]{1,2}):([0-9]{2})/);
    return m?Number(m[1])*60+Number(m[2]):null;
  }).filter(v=>v!==null);
  const firstHour=weekStartMinutes.length?Math.min(...weekStartMinutes)/60:13;
  const targetScroll=Math.max(0,(Math.floor(firstHour)-1-hourStart)*pxPerHour);
  const axis='<div class="native-time-axis">'+Array.from({length:hourEnd-hourStart},(_,i)=>'<span style="top:'+(i*pxPerHour)+'px">'+String(hourStart+i).padStart(2,'0')+':00</span>').join('')+'</div>';
  const columns=days.map(d=>{
    const key=localISO(d);
    const isToday=key===today;
    const items=dateLessons.filter(l=>l.date===key).sort((a,b)=>String(a.time||'').localeCompare(String(b.time||'')));
    const cards=items.map(l=>{
      const match=String(l.time||'').replace('.',':').match(/^([0-9]{1,2}):([0-9]{2})/);
      if(!match)return '';
      const minutes=Number(match[1])*60+Number(match[2]);
      const top=Math.max(0,(minutes-hourStart*60)*pxPerHour/60);
      const height=Math.max(48,Math.min(180,Number(l.duration||60)*pxPerHour/60-4));
      const comment=String(l.comment||'').trim();
      const cancelled=['rescheduled','cancelled_charge','cancelled_free'].includes(l.status);
      return '<button type="button" style="top:'+top+'px;height:'+height+'px" onclick="openEditLesson(\''+esc(l.id)+'\')" class="calendar-event-card native-timed-event '+(cancelled?'is-cancelled':'')+'"><span class="native-event-row"><strong class="calendar-event-time">'+esc(displayTime(l.time))+'</strong><strong class="calendar-event-title">'+esc(lessonTitle(l))+'</strong></span><span class="native-event-row"><span class="calendar-event-meta">'+money(lessonPriceTotal(l))+'</span><span class="status '+(statusClass[l.status]||'bg-slate-100')+'">'+(statusLabels[l.status]||l.status)+'</span></span>'+(comment?'<span class="native-event-comment" title="'+esc(comment)+'">'+esc(comment)+'</span>':'')+'</button>';
    }).join('');
    return '<div class="native-day"><button type="button" class="calendar-day-heading '+(isToday?'is-today':'')+'" onclick="selectDay(\''+key+'\')"><span class="calendar-weekday">'+d.toLocaleDateString(lang,{weekday:'short'}).replace('.','')+'</span><span class="calendar-day-number">'+d.getDate()+'</span></button><div class="native-day-track" data-date="'+key+'" onclick="createLessonFromCalendarSlot(event,this)" style="height:'+((hourEnd-hourStart)*pxPerHour)+'px">'+cards+'</div></div>';
  }).join('');
  c.className='native-week-calendar';
  c.innerHTML='<div class="native-week-head-spacer"></div>'+columns;
  let scroller=document.getElementById('native-calendar-scroll');
  if(!scroller){
    scroller=document.createElement('div');
    scroller.id='native-calendar-scroll';
    scroller.className='native-calendar-scroll';
    c.parentNode.insertBefore(scroller,c);
    scroller.appendChild(c);
  }
  const oldAxis=scroller.querySelector('.native-time-axis');
  if(oldAxis)oldAxis.remove();
  scroller.insertAdjacentHTML('afterbegin',axis);
  const weekId=days[0].toISOString().slice(0,10);
  if(scroller.dataset.week!==weekId){
    scroller.scrollTop=targetScroll;
    scroller.dataset.week=weekId;
  }
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

function createLessonFromCalendarSlot(event,track){
  if(event.target.closest('.calendar-event-card'))return;
  const date=track.dataset.date;
  if(!date)return;
  const rect=track.getBoundingClientRect();
  const minutes=Math.max(7*60,Math.min(22*60+30,Math.round(((event.clientY-rect.top)/72*60+7*60)/30)*30));
  selectedDate=date;
  openNewLessonForDate(date);
  const time=String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');
  requestAnimationFrame(()=>{const input=document.querySelector('#lesson-time, [name="time"], #time');if(input&&input instanceof HTMLInputElement){input.value=time;input.dispatchEvent(new Event('change',{bubbles:true}));}});
}
