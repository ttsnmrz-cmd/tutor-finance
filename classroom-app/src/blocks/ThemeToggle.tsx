import {ui} from "../i18n";
import {useEffect,useState} from 'react';
export function ThemeToggle({theme,onChange}:{theme:string;onChange:(value:string)=>void}){
 const [systemDark,setSystemDark]=useState(()=>matchMedia('(prefers-color-scheme: dark)').matches);
 useEffect(()=>{const media=matchMedia('(prefers-color-scheme: dark)'),changed=()=>setSystemDark(media.matches);media.addEventListener('change',changed);return()=>media.removeEventListener('change',changed);},[]);
 const dark=theme==='dark'||theme==='system'&&systemDark;
 return <button className="theme-icon" aria-label={dark?ui("Switch to light theme"):ui("Switch to dark theme")} title={dark?ui("Light theme"):ui("Dark theme")} onClick={()=>onChange(dark?'light':'dark')}><svg aria-hidden="true" viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">{dark?<><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/></>:<path d="M20 14.4A8.5 8.5 0 0 1 9.6 4 8.5 8.5 0 1 0 20 14.4Z"/>}</svg></button>;
}
