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
  refresh();
})();
