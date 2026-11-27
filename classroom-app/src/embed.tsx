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
(window as Window & {mountProfiProfitStudentLesson?:(target:HTMLElement,plan:Plan,client:SupabaseClient,liveSessionId?:string,lessonId?:number)=>()=>void}).mountProfiProfitStudentLesson=(target,plan,client,liveSessionId,lessonId)=>{
 setProfiProfitSupabase(client);
 target.setAttribute('data-classroom-root','');
 target.classList.add('profiprofit-student-lesson');
 const root=createRoot(target);
 root.render(<React.StrictMode><ExercisePreview plan={plan} selected={plan.blocks?.[0]?.id||''} onBack={()=>{}} scopeKey={'student:'+(liveSessionId||crypto.randomUUID())} studentMode assetScope={'public-image:'+JSON.stringify({studentId:new URLSearchParams(location.search).get('student'),lessonId})} liveSessionId={liveSessionId}/></React.StrictMode>);
 return ()=>root.unmount();
};

type HomeworkOptions={id:string;answers:Record<string,unknown>;readOnly:boolean;onChange:(answers:Record<string,unknown>)=>void};
(window as Window & {mountProfiProfitHomework?:(target:HTMLElement,plan:Plan,client:SupabaseClient,options:HomeworkOptions)=>()=>void}).mountProfiProfitHomework=(target,plan,client,options)=>{
 setProfiProfitSupabase(client);
 target.setAttribute('data-classroom-root','');
 target.classList.add('profiprofit-student-lesson');
 setLanguage(localStorage.getItem('profiprofit-language')==='en'?'en':'ru');
 const root=createRoot(target);
 root.render(<ExercisePreview plan={plan} selected={plan.blocks?.[0]?.id||''} onBack={()=>{}} scopeKey={'homework:'+options.id} studentMode assetScope={options.id.startsWith('review:')?'':'public-image:'+JSON.stringify({studentId:new URLSearchParams(location.search).get('student'),assignmentId:options.id})} homework={options}/>);
 return ()=>root.unmount();
};

import {StudentNotebook} from './builder/StudentNotebook';
(window as Window & {mountProfiProfitNotebook?:(target:HTMLElement,studentId:string,today:string,client:SupabaseClient,onClose:()=>void)=>()=>void}).mountProfiProfitNotebook=(target,studentId,today,client,onClose)=>{
 setProfiProfitSupabase(client);
 setLanguage(localStorage.getItem('profiprofit-language')==='en'?'en':'ru');
 target.setAttribute('data-classroom-root','');
 const root=createRoot(target);
 root.render(<StudentNotebook studentId={studentId} today={today} onClose={onClose}/>);
 return ()=>root.unmount();
};
