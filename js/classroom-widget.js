/* Shared-origin presentation adapter. All editing stays in the original app. */
(()=>{
 'use strict';
 const parentOrigin='https://classroom.profiprofit.com';
 const english=typeof getLanguage==='function'&&getLanguage()==='en';
 const labels=english?{pending:'Planned',conducted:'Completed',rescheduled:'Rescheduled',cancelled_charge:'Cancelled · charged',cancelled_free:'Cancelled · no charge'}:statusLabels;
 let centerRequested=true,lastWeek='',renderedDate='',parentReady=window.parent===window,postedHeight=0,lastGreeting='';
 const originalDashboard=renderDashboard,originalToday=goToday,originalSwitch=switchTab;
 function sendHeight(){if(!parentReady)return;const dash=document.getElementById('tab-dashboard'),login=document.getElementById('cw-login'),bodyTop=document.body.getBoundingClientRect().top;const measured=dash&&dash.getBoundingClientRect().height>0?dash.getBoundingClientRect().bottom-bodyTop:login?.getBoundingClientRect().bottom-bodyTop;const h=Math.max(260,Math.min(1600,Math.ceil((measured||540)+4)));const greeting=(document.getElementById('dashboard-greeting-title')?.textContent||'').trim().slice(0,180);if(Math.abs(h-postedHeight)>2||greeting!==lastGreeting){postedHeight=h;lastGreeting=greeting;window.parent.postMessage({type:'profiprofit:height',height:h,greeting},parentOrigin);}}
 function setTheme(theme){document.documentElement.dataset.theme=theme;document.documentElement.classList.toggle('dark',theme==='dark');}
 window.addEventListener('message',event=>{if(event.origin!==parentOrigin||event.source!==window.parent||event.data?.type!=='classroom:widget')return;parentReady=true;document.documentElement.classList.add('cw-authorized-parent');setTheme(event.data.theme==='dark'?'dark':'light');sendHeight();});
 // The script is loaded before DOMContentLoaded in classroom.html.
 // These no-write overrides must also be present inline in the entry point.
 autoCompletePastLessons=async function(){};
 initializePlatformMonitoring=async function(){};
 function scaffold(){
  const dash=document.getElementById('tab-dashboard'),cal=document.getElementById('tab-calendar');if(!dash||!cal)return;
  if(cal.parentElement!==dash)dash.append(cal);cal.classList.remove('hidden');
  const compactLabels=english?['Active students','Accrued · month','Earned · total','Lessons today','Payments · month','Low balances']:['Ученики','Начислено · месяц','Заработано · всего','Занятий сегодня','Платежи · месяц','Низкий баланс'];document.querySelectorAll('#dashboard-cards button>div:first-child>span:first-child').forEach((label,i)=>{label.textContent=compactLabels[i]||label.textContent;});
  document.querySelectorAll('#dashboard-cards button').forEach(b=>{b.removeAttribute('onclick');b.tabIndex=-1;});
  document.querySelector('#tab-calendar h2').textContent=english?'Calendar':'Календарь';
  const todayButton=document.querySelector('#tab-calendar button[onclick="goToday()"]');if(todayButton)todayButton.textContent=english?'Today':'Сегодня';
  document.getElementById('cw-login')?.remove();sendHeight();
 }
 renderDashboard=function(){originalDashboard();scaffold();};
 switchTab=function(tab,options){originalSwitch('dashboard',options);scaffold();};
 goToday=function(){centerRequested=true;originalToday();};
 const minute=t=>{const p=String(t||'').replace('.',':').split(':').map(Number);return p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])?p[0]*60+p[1]:null;};
 function segments(days){const result=[];for(const l of lessons){const p=lessonDateTimeInTimezone(l,getTeacherTimezone()),start=minute(p.time);if(start===null||!p.date)continue;let remaining=Math.max(1,Number(l.duration)||60),date=p.date,from=start;while(remaining>0){const length=Math.min(1440-from,remaining);if(days.includes(date))result.push({l,date,start:from,end:from+length,continuation:from!==start||date!==p.date});remaining-=length;from=0;const d=dateAtLocalNoon(date);d.setDate(d.getDate()+1);date=localISO(d);if(length<=0||remaining>10080)break;}}return result;}
 function layout(events){const lanes=[];let cluster=[],end=-1;const finish=()=>{const count=Math.max(1,...cluster.map(e=>e.lane+1));cluster.forEach(e=>e.columns=count);cluster=[];lanes.length=0;};for(const e of events.sort((a,b)=>a.start-b.start||a.end-b.end)){if(e.start>=end){finish();end=-1;}let lane=lanes.findIndex(v=>v<=e.start);if(lane<0)lane=lanes.length;lanes[lane]=e.end;e.lane=lane;cluster.push(e);end=Math.max(end,e.end);}finish();return events;}
 renderWeek=function(){
  originalDashboard();
  const root=document.getElementById('week-calendar');if(!root)return;
  const now=dateTimePartsInTimezone(new Date(),getTeacherTimezone()),start=weekStart(weekAnchor),days=Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return localISO(d);});
  const previous=root.querySelector('.cw-scroll')?.scrollTop,week=days[0],events=segments(days);
  document.getElementById('week-range').textContent=dateAtLocalNoon(days[0]).toLocaleDateString(english?'en-GB':'ru-RU',{day:'numeric',month:'short'})+' – '+dateAtLocalNoon(days[6]).toLocaleDateString(english?'en-GB':'ru-RU',{day:'numeric',month:'short',year:'numeric'});
  root.className='cw-horizontal';root.replaceChildren();const grid=document.createElement('div');grid.className='cw-grid';root.append(grid);
  const head=document.createElement('div');head.className='cw-head';head.innerHTML='<span class="cw-zone">'+esc(getTeacherTimezone().split('/').pop().replaceAll('_',' '))+'</span>'+days.map(date=>'<div class="'+(date===now.date?'is-today':'')+'"><small>'+dateAtLocalNoon(date).toLocaleDateString(english?'en-GB':'ru-RU',{weekday:'short'})+'</small><b>'+Number(date.slice(-2))+'</b></div>').join('');grid.append(head);
  const scroll=document.createElement('div');scroll.className='cw-scroll';scroll.setAttribute('aria-label','Weekly calendar · 5 visible hours');scroll.tabIndex=0;grid.append(scroll);
  const track=document.createElement('div');track.className='cw-track';scroll.append(track);
  const hours=document.createElement('div');hours.className='cw-hours';hours.innerHTML=Array.from({length:24},(_,h)=>'<span style="top:'+h*60+'px">'+String(h).padStart(2,'0')+':00</span>').join('');track.append(hours);
  for(const date of days){const col=document.createElement('div');col.className='cw-day'+(date===now.date?' is-today':'');col.setAttribute('aria-label',date);col.tabIndex=0;col.setAttribute('role','button');col.title=english?'Add lesson':'Добавить занятие';col.onkeydown=e=>{if(e.target===col&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openNewLessonForDate(date);}};col.onclick=e=>{if(e.target!==col)return;const offset=Math.max(0,Math.min(1410,Math.floor((e.clientY-col.getBoundingClientRect().top)/30)*30));openNewLessonForDate(date);setTime(String(Math.floor(offset/60)).padStart(2,'0')+':'+String(offset%60).padStart(2,'0'));};for(const item of layout(events.filter(e=>e.date===date))){const b=document.createElement('button'),l=item.l,status=labels[l.status]||l.status,cost=lessonPriceTotal(l),deducted=dashboardLessonCharge(l),chargeText=deducted>0?(english?'Charged':'Списано'):(english?'Not charged':'Не списано');b.type='button';b.className='cw-event cw-'+l.status+(deducted===0?' cw-not-charged':'')+(item.end-item.start<55?' cw-short':'')+(item.end-item.start<38?' cw-tiny':'');b.style.cssText='top:'+item.start+'px;height:'+Math.max(22,item.end-item.start-2)+'px;left:calc('+item.lane/item.columns*100+'% + 3px);width:calc('+100/item.columns+'% - 6px)';b.title=lessonTitle(l)+' · '+status+' · '+(l.duration||60)+' min · '+money(cost)+' · '+chargeText;b.setAttribute('aria-label',b.title);b.innerHTML='<strong>'+esc(String(lessonDateTimeInTimezone(l,getTeacherTimezone()).time||'').slice(0,5))+(l.series_id?' <span aria-label="Repeating lesson">↻</span>':'')+'<span class="cw-short-cost">'+esc(money(cost))+'</span></strong><span>'+esc(lessonTitle(l))+'</span><small class="cw-cost">'+esc(money(cost))+'<span class="cw-charge">'+esc(chargeText)+'</span></small>';b.onclick=()=>openEditLesson(String(l.id));col.append(b);}track.append(col);}
  if(days.includes(now.date)){const line=document.createElement('div');line.id='cw-now';line.className='cw-now';line.style.top=minute(now.time)+'px';line.innerHTML='<span>'+esc(now.time)+'</span>';track.append(line);}
  scroll.scrollTop=!centerRequested&&week===lastWeek&&previous!==undefined?previous:Math.max(0,Math.min(1140,(minute(now.time)||0)-150));lastWeek=week;renderedDate=now.date;centerRequested=false;scaffold();
 };
 const originalNewLesson=openNewLessonForDate;
 openNewLessonForDate=function(date){originalNewLesson(date);const select=document.getElementById('edit-student');const option=new Option(english?'Choose a student':'Выберите ученика','',true,true);option.disabled=true;select.prepend(option);select.value='';updateLessonGroupButton();};
 function confirmDismiss(){
  const modal=document.getElementById('lesson-modal');if(modal.classList.contains('hidden')||document.getElementById('cw-dismiss'))return;
  const editing=!!document.getElementById('edit-id').value,box=document.createElement('div');box.id='cw-dismiss';box.setAttribute('role','alertdialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-labelledby','cw-dismiss-title');
  box.innerHTML='<div class="app-card"><h3 id="cw-dismiss-title">'+(english?(editing?'Cancel lesson editing?':'Cancel lesson creation?'):(editing?'Отменить редактирование занятия?':'Отменить создание занятия?'))+'</h3><div><button type="button" id="cw-keep">'+(english?'Continue editing':'Продолжить редактирование')+'</button><button type="button" id="cw-discard">'+(english?'Discard':'Отменить')+'</button></div></div>';modal.append(box);
  const previous=document.activeElement,keep=box.querySelector('#cw-keep');const resume=()=>{box.remove();previous?.focus();};keep.onclick=resume;box.querySelector('#cw-discard').onclick=()=>{box.remove();closeModal('lesson-modal');};box.onkeydown=e=>{if(e.key==='Escape'){e.stopPropagation();resume();}if(e.key==='Tab'){e.preventDefault();(document.activeElement===keep?box.querySelector('#cw-discard'):keep).focus();}};keep.focus();
 }
 closeLessonModal=confirmDismiss;
 document.addEventListener('click',e=>{if(e.target===document.getElementById('lesson-modal')){e.stopImmediatePropagation();confirmDismiss();}},true);
 document.addEventListener('DOMContentLoaded',()=>{
  document.documentElement.classList.add('cw-widget');if(parentReady)document.documentElement.classList.add('cw-authorized-parent');
  const info=document.createElement('div');info.id='cw-login';info.innerHTML='<p>Connect your existing ProfiProfit calendar.</p><a href="https://profiprofit.com/dashboard" target="_blank" rel="noopener">Sign in to ProfiProfit</a><p>Then refresh this calendar.</p>';document.body.append(info);
  new ResizeObserver(sendHeight).observe(document.body);
  setInterval(()=>{const p=dateTimePartsInTimezone(new Date(),getTeacherTimezone());if(renderedDate&&p.date!==renderedDate){renderWeek();return;}const line=document.getElementById('cw-now');if(!line)return;if(lastWeek&&p.date>=lastWeek){line.style.top=minute(p.time)+'px';line.firstElementChild.textContent=p.time;}},30000);
 });
})();
