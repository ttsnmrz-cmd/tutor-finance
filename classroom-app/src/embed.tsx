import React from 'react';
import {createRoot} from 'react-dom/client';
import type {SupabaseClient} from '@supabase/supabase-js';
import {setProfiProfitSupabase} from './supabase';
import {MaterialsLibraryPreview} from './materials/MaterialsLibraryPreview';
declare global {interface Window {mountProfiProfitMaterials?: (target:HTMLElement,userId:string,client:SupabaseClient)=>()=>void}}
window.mountProfiProfitMaterials=(target,userId,client)=>{
 setProfiProfitSupabase(client);
 const root=createRoot(target);
 root.render(<React.StrictMode><MaterialsLibraryPreview user={userId} onOld={()=>{}}/></React.StrictMode>);
 return ()=>root.unmount();
};
