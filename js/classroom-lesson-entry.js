/* Calendar → Classroom entry point. No financial mutations. */
(function(){
  'use strict';
  const target='https://classroom.profiprofit.com';
  const button=()=>document.getElementById('classroom-open-lesson');
  function refresh(){
    const id=document.getElementById('edit-id')?.value?.trim();
    button()?.classList.toggle('hidden',!id);
  }
  const previousEdit=window.openEditLesson;
  if(typeof previousEdit==='function'){
    window.openEditLesson=function(...args){
      const result=previousEdit.apply(this,args);
      refresh();
      return result;
    };
  }
  const previousNew=window.openNewLesson;
  if(typeof previousNew==='function'){
    window.openNewLesson=function(...args){
      const result=previousNew.apply(this,args);
      refresh();
      return result;
    };
  }
  window.classroomOpenLesson=function(){
    const lessonId=document.getElementById('edit-id')?.value?.trim();
    if(!lessonId){refresh();return;}
    if(window.parent===window){alert('Откройте календарь внутри My English Classroom.');return;}
    window.parent.postMessage({type:'profiprofit:open-classroom-lesson',lessonId},target);
  };
  window.addEventListener('message',async event=>{
    if(event.origin!==target||event.source!==window.parent||event.data?.type!=='classroom:calendar-proof')return;
    const {requestId,lessonId}=event.data;
    if(typeof requestId!=='string'||requestId.length>100||typeof lessonId!=='string'||!/^[0-9a-f-]{36}$/i.test(lessonId))return;
    const send=(payload)=>window.parent.postMessage({type:'profiprofit:calendar-proof',requestId,lessonId,...payload},target);
    try{
      const current=await supabaseClient.auth.getUser();
      const session=await supabaseClient.auth.getSession();
      const financeUser=current.data?.user;
      if(current.error||session.error||!financeUser?.id||session.data?.session?.user?.id!==financeUser.id)throw Error('Not signed in');
      const lesson=lessons.find(item=>item.id===lessonId&&item.teacher_id===financeUser.id);
      if(!lesson)throw Error('Appointment unavailable');
      send({legacyToken:session.data.session.access_token,legacyKey:SUPABASE_KEY});
    }catch{send({error:true});}
  });
  refresh();
})();
