import {isFreeColumns} from './choiceData';
import {useLiveAnswer} from './liveAnswers';
import {useRef,useState} from 'react';
import type {Block,Item} from '../planning/model';
import {ui} from '../i18n';
import {CompactTextInput} from './MatchingExercise';
import {FormattedText,formatOf} from './textFormatting';

type Column={id:string;title:string};
type Word=Item&{columnWordId:string};
type ColumnBlock=Block&{columns?:Column[]};
export const blankColumns=():Column[]=>[{id:crypto.randomUUID(),title:''},{id:crypto.randomUUID(),title:''}];
export const blankColumnWord=(column:string):Word=>({columnWordId:crypto.randomUUID(),prompt:'',expected:column});
export function ColumnsEditor({block,onChange}:{block:Block;onChange:(b:Block)=>void}){
 const columns=(block as ColumnBlock).columns||[],words=block.items as Word[],free=isFreeColumns(block);
 const dragging=useRef<string|null>(null),[over,setOver]=useState<string|null>(null);
 function move(id:string,target:string){const from=columns.findIndex(c=>c.id===id),to=columns.findIndex(c=>c.id===target);if(from<0||to<0||from===to)return;const next=[...columns];next.splice(to,0,next.splice(from,1)[0]);update(next,words);}
 function update(cols:Column[],items:Word[]){onChange({...block,columns:cols,items} as Block);}
 return <div className="mb-columns-editor">
 {block.content&&<div className="mb-columns-existing"><FormattedText text={block.content} html={formatOf(block,'content',block.content)}/></div>}
 <div className="mb-columns-grid">{columns.map((column,index)=><section className="mb-column-editor" key={column.id} aria-label={ui('Column')+' '+(index+1)} style={over===column.id?{outline:"2px solid #8663a5",outlineOffset:2}:undefined} onDragOver={e=>{if(!dragging.current)return;e.preventDefault();e.dataTransfer.dropEffect="move";setOver(column.id);}} onDrop={e=>{if(!dragging.current)return;e.preventDefault();move(dragging.current,column.id);dragging.current=null;setOver(null);}}>
 <div className="mb-column-name" style={{display:"grid",gridTemplateColumns:"22px minmax(0,1fr) 24px",alignItems:"center",gap:4}}><button type="button" draggable aria-label="Move column (drag or use arrow keys)" title="Drag to reorder · ← / →" style={{cursor:"grab",padding:0,width:22,minWidth:0,maxWidth:22,gridColumn:1,gridRow:1}} onDragStart={e=>{dragging.current=column.id;e.dataTransfer.setData("text/plain",column.id);e.dataTransfer.effectAllowed="move";}} onDragEnd={()=>{dragging.current=null;setOver(null);}} onKeyDown={e=>{const delta=e.key==="ArrowLeft"?-1:e.key==="ArrowRight"?1:0;if(delta){e.preventDefault();const target=columns[index+delta];if(target)move(column.id,target.id);}}}>⠿</button><input style={{width:"100%",minWidth:0,gridColumn:2,gridRow:1}} aria-label={ui('Column name')+' '+(index+1)} placeholder={ui('Column')+' '+(index+1)} value={column.title} onChange={e=>update(columns.map(c=>c.id===column.id?{...c,title:e.target.value}:c),words)}/><button style={{width:24,minWidth:0,padding:0,gridColumn:3,gridRow:1}} disabled={columns.length<=2} aria-label={ui('Delete column')+' '+(index+1)} onClick={()=>{if(confirm(ui('Delete this column and its words?')))update(columns.filter(c=>c.id!==column.id),free?words:words.filter(w=>w.expected!==column.id));}}>×</button></div>
 {!free&&words.filter(w=>w.expected===column.id).map((word,wi)=><div className="mb-column-word-row" key={word.columnWordId}><CompactTextInput label={ui('Word')+' '+(index+1)+'.'+(wi+1)} placeholder={ui('Enter a word')} value={word.prompt} onChange={value=>update(columns,words.map(w=>w.columnWordId===word.columnWordId?{...w,prompt:value}:w))}/><button aria-label={ui('Delete word')+' '+(index+1)+'.'+(wi+1)} onClick={()=>{if(!word.prompt.trim()||confirm(ui('Delete this word?')))update(columns,words.filter(w=>w.columnWordId!==word.columnWordId));}}>×</button></div>)}
 {!free&&<button className="mb-add-column-word" onClick={()=>update(columns,[...words,blankColumnWord(column.id)])}>+ {ui('Add word')}</button>}
 </section>)}</div>
 <button className="mb-add-column" onClick={()=>update([...columns,{id:crypto.randomUUID(),title:''}],words)}>+ {ui('Add column')}</button>
 {free?<label className="mb-field">{ui('Items (one per line)')}<textarea rows={8} value={words.map(w=>w.prompt).join('\n')} onChange={e=>{const lines=e.target.value.split('\n');update(columns,lines.map((prompt,i)=>({...blankColumnWord(''),columnWordId:words[i]?.columnWordId||crypto.randomUUID(),prompt})));}}/></label>:<p className="mb-help">{ui('Name the columns and enter each word in its correct column.')}</p>}
 </div>;
}
export function ColumnsPreview({block,teacherHints=false}:{block:Block;teacherHints?:boolean}){
 const columns=(block as ColumnBlock).columns||[],words=(block.items as Word[]).filter(w=>w.prompt.trim()),free=isFreeColumns(block);
 const [order]=useState(()=>{const ids=words.map(w=>w.columnWordId);for(let i=ids.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}return ids;});
 const [answers,setAnswers]=useLiveAnswer<Record<string,string>>(block.id+':answers',{}),[selected,setSelected]=useLiveAnswer<string|null>(block.id+':selected',null),[checked,setChecked]=useLiveAnswer(block.id+':checked',false),nonce=useRef(crypto.randomUUID());
 const ready=columns.length>=2&&columns.every(c=>!!c.title.trim())&&words.length>0&&words.every(w=>!!w.prompt.trim()&&columns.some(c=>c.id===w.expected));
 function place(id:string,column?:string){if(!words.some(w=>w.columnWordId===id)||column&&!columns.some(c=>c.id===column))return;setAnswers(old=>{const next={...old};if(column)next[id]=column;else delete next[id];return next;});setChecked(false);setSelected(null);}
 function start(e:React.DragEvent,id:string){e.dataTransfer.setData('application/x-mec-column-word',JSON.stringify({nonce:nonce.current,id}));e.dataTransfer.effectAllowed='move';}
 function drop(e:React.DragEvent,column?:string){e.preventDefault();e.stopPropagation();try{const data=JSON.parse(e.dataTransfer.getData('application/x-mec-column-word'));if(data.nonce===nonce.current)place(data.id,column);}catch{}}
 const touch=useRef<{id:string;x:number;y:number;moving:boolean}|null>(null);
 function touchMove(e:React.PointerEvent<HTMLButtonElement>){const t=touch.current;if(!t)return;if(Math.hypot(e.clientX-t.x,e.clientY-t.y)>8)t.moving=true;if(t.moving){const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-column-drop]');setOverTarget(target?.getAttribute('data-column-drop')??null);}}
 const [overTarget,setOverTarget]=useState<string|null>(null);
 function touchEnd(e:React.PointerEvent<HTMLButtonElement>){const t=touch.current;touch.current=null;setOverTarget(null);if(!t?.moving)return;const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-column-drop]');if(target){const col=target.getAttribute('data-column-drop');place(t.id,col==='bank'?undefined:col||undefined);} }
 function chip(word:Word){const id=word.columnWordId,placed=answers[id],result=!free&&checked?(placed===undefined?'empty':placed===word.expected?'correct':'incorrect'):undefined;
 return <button key={id} className="mb-column-token" data-word-id={id} data-result={result} aria-pressed={selected===id} draggable style={{touchAction:"none"}} onPointerDown={e=>{if(e.pointerType==="mouse")return;touch.current={id,x:e.clientX,y:e.clientY,moving:false};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={touchMove} onPointerUp={touchEnd} onPointerCancel={()=>{touch.current=null;setOverTarget(null);}} onDragStart={e=>start(e,id)} onClick={()=>setSelected(selected===id?null:id)}><span className="mb-column-grip" aria-hidden="true">⠿</span>{word.prompt}{!free&&teacherHints&&<small className="mb-column-teacher-label">→ {columns.find(column=>column.id===word.expected)?.title||'?'}</small>}{!free&&checked&&placed&&<span aria-hidden="true">{result==='correct'?' ✓':' ×'}</span>}</button>;}
 return <div className="mb-columns-preview" style={{gap:12,marginTop:0,paddingTop:0}}>
 {(block.content.trim()||/data-mec-image/.test(formatOf(block,'content',block.content)||''))&&<div className="mb-columns-existing" style={{margin:0,padding:0,minHeight:0}}><FormattedText text={block.content} html={formatOf(block,'content',block.content)}/></div>}
 <p className="mb-help" style={{margin:"0 0 4px",padding:0}}>{ui('Drag words into columns, or select a word and then a column. Select a placed word to move it again.')}</p>
 <div className="mb-column-bank" data-column-drop="bank" style={overTarget==="bank"?{outline:"2px solid #D99B26"}:undefined} aria-label={ui('Word bank')} onDragOver={e=>e.preventDefault()} onDrop={e=>drop(e)}>{order.map(id=>words.find(w=>w.columnWordId===id)!).filter(w=>w&&answers[w.columnWordId]===undefined).map(chip)}{!words.some(w=>answers[w.columnWordId]===undefined)&&<span>{ui('All words placed')}</span>}{selected&&answers[selected]!==undefined&&<button onClick={()=>place(selected)}>{ui('Return to word bank')}</button>}</div>
 <div className="mb-columns-grid">{columns.map((column,index)=><section className="mb-column-target" data-column-drop={column.id} style={overTarget===column.id?{outline:"2px solid #D99B26"}:undefined} key={column.id} onDragOver={e=>e.preventDefault()} onDrop={e=>drop(e,column.id)}>
 <button className="mb-column-target-heading" aria-label={ui('Place in column')+' '+(index+1)+': '+column.title} onClick={()=>{if(selected)place(selected,column.id);}}>{column.title||ui('Column')+' '+(index+1)}</button>
 <div className="mb-column-placed">{order.map(id=>words.find(w=>w.columnWordId===id)!).filter(w=>w&&answers[w.columnWordId]===column.id).map(chip)}</div>
 </section>)}</div>
 <div className="mb-inline-check">{free?<button onClick={()=>{setAnswers({});setSelected(null);setChecked(false);}}>{ui('Reset')}</button>:<><button className="primary" disabled={!ready} onClick={()=>setChecked(true)}>{ui('Check answers')}</button>{checked&&<span role="status">{words.filter(w=>answers[w.columnWordId]===w.expected).length} / {words.length} {ui('correct')}</span>}</>}</div>
 </div>;
}
