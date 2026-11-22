import {ui} from "../i18n";
import {MaterialsLibraryPreview} from '../materials/MaterialsLibraryPreview';
import {MaterialsLibrary} from './MaterialsLibrary';
import {useEffect,useState} from 'react';
import {StudentsDirectory} from './StudentsDirectory';
import {FinanceDashboard} from './FinanceDashboard';
import './pronunciation.css';
import './workspace.css';
type Section='dashboard'|'students'|'materials'|'schedule';
export function TeacherWorkspace({user,email,onGreeting,previewOnly=false}:{user:string;email:string;onGreeting:(value:string)=>void;previewOnly?:boolean}){
 const [collapsed,setCollapsed]=useState(()=>localStorage.getItem('classroom-nav-collapsed')==='true');
 const query=new URLSearchParams(location.search),fromBuilder=query.get('builder')==='pronunciation';
 const initialSection:Section=previewOnly?'materials':query.has('live')?'materials':query.get('section')==='students'?'students':query.get('section')==='materials'?'materials':'dashboard';
 const [studentsOpened,setStudentsOpened]=useState(initialSection==='students');
 const [section,setSection]=useState<Section>(fromBuilder?'materials':initialSection);
 useEffect(()=>{const dashboard=()=>setSection('dashboard');window.addEventListener('classroom:navigate-dashboard',dashboard);return()=>window.removeEventListener('classroom:navigate-dashboard',dashboard);},[]);
 return <div className={"teacher-desk"+(collapsed?" nav-collapsed":"")}><nav className="desk-nav" aria-label={ui("Teacher workspace")}><button aria-label={collapsed?ui("Expand navigation"):ui("Collapse navigation")} aria-expanded={!collapsed} onClick={()=>setCollapsed(v=>{localStorage.setItem("classroom-nav-collapsed",String(!v));return !v;})}>{collapsed?"»":"«"}</button>{([['dashboard','Dashboard','⌂'],['students','Students','♧'],['materials','Materials','▤'],['schedule','Schedule','▦']] as const).map(([id,name])=><button key={id} title={ui(name)} aria-label={ui(name)} aria-current={section===id?'page':undefined} onClick={()=>{if(previewOnly&&id!=='materials'){location.href='./?section='+id;return;}if(id==='students')setStudentsOpened(true);const url=new URL(location.href);url.searchParams.set('section',id);if(id!=='materials')url.searchParams.delete('live');history.replaceState(null,'',url);setSection(id);}}><span aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{id==='dashboard'?<><path d="m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9"/></>:id==='students'?<><circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v2"/></>:id==='materials'?<><path d="m3 7 9-4 9 4-9 4zM3 12l9 4 9-4M3 17l9 4 9-4"/></>:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 11h18"/></>}</svg></span><b className="desk-label">{ui(name)}</b></button>)}</nav><div className="desk-content">
 <div hidden={section!=='dashboard'}>{!previewOnly&&<FinanceDashboard email={email} onGreeting={onGreeting}/>}</div>
 <section hidden={section!=='students'}>{!previewOnly&&studentsOpened&&<StudentsDirectory email={email}/>}</section>
 <section hidden={section!=='materials'}>{previewOnly?<MaterialsLibraryPreview key={user} user={user} onOld={()=>{location.href='./?section=materials';}}/>:<MaterialsLibrary user={user} fromBuilder={fromBuilder}/>} </section>
 {section==='schedule'&&<section><span className="eyebrow">{ui("PLAN YOUR WEEK")}</span><h1>{ui("Schedule")}</h1><div className="desk-placeholder"><span aria-hidden="true">▦</span><h2>{ui("Your lesson calendar")}</h2><p>{ui("Scheduling will be added here later, with the existing ProfiProfit tools.")}</p><small>{ui("No calendar or payment data connected yet.")}</small></div></section>}
 </div></div>;
}
