import React from 'react';
import {createRoot} from 'react-dom/client';
import type {SupabaseClient} from '@supabase/supabase-js';
import {setProfiProfitSupabase} from './supabase';
import {setLanguage} from './i18n';
import {MaterialsLibraryPreview} from './materials/MaterialsLibraryPreview';
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
