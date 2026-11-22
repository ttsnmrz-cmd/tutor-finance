import {useRef,useState,useLayoutEffect} from 'react';
import type {Block} from '../planning/model';
import {ui} from '../i18n';
import {FormattedText,formatOf} from './textFormatting';
import {CompactTextInput} from './MatchingExercise';
import {blankSentence,rebuildSentence,updateSentence,shuffledTiles,tileText,type SentenceItem,type SentenceTile} from './sentenceData';

type Drag={kind:'sentence'|'tile';sentence:string;tile?:string;nonce:string};
export function SentenceEditor({block,onChange}:{block:Block;onChange:(b:Block)=>void}){
 const items=block.items as SentenceItem[],nonce=useRef(crypto.randomUUID()),root=useRef<HTMLDivElement>(null),focus=useRef<string|null>(null);
 useLayoutEffect(()=>{if(focus.current){const input=focus.current.startsWith('sentence:')?root.current?.querySelector<HTMLTextAreaElement>('[data-sentence-input="'+focus.current.slice(9)+'"] textarea'):root.current?.querySelector<HTMLInputElement>('[data-tile-input="'+focus.current+'"]');input?.focus();focus.current=null;}},[block]);
 function save(next:SentenceItem[]){onChange({...block,items:next});}
 function patch(item:SentenceItem,tiles:SentenceTile[]){save(items.map(i=>i.sentenceId===item.sentenceId?updateSentence(item,tiles):i));}
 function insertText(item:SentenceItem,text:string){const lines=text.split(/\r?\n/),next=[...items],index=next.findIndex(i=>i.sentenceId===item.sentenceId);const replacements=[{...updateSentence(item,rebuildSentence(lines[0],item.sentenceTiles)),prompt:lines[0]},...lines.slice(1).map(blankSentence)];next.splice(index,1,...replacements);if(replacements.length>1)focus.current='sentence:'+replacements[replacements.length-1].sentenceId;save(next);}
 function start(e:React.DragEvent,data:Omit<Drag,'nonce'>){e.dataTransfer.setData('application/x-mec-sentence-editor',JSON.stringify({...data,nonce:nonce.current}));e.dataTransfer.effectAllowed='move';}
 function drop(e:React.DragEvent,item:SentenceItem,before?:string){e.preventDefault();e.stopPropagation();try{const d=JSON.parse(e.dataTransfer.getData('application/x-mec-sentence-editor')) as Drag;if(d.nonce!==nonce.current)return;if(d.kind==='sentence'){const from=items.findIndex(i=>i.sentenceId===d.sentence),to=items.findIndex(i=>i.sentenceId===item.sentenceId);if(from<0||to<0||from===to)return;const next=[...items];next.splice(to,0,next.splice(from,1)[0]);save(next);}else if(d.sentence===item.sentenceId&&d.tile!==before){const tiles=[...item.sentenceTiles],index=tiles.findIndex(t=>t.id===d.tile);if(index<0)return;const [tile]=tiles.splice(index,1),destination=before?tiles.findIndex(t=>t.id===before):tiles.length;if(destination<0)return;tiles.splice(destination,0,tile);patch(item,tiles);}}catch{}}
 function step(index:number,delta:number){const next=[...items],to=index+delta;if(to<0||to>=next.length)return;[next[index],next[to]]=[next[to],next[index]];save(next);}
 return <div ref={root} className="mb-sentence-editor">
 {block.content&&<div className="mb-columns-existing"><FormattedText text={block.content} html={formatOf(block,'content',block.content)}/></div>}
 {items.map((item,index)=><section className="mb-sentence-card" data-sentence-id={item.sentenceId} key={item.sentenceId} onDragOver={e=>e.preventDefault()} onDrop={e=>drop(e,item)}>
 <div className="mb-sentence-card-heading"><button draggable onDragStart={e=>start(e,{kind:'sentence',sentence:item.sentenceId})} aria-label={ui('Drag sentence')+' '+(index+1)} title={ui('Drag sentence')}>⠿</button><strong>{index+1} / {items.length}</strong><div><button disabled={index===0} aria-label={ui('Move sentence up')+' '+(index+1)} onClick={()=>step(index,-1)}>↑</button><button disabled={index===items.length-1} aria-label={ui('Move sentence down')+' '+(index+1)} onClick={()=>step(index,1)}>↓</button><button aria-label={ui('Delete sentence')+' '+(index+1)} onClick={()=>{if(!item.prompt.trim()||confirm(ui('Delete this sentence?')))save(items.filter(i=>i.sentenceId!==item.sentenceId));}}>×</button></div></div>
 <div className="mb-sentence-input" data-sentence-input={item.sentenceId} onKeyDown={e=>{if(e.key==='Enter'&&e.target instanceof HTMLTextAreaElement){e.preventDefault();const el=e.target;insertText(item,el.value.slice(0,el.selectionStart)+'\n'+el.value.slice(el.selectionEnd));}}} onPaste={e=>{const text=e.clipboardData.getData('text/plain');if(text.includes('\n')&&e.target instanceof HTMLTextAreaElement){e.preventDefault();const el=e.target;insertText(item,el.value.slice(0,el.selectionStart)+text+el.value.slice(el.selectionEnd));}}}>
 <CompactTextInput label={ui('Sentence text')+' '+(index+1)} placeholder={ui('Enter a sentence')} value={item.prompt} onChange={text=>insertText(item,text)}/></div>
 <div className="mb-sentence-author-tiles">{item.sentenceTiles.map((tile,ti)=><div className="mb-sentence-author-tile" key={tile.id} data-tile-id={tile.id} onDragOver={e=>e.preventDefault()} onDrop={e=>drop(e,item,tile.id)}>
 <button className="mb-tile-handle" draggable onDragStart={e=>start(e,{kind:'tile',sentence:item.sentenceId,tile:tile.id})} aria-label={ui('Drag tile')+' '+(index+1)+'.'+(ti+1)}>⠿</button>
 <input data-tile-input={tile.id} aria-label={ui('Tile text')+' '+(index+1)+'.'+(ti+1)} value={tileText(tile)} style={{width:Math.min(28,Math.max(3,tileText(tile).length+1))+'ch'}} onChange={e=>patch(item,item.sentenceTiles.map(t=>t.id===tile.id?{...t,parts:tile.parts.length>1?e.target.value.split(/\s+/):[e.target.value]}:t))} onKeyDown={e=>{if(e.key===' '&&tile.parts.length===1){e.preventDefault();const el=e.currentTarget,tiles=[...item.sentenceTiles],right=el.value.slice(el.selectionEnd??0),left=el.value.slice(0,el.selectionStart??0),next={id:crypto.randomUUID(),parts:[right]};tiles.splice(ti,1,{...tile,parts:[left]},next);focus.current=next.id;patch(item,tiles);}}}/>
 <button aria-label={ui('Delete tile')+' '+(index+1)+'.'+(ti+1)} onClick={()=>{if(!tileText(tile).trim()||confirm(ui('Delete this tile?')))patch(item,item.sentenceTiles.filter(t=>t.id!==tile.id));}}>×</button>
 {ti<item.sentenceTiles.length-1&&<button className="mb-tile-join" title={ui('Join with next tile')} aria-label={ui('Join with next tile')+' '+(index+1)+'.'+(ti+1)} onClick={()=>{const tiles=[...item.sentenceTiles];tiles.splice(ti,2,{...tile,parts:[...tile.parts,...tiles[ti+1].parts]});patch(item,tiles);}}>⊕</button>}
 {tile.parts.length>1&&<button className="mb-tile-split" title={ui('Split tile')} aria-label={ui('Split tile')+' '+(index+1)+'.'+(ti+1)} onClick={()=>{const tiles=[...item.sentenceTiles];tiles.splice(ti,1,...tile.parts.map(part=>({id:crypto.randomUUID(),parts:[part]})));patch(item,tiles);}}>↔</button>}
 </div>)}
 <button className="mb-sentence-add-tile" aria-label={ui('Add tile')+' '+(index+1)} onClick={()=>{const tile={id:crypto.randomUUID(),parts:['']};focus.current=tile.id;patch(item,[...item.sentenceTiles,tile]);}}>+</button>
 </div></section>)}
 <button className="mb-add-column" onClick={()=>save([...items,blankSentence()])}>+ {ui('Add sentence')}</button>
 <p className="mb-help">{ui('Enter one sentence per line. Spaces create tiles; join words to move a phrase as one tile. Drag handles change the correct order.')}</p>
 </div>;
}
export function SentencePreview({block,variant='sentence'}:{block:Block;variant?:'sentence'|'letters'}){
 const items=block.items as SentenceItem[],nonce=useRef(crypto.randomUUID()),[shuffled]=useState(()=>Object.fromEntries(items.map(i=>[i.sentenceId,shuffledTiles(i.sentenceTiles)]))),[answers,setAnswers]=useState<Record<string,(string|null)[]>>({}),[selected,setSelected]=useState<{sentence:string;tile:string}|null>(null),[checked,setChecked]=useState(false);
 function slots(item:SentenceItem){return answers[item.sentenceId]||item.sentenceTiles.map(()=>null);}
 function place(item:SentenceItem,id:string,index?:number){if(!item.sentenceTiles.some(t=>t.id===id)||index!==undefined&&(index<0||index>=item.sentenceTiles.length))return;setAnswers(old=>{const next=[...(old[item.sentenceId]||item.sentenceTiles.map(()=>null))],from=next.indexOf(id);if(index===undefined){if(from>=0)next[from]=null;}else{const other=next[index];if(from>=0)next[from]=other;next[index]=id;}return {...old,[item.sentenceId]:next};});setSelected(null);setChecked(false);}
 function start(e:React.DragEvent,item:SentenceItem,id:string){e.dataTransfer.setData('application/x-mec-sentence-tile',JSON.stringify({nonce:nonce.current,sentence:item.sentenceId,tile:id}));e.dataTransfer.effectAllowed='move';}
 function drop(e:React.DragEvent,item:SentenceItem,index?:number){e.preventDefault();e.stopPropagation();try{const d=JSON.parse(e.dataTransfer.getData('application/x-mec-sentence-tile'));if(d.nonce===nonce.current&&d.sentence===item.sentenceId)place(item,d.tile,index);}catch{}}
 const text=(item:SentenceItem,id:string|null)=>tileText(item.sentenceTiles.find(t=>t.id===id)||{id:'',parts:[]});
 const correct=(item:SentenceItem)=>slots(item).every((id,index)=>id!==null&&text(item,id)===tileText(item.sentenceTiles[index]));
 const ready=(variant!=='letters'||items.every(i=>!(/\s/.test((i.expected||'').trim()))))&&items.length>0&&items.every(i=>i.sentenceTiles.length>0&&i.sentenceTiles.every(t=>tileText(t).trim().length>0));
 return <div className={'mb-sentence-preview'+(variant==='letters'?' mb-letters-preview':'')}>
 {block.content&&<div className="mb-columns-existing"><FormattedText text={block.content} html={formatOf(block,'content',block.content)}/></div>}
 <p className="mb-help">{ui(variant==='letters'?'Drag letters into the empty spaces, or select a letter and then a space.':'Drag tiles into the empty spaces, or select a tile and then a space. Click a placed tile to return it.')}</p>
 {items.map((item,si)=><section className="mb-sentence-task" key={item.sentenceId} data-sentence-task={item.sentenceId} data-result={checked?(slots(item).some(id=>!id)?'empty':correct(item)?'correct':'incorrect'):undefined}>
 <div className="mb-sentence-task-heading"><strong>{si+1} / {items.length}</strong>{checked&&<span role="status">{slots(item).some(id=>!id)?ui('Not filled'):correct(item)?'✓ '+ui('Correct'):'× '+ui('Try again')}</span>}</div>
 {variant==='letters'&&item.prompt&&<h3 className="mb-letter-hint">{item.prompt}</h3>}
 <div className="mb-sentence-bank" aria-label={ui('Word bank')+' '+(si+1)} onDragOver={e=>e.preventDefault()} onDrop={e=>drop(e,item)}>
 {(shuffled[item.sentenceId]||[]).filter(id=>!slots(item).includes(id)).map(id=><button className="mb-sentence-token" key={id} data-sentence-token={id} draggable onDragStart={e=>start(e,item,id)} aria-pressed={selected?.tile===id&&selected.sentence===item.sentenceId} onClick={()=>setSelected(selected?.tile===id?null:{sentence:item.sentenceId,tile:id})}><span aria-hidden="true">⠿</span>{text(item,id)}</button>)}
 {slots(item).every(Boolean)&&<span className="mb-help">{ui('All tiles placed')}</span>}
 </div>
 <div className="mb-sentence-slots">{slots(item).map((id,index)=><button key={index} className="mb-sentence-slot" data-sentence-slot={index} aria-label={ui(variant==='letters'?'Word':'Sentence')+' '+(si+1)+', '+ui('Position')+' '+(index+1)} draggable={!!id} onDragStart={e=>{if(id)start(e,item,id);}} onDragOver={e=>e.preventDefault()} onDrop={e=>drop(e,item,index)} onClick={()=>{if(selected){if(selected.sentence===item.sentenceId)place(item,selected.tile,index);}else if(id)place(item,id);}}>{id?text(item,id):'\u00a0'}</button>)}</div>
 </section>)}
 <div className="mb-inline-check"><button className="primary" disabled={!ready} onClick={()=>setChecked(true)}>{ui('Check answers')}</button>{checked&&<span role="status">{items.filter(correct).length} / {items.length} {ui('correct')}</span>}</div>
 </div>;
}
