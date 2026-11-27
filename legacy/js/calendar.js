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
let ppCurrentHourTimer;
function ppHighlightCurrentHour(){
 const c=document.getElementById('week-calendar'),scroller=document.getElementById('native-calendar-scroll');
 if(!c||!scroller)return;
 const today=todayISOInTimezone(getTeacherTimezone());
 const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:getTeacherTimezone(),hour:'2-digit',hourCycle:'h23'}).format(new Date()));
 const active=hour>=7&&hour<23&&Array.from(c.querySelectorAll('.native-day-track')).some(t=>t.dataset.date===today);
 const top=(hour-7)*72;
 for(const track of c.querySelectorAll('.native-day-track')){
  let band=track.querySelector('.pp-current-hour-band');
  if(!active){band?.remove();continue;}
  if(!band){band=document.createElement('div');band.className='pp-current-hour-band';band.setAttribute('aria-hidden','true');band.style.cssText='position:absolute;left:0;right:0;height:72px;box-sizing:border-box;pointer-events:none;background:rgba(137,105,192,.16);border-top:1px solid rgba(137,105,192,.65);border-bottom:1px solid rgba(137,105,192,.65)';track.prepend(band);}
  band.style.top=top+'px';
 }
 for(const [i,label] of Array.from(scroller.querySelectorAll('.native-time-axis span')).entries()){
  const selected=active&&i===hour-7;
  label.style.fontWeight=selected?'800':'';
  label.style.color=selected?'var(--text-color)':'';
  label.style.background=selected?'rgba(137,105,192,.25)':'';
  label.style.borderRadius=selected?'5px':'';
 }
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
      return '<button type="button" style="top:'+top+'px;height:'+height+'px" onclick="openCalendarLessonSummary(\''+esc(l.id)+'\')" class="calendar-event-card native-timed-event '+(cancelled?'is-cancelled':'')+'"><span class="native-event-row"><strong class="calendar-event-time">'+esc(displayTime(l.time))+'</strong><strong class="calendar-event-title">'+esc(lessonTitle(l))+'</strong></span><span class="native-event-row"><span class="calendar-event-meta">'+money(['cancelled_free','rescheduled'].includes(l.status)?0:lessonPriceTotal(l))+'</span><span class="status '+(statusClass[l.status]||'bg-slate-100')+'">'+(statusLabels[l.status]||l.status)+'</span></span>'+(comment?'<span class="native-event-comment" title="'+esc(comment)+'">'+esc(comment)+'</span>':'')+'</button>';
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
  if(!scroller.dataset.adaptiveHeight){
    scroller.dataset.adaptiveHeight='1';
    const fit=()=>{
      if(!scroller.isConnected||!scroller.getClientRects().length)return;
      const viewport=window.visualViewport;
      const bottom=viewport?viewport.offsetTop+viewport.height:window.innerHeight;
      const top=scroller.getBoundingClientRect().top+window.scrollY;
      const available=bottom-top-48;
      scroller.style.setProperty('height',Math.max(5*72+48,Math.floor(available))+'px','important');
      scroller.style.setProperty('min-height','0','important');
    };
    window.addEventListener('resize',fit);
    window.visualViewport?.addEventListener('resize',fit);
    if(typeof ResizeObserver!=='undefined'){
      const observer=new ResizeObserver(fit);
      const cards=document.getElementById('dashboard-cards');
      const header=document.getElementById('teacher-header');
      if(cards)observer.observe(cards);
      if(header)observer.observe(header);
      observer.observe(scroller);
    }
    requestAnimationFrame(fit);
  }
  const oldAxis=scroller.querySelector('.native-time-axis');
  if(oldAxis)oldAxis.remove();
  scroller.insertAdjacentHTML('afterbegin',axis);
  ppHighlightCurrentHour();
  if(!ppCurrentHourTimer)ppCurrentHourTimer=setInterval(ppHighlightCurrentHour,15000);
  const weekId=days[0].toISOString().slice(0,10);
  if(scroller.dataset.week!==weekId){
    scroller.dataset.week=weekId;
    requestAnimationFrame(()=>{
      if(scroller.dataset.week!==weekId)return;
      if(!weekKeys.has(today)){scroller.scrollTop=targetScroll;return;}
      const parts=new Intl.DateTimeFormat('en-GB',{timeZone:getTeacherTimezone(),hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
      const minutes=Number(parts.find(p=>p.type==='hour')?.value)*60+Number(parts.find(p=>p.type==='minute')?.value);
      const heading=c.querySelector('.calendar-day-heading')?.getBoundingClientRect().height||0;
      const visible=Math.max(0,scroller.clientHeight-heading);
      scroller.scrollTop=Math.max(0,(minutes/60-hourStart)*pxPerHour-visible/2);
    });
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
        `<button onclick="openCalendarLessonSummary('${esc(l.id)}')" class="w-full text-left border-b last:border-0 py-3 flex items-center gap-3 hover:bg-slate-50 rounded-xl px-2">
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
  const time=String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');
  openNewLessonForDate(date,time);
}

function openCalendarLessonSummary(id){
 const l=lessons.find(x=>String(x.id)===String(id));if(!l)return;
 const tr=(en,ru)=>window.getLanguage?.()==='en'?en:ru;
 document.getElementById('calendar-lesson-summary')?.remove();
 const d=document.createElement('dialog');d.id='calendar-lesson-summary';d.className='app-card';
 const dark=document.documentElement.dataset.theme==='dark';
 d.style.cssText='width:min(420px,92vw);padding:24px;border-radius:20px;border:1px solid '+(dark?'#625571':'#ded9e7')+';background:'+(dark?'#292536':'#fff')+';color:'+(dark?'#eeeaf5':'#1f242d')+';';
 const dt=lessonDateTimeInTimezone(l,getTeacherTimezone()),duration=Number(l.duration||60);
 const start=String(dt.time||'').replace('.',':').split(':');const end=(Number(start[0])*60+Number(start[1])+duration)%1440;
 const endText=String(Math.floor(end/60)).padStart(2,'0')+':'+String(end%60).padStart(2,'0');
 const header=document.createElement('div');header.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:12px';
 const title=document.createElement('h2');title.style.cssText='font-size:22px;font-weight:700;margin:0';title.textContent=lessonTitle(l);
 const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label',tr('Close','Закрыть'));close.style.cssText='font-size:24px;padding:4px 8px';close.onclick=()=>d.close();header.append(title,close);d.append(header);
 const meta=document.createElement('div');meta.style.cssText='display:flex;justify-content:space-between;align-items:center;margin:12px 0;padding-bottom:12px;border-bottom:1px solid #827a9044';
 const status=document.createElement('span');status.className='status '+(statusClass[l.status]||'');status.textContent=statusLabels[l.status]||l.status;
 const price=document.createElement('strong');price.textContent=money(['cancelled_free','rescheduled'].includes(l.status)?0:lessonPriceTotal(l));meta.append(status,price);d.append(meta);
 const details=document.createElement('div');details.style.cssText='display:grid;gap:10px;margin-bottom:20px';
 function line(value){const p=document.createElement('div');p.textContent=value;details.append(p);}
 line('▦  '+dateAtLocalNoon(dt.date).toLocaleDateString(tr('en-US','ru-RU'),{weekday:'long',day:'numeric',month:'long',year:'numeric'}));
 line('◷  '+start.slice(0,2).join(':')+' – '+endText+' · '+duration+' '+tr('min','мин'));
 if(l.comment)line(l.comment);d.append(details);
 function action(label,primary,fn){const b=document.createElement('button');b.type='button';b.textContent=label;b.style.cssText='display:block;width:100%;padding:12px;margin-top:8px;border-radius:12px;font-weight:600;border:1px solid '+(primary?'#4e2a84':'#827a9066')+';background:'+(primary?'#4e2a84':'transparent')+';color:'+(primary?'#fff':'inherit');b.onclick=fn;d.append(b);}
 action(l.status==='conducted'?tr('▶ Open lesson','▶ Открыть занятие'):tr('▶ Go to lesson','▶ Перейти к занятию'),true,()=>{d.close();openEditLesson(id);document.getElementById('lesson-modal')?.classList.add('hidden');window.openCalendarLivePicker();});
 action(tr('Edit lesson','Редактировать занятие'),false,()=>{d.close();openEditLesson(id);});
 d.addEventListener('close',()=>d.remove(),{once:true});document.body.append(d);d.showModal();
}
