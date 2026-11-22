/* Opt-in workspace shell. Does not bridge sessions or exchange credentials. */
(function(){
  'use strict';
  const preview=document.documentElement.classList.contains('next-ui-preview');
  if(!preview)return;
  const panel=()=>document.getElementById('next-classroom-panel');
  const frame=()=>document.getElementById('next-classroom-iframe');
  const app=()=>document.querySelector('#teacher-app>.max-w-5xl');
  function showClassroom(){
    const host=panel(),iframe=frame(),workspace=app();
    if(!host||!iframe||!workspace)return;
    if(!iframe.src||iframe.src==='about:blank')iframe.src=iframe.dataset.src;
    host.hidden=false;
    workspace.hidden=true;
    document.documentElement.classList.add('next-classroom-active');
    document.querySelector('.next-side-classroom')?.setAttribute('aria-current','page');
    window.scrollTo({top:0,behavior:'instant'});
  }
  function showFinance(){
    const host=panel(),workspace=app();
    if(host)host.hidden=true;
    if(workspace)workspace.hidden=false;
    document.documentElement.classList.remove('next-classroom-active');
    document.querySelector('.next-side-classroom')?.removeAttribute('aria-current');
  }
  window.nextOpenClassroom=showClassroom;
  window.nextCloseClassroom=showFinance;
  document.addEventListener('click',e=>{
    if(e.target.closest('#next-workspace-sidebar .next-sidebar-nav button:not(.next-side-classroom)'))showFinance();
  });
  const oldSwitch=window.switchTab;
  if(typeof oldSwitch==='function')window.switchTab=function(...args){
    showFinance();
    return oldSwitch.apply(this,args);
  };
})();
