import React from 'react';
import {createRoot} from 'react-dom/client';
import {MaterialsLibraryPreview} from './materials/MaterialsLibraryPreview';

declare global {interface Window {mountProfiProfitMaterials?: (target:HTMLElement,userId:string)=>()=>void}}
window.mountProfiProfitMaterials=(target,userId)=>{
 const root=createRoot(target);
 root.render(<React.StrictMode><MaterialsLibraryPreview user={userId} onOld={()=>{}}/></React.StrictMode>);
 return ()=>root.unmount();
};
