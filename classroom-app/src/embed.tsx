import React from 'react';
import {createRoot} from 'react-dom/client';
import type {SupabaseClient} from '@supabase/supabase-js';
import {setProfiProfitSupabase} from './supabase';
import {setLanguage} from './i18n';
import {MaterialsLibraryPreview} from './materials/MaterialsLibraryPreview';
import {ExercisePreview} from './builder/ExercisePreview';
import type {Plan} from './planning/model';
declare global {interface Window {mountProfiProfitMaterials?: (target:HTMLElement,userId:string,client:SupabaseClient)=>()=>void}}
window.mountProfiProfitMaterials=(target,userId,client)=>{
 setProfiProfitSupabase(client);
 target.setAttribute('data-classroom-root','');
 const syncLanguage=()=>{const preferred=localStorage.getItem('profiprofit-language');setLanguage(preferred==='en'?'en':'ru');};
 syncLanguage();
 window.addEventListener('profiprofit:language',syncLanguage);
 const root=createRoot(target);
 root.render(<React.StrictMode><MaterialsLibraryPreview user={userId} onOld={()=>{}}/></React.StrictMode>);
 return ()=>{window.removeEventListener('profiprofit:language',syncLanguage);root.unmount();target.removeAttribute('data-classroom-root');};
};

// Reuse the same interactive exercise renderer for the public student cabinet.
// Student data is provided by the scoped public RPC, never by teacher repository access.
(window as Window & {mountProfiProfitStudentLesson?:(target:HTMLElement,plan:Plan,client:SupabaseClient)=>void}).mountProfiProfitStudentLesson=(target,plan,client)=>{
 setProfiProfitSupabase(client);
 target.setAttribute('data-classroom-root','');
 target.classList.add('profiprofit-student-lesson');
 if(!document.getElementById('profiprofit-student-preview-styles')){
  const style=document.createElement('style');style.id='profiprofit-student-preview-styles';
  style.textContent=`
   .profiprofit-student-lesson .mb-preview-top{margin-bottom:8px!important;padding-bottom:8px!important}
   .profiprofit-student-lesson .mb-preview-heading-row h1{margin:0!important;font-size:22px!important}
   .profiprofit-student-lesson .mb-student-card{min-height:0!important}
   .profiprofit-student-lesson .mb-student-body{min-height:0!important;padding-top:14px!important;padding-bottom:16px!important}
   .profiprofit-student-lesson .mb-combined-element{margin-bottom:14px!important}
   .profiprofit-student-lesson .mb-combined-element h2{margin:0 0 12px!important}
   .profiprofit-student-lesson .mb-student-items>div{margin-bottom:12px!important}
   .profiprofit-student-lesson .mb-preview-footer{margin-top:14px!important;padding-top:12px!important}
   .profiprofit-student-lesson .mb-student-lesson-nav{position:relative;margin:8px 0 12px}
   .profiprofit-student-lesson .mb-student-lesson-nav-toggle{border:1px solid #e4dcef;background:#f6f2fb;color:#4b287e;padding:8px 12px;border-radius:10px;font-weight:600}
   .profiprofit-student-lesson .mb-student-lesson-nav-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;padding:10px;background:#faf8fd;border:1px solid #e4dcef;border-radius:12px}
   .profiprofit-student-lesson .mb-student-lesson-nav-list button{padding:7px 10px;border-radius:8px;background:white;border:1px solid #e4dcef;text-align:left}
   .profiprofit-student-lesson .mb-student-lesson-nav-list button.is-current{background:#4b287e;color:white}
  `;document.head.append(style);
 }
 const root=createRoot(target);
 root.render(<React.StrictMode><ExercisePreview plan={plan} selected={plan.blocks?.[0]?.id||''} onBack={()=>{}} scopeKey={'student:'+crypto.randomUUID()} studentMode/></React.StrictMode>);
};
