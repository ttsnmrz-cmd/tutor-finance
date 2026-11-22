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
 const columns=(block as ColumnBlock).columns||[],words=block.items as Word[];
 function update(cols:Column[],items:Word[]){onChange({...block,columns:cols,items} as Block);}
 return <div className="mb-columns-editor">
 {block.content&&<div className="mb-columns-existing"><FormattedText text={block.content} html={formatOf(block,'content',block.content)}/></div>}
 <div className="mb-columns-grid">{columns.map((column,index)=><section className="mb-column-editor" key={column.id} aria-label={ui('Column')+' '+(index+1)}>
 <div className="mb-column-name"><input aria-label={ui('Column name')+' '+(index+1)} placeholder={ui('Column')+' '+(index+1)} value={column.title} onChange={e=>update(columns.map(c=>c.id===column.id?{...c,title:e.target.value}:c),words)}/><button disabled={columns.length<=2} aria-label={ui('Delete column')+' '+(index+1)} onClick={()=>{if(confirm(ui('Delete this column and its words?')))update(columns.filter(c=>c.id!==column.id),words.filter(w=>w.expected!==column.id));}}>×</button></div>
 {words.filter(w=>w.expected===column.id).map((word,wi)=><div className="mb-column-word-row" key={word.columnWordId}><CompactTextInput label={ui('Word')+' '+(index+1)+'.'+(wi+1)} placeholder={ui('Enter a word')} value={word.prompt} onChange={value=>update(columns,words.map(w=>w.columnWordId===word.columnWordId?{...w,prompt:value}:w))}/><button aria-label={ui('Delete word')+' '+(index+1)+'.'+(wi+1)} onClick={()=>{if(!word.prompt.trim()||confirm(ui('Delete this word?')))update(columns,words.filter(w=>w.columnWordId!==word.columnWordId));}}>×</button></div>)}
 <button className="mb-add-column-word" onClick={()=>update(columns,[...words,blankColumnWord(column.id)])}>+ {ui('Add word')}</button>
 </section>)}</div>
 <button className="mb-add-column" onClick={()=>update([...columns,{id:crypto.randomUUID(),title:''}],words)}>+ {ui('Add column')}</button>
 <p className="mb-help">{ui('Name the columns and enter each word in its correct column.')}</p>
 </div>;
}
export function ColumnsPreview({block}:{block:Block}){
 const columns=(block as ColumnBlock).columns||[],words=block.items as Word[];
 const [order]=useState(()=>{const ids=words.map(w=>w.columnWordId);for(let i=ids.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}return ids;});
 const [answers,setAnswers]=useState<Record<string,string>>({}),[selected,setSelected]=useState<string|null>(null),[checked,setChecked]=useState(false),nonce=useRef(crypto.randomUUID());
 const ready=columns.length>=2&&columns.every(c=>!!c.title.trim())&&words.length>0&&words.every(w=>!!w.prompt.trim()&&columns.some(c=>c.id===w.expected));
 function place(id:string,column?:string){if(!words.some(w=>w.columnWordId===id)||column&&!columns.some(c=>c.id===column))return;setAnswers(old=>{const next={...old};if(column)next[id]=column;else delete next[id];return next;});setChecked(false);setSelected(null);}
 function start(e:React.DragEvent,id:string){e.dataTransfer.setData('application/x-mec-column-word',JSON.stringify({nonce:nonce.current,id}));e.dataTransfer.effectAllowed='move';}
 function drop(e:React.DragEvent,column?:string){e.preventDefault();e.stopPropagation();try{const data=JSON.parse(e.dataTransfer.getData('application/x-mec-column-word'));if(data.nonce===nonce.current)place(data.id,column);}catch{}}
 function chip(word:Word){const id=word.columnWordId,placed=answers[id],result=checked?(placed===undefined?'empty':placed===word.expected?'correct':'incorrect'):undefined;
 return <button key={id} className="mb-column-token" data-word-id={id} data-result={result} aria-pressed={selected===id} draggable onDragStart={e=>start(e,id)} onClick={()=>setSelected(selected===id?null:id)}><span className="mb-column-grip" aria-hidden="true">⠿</span>{word.prompt}{checked&&placed&&<span aria-hidden="true">{result==='correct'?' ✓':' ×'}</span>}</button>;}
 return <div className="mb-columns-preview">
 {block.content&&<div className="mb-columns-existing"><FormattedText text={block.content} html={formatOf(block,'content',block.content)}/></div>}
 <p className="mb-help">{ui('Drag words into columns, or select a word and then a column. Select a placed word to move it again.')}</p>
 <div className="mb-column-bank" aria-label={ui('Word bank')} onDragOver={e=>e.preventDefault()} onDrop={e=>drop(e)}>{order.map(id=>words.find(w=>w.columnWordId===id)!).filter(w=>w&&answers[w.columnWordId]===undefined).map(chip)}{!words.some(w=>answers[w.columnWordId]===undefined)&&<span>{ui('All words placed')}</span>}{selected&&answers[selected]!==undefined&&<button onClick={()=>place(selected)}>{ui('Return to word bank')}</button>}</div>
 <div className="mb-columns-grid">{columns.map((column,index)=><section className="mb-column-target" key={column.id} onDragOver={e=>e.preventDefault()} onDrop={e=>drop(e,column.id)}>
 <button className="mb-column-target-heading" aria-label={ui('Place in column')+' '+(index+1)+': '+column.title} onClick={()=>{if(selected)place(selected,column.id);}}>{column.title||ui('Column')+' '+(index+1)}</button>
 <div className="mb-column-placed">{order.map(id=>words.find(w=>w.columnWordId===id)!).filter(w=>w&&answers[w.columnWordId]===column.id).map(chip)}</div>
 </section>)}</div>
 <div className="mb-inline-check"><button className="primary" disabled={!ready} onClick={()=>setChecked(true)}>{ui('Check answers')}</button>{checked&&<span role="status">{words.filter(w=>answers[w.columnWordId]===w.expected).length} / {words.length} {ui('correct')}</span>}</div>
 </div>;
}
