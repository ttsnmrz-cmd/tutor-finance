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
(window as Window & {mountProfiProfitStudentLesson?:(target:HTMLElement,plan:Plan)=>void}).mountProfiProfitStudentLesson=(target,plan)=>{
 target.setAttribute('data-classroom-root','');
 const root=createRoot(target);
 root.render(<React.StrictMode><ExercisePreview plan={plan} selected={plan.blocks?.[0]?.id||''} onBack={()=>{}} scopeKey={'student:'+crypto.randomUUID()} studentMode/></React.StrictMode>);
};
