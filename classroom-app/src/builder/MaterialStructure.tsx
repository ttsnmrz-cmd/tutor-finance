import {useRef,useState} from 'react';
import type {Block,Plan} from '../planning/model';
import {ui} from '../i18n';
import './materialStructureDnd.css';

type Drag={kind:'section'|'exercise';id:string};
type DragKind=Drag['kind'];
type Props={
 plan:Plan;active:string;section:string;collapsed:Set<string>;menu:string|null;
 onMenu:(id:string|null)=>void;onToggle:(id:string)=>void;onSelect:(b:Block)=>void;
 onSection:(id:string)=>void;onRename:(id:string)=>void;onAddSection:()=>void;
 onAddExercise:(stage:string)=>void;onCopy:(id:string)=>void;onMove:(id:string)=>void;
 onDelete:(id:string)=>void;onToggleStudentVisibility:(id:string)=>void;onDrop:(drag:Drag,stage:string,before?:string)=>void;
 onAssignHomework:(stage:string)=>void;
};

function Grip(){return <svg aria-hidden="true" width="14" height="20" viewBox="0 0 14 20" fill="currentColor"><circle cx="4" cy="5" r="1.4"/><circle cx="10" cy="5" r="1.4"/><circle cx="4" cy="10" r="1.4"/><circle cx="10" cy="10" r="1.4"/><circle cx="4" cy="15" r="1.4"/><circle cx="10" cy="15" r="1.4"/></svg>;}

export function MaterialStructure({plan,active,section,collapsed,menu,onMenu,onToggle,onSelect,onSection,onRename,onAddSection,onAddExercise,onCopy,onMove,onDelete,onToggleStudentVisibility,onDrop,onAssignHomework}:Props){
 const drag=useRef<Drag|null>(null);
 const [dragging,setDragging]=useState<Drag|null>(null);
 const [dropTarget,setDropTarget]=useState<string|null>(null);
 const stageIds=new Set(plan.stages.map(s=>s.id));
 const unassigned=plan.blocks.filter(b=>!stageIds.has(b.stage));
 const ordered=[...plan.stages.flatMap(s=>plan.blocks.filter(b=>b.stage===s.id)),...unassigned];
 const numbers=new Map(ordered.map((b,i)=>[b.id,i+1]));

 function start(e:React.DragEvent<HTMLElement>,item:Drag){
  drag.current=item;
  setDragging(item);
  setDropTarget(null);
  e.dataTransfer.effectAllowed='move';
  e.dataTransfer.setData('text/plain',item.id);
 }
 function finish(){drag.current=null;setDragging(null);setDropTarget(null);}
 function allow(e:React.DragEvent<HTMLElement>,target:string,kind?:DragKind){
  if(!drag.current||(kind&&drag.current.kind!==kind))return;
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect='move';
  setDropTarget(current=>current===target?current:target);
 }
 function drop(e:React.DragEvent<HTMLElement>,stage:string,before?:string,kind?:DragKind){
  e.preventDefault();
  e.stopPropagation();
  const item=drag.current;
  finish();
  if(!item||(kind&&item.kind!==kind))return;
  if(item.kind==='section'&&item.id===stage)return;
  if(item.kind==='exercise'&&item.id===before)return;
  onDrop(item,stage,before);
 }
 const pointer=useRef<{item:Drag;x:number;y:number;moving:boolean}|null>(null);
 function touchTarget(x:number,y:number,item:Drag){
  const el=document.elementFromPoint(x,y);
  const end=el?.closest<HTMLElement>('[data-touch-end]');
  if(end&&end.dataset.touchKind===item.kind)return {stage:end.dataset.touchEnd||'',key:item.kind==='section'?'sections-end':'exercise-end:'+end.dataset.touchEnd};
  const row=el?.closest<HTMLElement>(item.kind==='section'?'.mb-section-row':'.mb-structure-exercise,.mb-section-row');
  if(!row)return null;
  return {stage:row.dataset.mbStage||'',before:row.dataset.mbBlock,key:row.dataset.mbBlock?'exercise:'+row.dataset.mbBlock:'section:'+row.dataset.mbStage};
 }
 function touchHandlers(item:Drag){return {
  style:{touchAction:'none'},
  onPointerDown:(e:React.PointerEvent<HTMLButtonElement>)=>{if(e.pointerType==='mouse')return;pointer.current={item,x:e.clientX,y:e.clientY,moving:false};e.currentTarget.setPointerCapture(e.pointerId);},
  onPointerMove:(e:React.PointerEvent<HTMLButtonElement>)=>{const p=pointer.current;if(!p)return;if(!p.moving&&Math.hypot(e.clientX-p.x,e.clientY-p.y)>8){p.moving=true;drag.current=p.item;setDragging(p.item);}if(p.moving)setDropTarget(touchTarget(e.clientX,e.clientY,p.item)?.key||null);},
  onPointerUp:(e:React.PointerEvent<HTMLButtonElement>)=>{const p=pointer.current;pointer.current=null;if(!p)return;const target=p.moving?touchTarget(e.clientX,e.clientY,p.item):null;finish();if(target&&!(p.item.kind==='section'&&p.item.id===target.stage)&&p.item.id!==target.before)onDrop(p.item,target.stage,target.before);},
  onPointerCancel:()=>{pointer.current=null;finish();}
 };}
 function exercise(b:Block){
  const target='exercise:'+b.id;
  return <div className={'mb-structure-exercise'+(active===b.id?' active':'')+(b.hiddenFromStudent?' mb-hidden-exercise':'')} key={b.id} data-mb-stage={b.stage} data-mb-block={b.id} data-drop-target={dropTarget===target?'true':undefined} onDragOver={e=>allow(e,target,'exercise')} onDrop={e=>drop(e,b.stage,b.id,'exercise')}>
   <button type="button" className="mb-drag" draggable {...touchHandlers({kind:'exercise',id:b.id})} onDragStart={e=>start(e,{kind:'exercise',id:b.id})} onDragEnd={finish} title={'Drag exercise: '+b.title} aria-label={'Drag exercise: '+b.title}><Grip/></button>
   {b.hiddenFromStudent&&<span className="mb-hidden-eye" title={ui("Hidden from students")} aria-label={ui("Hidden from students")}>◉̸</span>}<button className="mb-select-exercise" aria-current={active===b.id?'step':undefined} title={b.title} onClick={()=>onSelect(b)}><span aria-hidden="true">{numbers.get(b.id)}.</span><span>{b.title||ui('Untitled exercise')}</span></button>
   <div className="mb-menu-wrap"><button className="mb-more" aria-label={ui('Exercise actions')+' '+b.title} aria-expanded={menu===b.id} onClick={()=>onMenu(menu===b.id?null:b.id)}>···</button>{menu===b.id&&<div className="mb-menu"><button onClick={()=>onToggleStudentVisibility(b.id)}>{b.hiddenFromStudent?'◉ '+ui('Show to students'):'◉̸ '+ui('Hide from students')}</button>{!b.hiddenFromStudent&&plan.stages.some(s=>s.id===b.stage&&s.homework)&&<button onClick={()=>onAssignHomework(b.stage)}>{ui('Assign homework section')}</button>}<button onClick={()=>onCopy(b.id)}>{ui('Copy to…')}</button><button onClick={()=>onMove(b.id)}>{ui('Move to…')}</button><button onClick={()=>onDelete(b.id)}>{ui('Delete')}</button></div>}</div>
  </div>;
 }
 return <aside className="mb-structure" aria-label={ui('Material structure')}>
  <div className="mb-structure-heading"><h2>{ui('Material structure')}</h2><button type="button" className="mb-add-section" title={ui('Add section')} aria-label={ui('Add section')} onClick={onAddSection}>+</button></div>
  <div className="mb-structure-list">
   {plan.stages.map(s=>{
    const target='section:'+s.id;
    return <div className="mb-stage" key={s.id}>
     <div className={'mb-section-row'+(section===s.id?' selected':'')} data-mb-stage={s.id} data-drop-target={dropTarget===target?'true':undefined} onDragOver={e=>allow(e,target)} onDrop={e=>drop(e,s.id)}>
      <button type="button" className="mb-drag" draggable {...touchHandlers({kind:'section',id:s.id})} onDragStart={e=>start(e,{kind:'section',id:s.id})} onDragEnd={finish} title={'Drag section: '+s.name} aria-label={'Drag section: '+s.name}><Grip/></button>
      <button className="mb-chevron" aria-label={ui(collapsed.has(s.id)?'Expand section':'Collapse section')+' '+s.name} aria-expanded={!collapsed.has(s.id)} onClick={()=>onToggle(s.id)}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={collapsed.has(s.id)?'m6 4 4 4-4 4':'m4 6 4 4 4-4'}/></svg></button>
      <button className="mb-select-section" title={s.name} aria-expanded={!collapsed.has(s.id)} onClick={()=>{onSection(s.id);onToggle(s.id);}}><span>{s.name||ui('Untitled section')}</span></button>
      <span className="mb-stage-count" aria-label={ui('Exercises created')}>{plan.blocks.filter(b=>b.stage===s.id).length}{typeof (s as unknown as {plannedTotal?:number}).plannedTotal==='number'?'/'+(s as unknown as {plannedTotal:number}).plannedTotal:''}</span>
      <div className="mb-menu-wrap"><button className="mb-more" aria-label={ui('Section actions')+' '+s.name} aria-expanded={menu===s.id} onClick={()=>onMenu(menu===s.id?null:s.id)}>···</button>{menu===s.id&&<div className="mb-menu"><button onClick={()=>onRename(s.id)}>{ui('Rename section')}</button>{s.homework&&<button onClick={()=>onAssignHomework(s.id)}>{ui('Assign homework')}</button>}</div>}</div>
     </div>
     {!collapsed.has(s.id)&&<>
      {plan.blocks.filter(b=>b.stage===s.id).map(exercise)}
      {dragging?.kind==='exercise'&&<div className="mb-exercise-drop-end" data-touch-kind="exercise" data-touch-end={s.id} data-drop-target={dropTarget==='exercise-end:'+s.id?'true':undefined} onDragOver={e=>allow(e,'exercise-end:'+s.id,'exercise')} onDrop={e=>drop(e,s.id,undefined,'exercise')}>{ui('Move to…')} {s.name} ↓</div>}
      <button className="mb-stage-add" onClick={()=>onAddExercise(s.id)}>+ {ui('Add exercise')}</button>
     </>}
    </div>;
   })}
   {unassigned.length>0&&<div><h3>{ui('Unassigned exercises')}</h3>{unassigned.map(exercise)}</div>}
   {dragging?.kind==='section'&&<div className="mb-section-drop-end" data-touch-kind="section" data-touch-end="" data-drop-target={dropTarget==='sections-end'?'true':undefined} onDragOver={e=>allow(e,'sections-end','section')} onDrop={e=>drop(e,'',undefined,'section')}>{ui('Move down')} ↓</div>}
   <button type="button" className="mb-add-section-footer" onClick={onAddSection}>+ {ui('Add section')}</button>
  </div>
 </aside>;
}
