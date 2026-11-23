import {useEffect,useRef,useState} from 'react';
import type {Block} from '../planning/model';
import {classroomImageUrl,uploadClassroomImage,type GalleryImage} from './galleryStorage';

export type LabelZone={id:string;answer:string;x:number;y:number;w:number;h:number;shape?:'rectangle'|'oval'};
type LabelBlock=Block&{labelImage?:GalleryImage;labelZones?:LabelZone[];labelDistractors?:string[]};
const data=(block:Block)=>block as LabelBlock;
const zoneShape=(z:LabelZone)=>z.shape||'oval';
const clamp=(v:number)=>Math.max(0,Math.min(100,v));
function Picture({scope,image}:{scope:string;image?:GalleryImage}){
 const [src,setSrc]=useState(''),[error,setError]=useState('');
 useEffect(()=>{let url='',active=true,revoke:(()=>void)|undefined;setSrc('');setError('');if(image)void classroomImageUrl(image,scope).then(result=>{if(!active){result.revoke?.();return;}url=result.src;revoke=result.revoke;setSrc(url);}).catch(e=>{if(active)setError((e as Error).message);});return()=>{active=false;revoke?.();};},[scope,image?.id]);
 return error?<p role="alert">{error}</p>:src?<img src={src} alt={image?.caption||'Labeling exercise'} draggable={false}/>:<div className="mb-image-label-empty">{image?'Loading image…':'Upload an image to start'}</div>;
}
export function ImageLabelingEditor({block,onChange,scope}:{block:Block;onChange:(b:Block)=>void;scope:string}){
 const b=data(block),zones=b.labelZones||[],input=useRef<HTMLInputElement>(null),stage=useRef<HTMLDivElement>(null),start=useRef<{x:number;y:number}|null>(null),[draft,setDraft]=useState<LabelZone|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [newShape,setNewShape]=useState<'rectangle'|'oval'>('oval');
 const patch=(p:Partial<LabelBlock>)=>onChange({...b,...p} as Block);
 function point(e:React.PointerEvent){const rect=stage.current!.getBoundingClientRect();return {x:clamp((e.clientX-rect.left)/rect.width*100),y:clamp((e.clientY-rect.top)/rect.height*100)};}
 async function upload(file?:File){if(!file)return;setBusy(true);setError('');try{const image=await uploadClassroomImage(file);patch({labelImage:image});}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 function begin(e:React.PointerEvent){if(!b.labelImage||e.button!==0||!(e.target as Element).closest('.mb-image-label-stage'))return;e.preventDefault();const p=point(e);start.current=p;stage.current?.setPointerCapture(e.pointerId);setDraft({id:'',answer:'',x:p.x,y:p.y,w:0,h:0,shape:newShape});}
 function update(e:React.PointerEvent){if(!start.current)return;const p=point(e),s=start.current;setDraft({id:'',answer:'',x:Math.min(p.x,s.x),y:Math.min(p.y,s.y),w:Math.abs(p.x-s.x),h:Math.abs(p.y-s.y),shape:newShape});}
 function finish(){if(draft&&draft.w>1&&draft.h>1){patch({labelZones:[...zones,{...draft,id:crypto.randomUUID(),answer:''}]});}start.current=null;setDraft(null);}
 return <div className="mb-image-label-editor">
  <div className="mb-image-label-toolbar"><button type="button" onClick={()=>input.current?.click()} disabled={busy}>{b.labelImage?'Replace image':'Upload image'}</button><label>New zone shape <select aria-label="New zone shape" value={newShape} onChange={e=>setNewShape(e.target.value as 'rectangle'|'oval')}><option value="oval">Oval</option><option value="rectangle">Rectangle</option></select></label><span>Draw a zone around each object. Zones are invisible to students.</span></div>
  <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" hidden onChange={e=>{void upload(e.target.files?.[0]);e.target.value='';}}/>
  {error&&<p role="alert">{error}</p>}
  <div ref={stage} className="mb-image-label-stage is-editing" onPointerDown={begin} onPointerMove={update} onPointerUp={finish} onPointerCancel={()=>{start.current=null;setDraft(null);}}><Picture scope={scope} image={b.labelImage}/>{[...zones,...(draft?[draft]:[])].map(z=><div key={z.id||'draft'} className="mb-image-label-zone" data-shape={zoneShape(z)} style={{left:z.x+'%',top:z.y+'%',width:z.w+'%',height:z.h+'%'}}>{z.id==='draft'?'':zones.findIndex(q=>q.id===z.id)+1}</div>)}</div>
  {zones.map((z,i)=><div className="mb-image-label-zone-row" key={z.id}><span>{i+1}</span><select aria-label={'Shape for zone '+(i+1)} value={zoneShape(z)} onChange={e=>patch({labelZones:zones.map(q=>q.id===z.id?{...q,shape:e.target.value as 'rectangle'|'oval'}:q)})}><option value="oval">Oval</option><option value="rectangle">Rectangle</option></select><input aria-label={'Answer for zone '+(i+1)} placeholder="Correct label" value={z.answer} onChange={e=>patch({labelZones:zones.map(q=>q.id===z.id?{...q,answer:e.target.value}:q)})}/><button type="button" onClick={()=>patch({labelZones:zones.filter(q=>q.id!==z.id)})}>Remove</button></div>)}
  <button type="button" disabled={!b.labelImage} onClick={()=>patch({labelZones:[...zones,{id:crypto.randomUUID(),answer:'',x:35,y:35,w:25,h:20,shape:newShape}]})}>+ Add zone</button>
 </div>;
}
export function ImageLabelingPreview({block,scope,teacherHints=false}:{block:Block;scope:string;teacherHints?:boolean}){
 const b=data(block),zones=b.labelZones||[],words=[...zones.map(z=>z.answer.trim()).filter(Boolean),...(b.labelDistractors||[]).map(s=>s.trim()).filter(Boolean)];
 const [order]=useState(()=>words.map((_,i)=>i).sort(()=>Math.random()-.5)),[placed,setPlaced]=useState<Record<number,{x:number;y:number;zone:string|null}>>({}),[selected,setSelected]=useState<number|null>(null),[checked,setChecked]=useState(false),stage=useRef<HTMLDivElement>(null);
 function drop(e:React.DragEvent){e.preventDefault();const raw=e.dataTransfer.getData('application/x-image-label-word');const index=Number(raw);if(!raw||!Number.isInteger(index)||index<0||index>=words.length)return;place(index,e.clientX,e.clientY);}
 function place(index:number,cx:number,cy:number){const rect=stage.current!.getBoundingClientRect(),x=clamp((cx-rect.left)/rect.width*100),y=clamp((cy-rect.top)/rect.height*100);const zone=zones.find(z=>{if(zoneShape(z)==='rectangle')return x>=z.x&&x<=z.x+z.w&&y>=z.y&&y<=z.y+z.h;const rx=z.w/2,ry=z.h/2;if(!rx||!ry)return false;return ((x-z.x-rx)/rx)**2+((y-z.y-ry)/ry)**2<=1;});setPlaced(old=>({...old,[index]:{x,y,zone:zone?.id||null}}));setChecked(false);setSelected(null);}
 function returnToBank(index:number){setPlaced(old=>{const next={...old};delete next[index];return next;});setChecked(false);setSelected(null);}
 function correct(i:number){const z=zones.find(z=>z.id===placed[i]?.zone);return !!z&&z.answer.trim().toLocaleLowerCase()===words[i].toLocaleLowerCase();}
 return <div className="mb-image-label-preview"><div ref={stage} className="mb-image-label-stage" onDragOver={e=>e.preventDefault()} onDrop={drop} onClick={e=>{if(selected!==null)place(selected,e.clientX,e.clientY);}}><Picture scope={scope} image={b.labelImage}/>{teacherHints&&zones.map(z=><div key={z.id} className="mb-image-label-teacher-zone" data-shape={zoneShape(z)} style={{left:z.x+'%',top:z.y+'%',width:z.w+'%',height:z.h+'%'}}>{zones.findIndex(q=>q.id===z.id)+1}</div>)}{Object.entries(placed).map(([key,pos])=><button type="button" key={key} draggable aria-label={'Return '+words[Number(key)]+' to word bank'} title="Click to return to word bank, or drag to another zone" onDragStart={e=>{e.dataTransfer.setData('application/x-image-label-word',key);e.dataTransfer.effectAllowed='move';}} onClick={e=>{e.stopPropagation();returnToBank(Number(key));}} className="mb-image-label-placed" data-result={checked?(correct(Number(key))?'correct':'incorrect'):undefined} style={{left:pos.x+'%',top:pos.y+'%'}}>{words[Number(key)]}</button>)}</div>
 <div className="mb-image-label-bank">{order.filter(i=>!placed[i]).map(i=><button key={i} type="button" draggable onDragStart={e=>e.dataTransfer.setData('application/x-image-label-word',String(i))} onClick={()=>setSelected(selected===i?null:i)} aria-pressed={selected===i}>{words[i]}</button>)}</div>
 <div className="mb-inline-check"><button type="button" onClick={()=>setChecked(true)}>Check</button><button type="button" onClick={()=>{setPlaced({});setChecked(false);setSelected(null);}}>Reset</button>{checked&&<span>{Object.keys(placed).filter(k=>correct(Number(k))).length} / {zones.length}</span>}</div></div>;
}
