import {MediaPreview} from './MediaExercise';
import {OrderingPreview} from './OrderingExercise';
import {GalleryPreview} from './GalleryExercise';
import {LettersPreview} from './LettersExercise';
import {TypedGapPreview} from './TypedGapExercise';
import {SentencePreview} from './SentenceExercise';
import {ColumnsPreview} from './ColumnsExercise';
import {InlineChoicePreview} from './InlineChoiceExercise';
import {TrueFalsePreview} from './TrueFalseExercise';
import {MultipleChoicePreview} from './MultipleChoiceExercise';
import {isMultipleChoice,isInlineChoice,isColumns,isSentence,isTypedGap,isLetters,isGallery} from './choiceData';
import {MatchingPreview} from './MatchingExercise';
import {useRef,useState} from 'react';
import type {Block,Plan} from '../planning/model';
import {PreviewControls,PreviewNotes} from './PreviewWorkspaceTools';
import {ui} from '../i18n';
import {FormattedText,formatOf} from './textFormatting';
import {exerciseLabel} from './commands';

// Presentation hints only. Typed answers and drag/drop retain their existing formats.
export function previewWordBank(block:Block):string[]{
 if(block.type!=='gaps')return [];
 const mode=exerciseLabel(block);
 if(mode.startsWith('Drag & Drop'))return [...new Set(block.items.flatMap(i=>i.options||[]))];
 if(mode!=='Gap Fill (Text)')return [];
 const answers=block.items.map(i=>(i.expected||'').trim()).filter(Boolean);
 const words=[...answers].sort((a,b)=>a.localeCompare(b));
 return words.length>1&&words.every((word,i)=>word===answers[i])?words.reverse():words;
}
/** Temporary interaction in local preview only; no session or persisted answers. */
export function ExercisePresentation({block,assetScope=''}:{block:Block;assetScope?:string}){
 const mode=exerciseLabel(block),words=previewWordBank(block);
 const [placements,setPlacements]=useState<Record<number,number>>({}),[selectedWord,setSelectedWord]=useState<number|null>(null),[checked,setChecked]=useState(false);
 const nonce=useRef(crypto.randomUUID()),touch=useRef<number|null>(null);
 const gaps=block.content.split(/_{2,}/g);
 const total=gaps.length>1?gaps.length-1:block.items.reduce((n,i)=>n+Math.max(1,(i.prompt.match(/_{2,}/g)||[]).length),0);
 const canCheck=words.length>0&&total===block.items.length&&block.items.every(i=>!!i.expected?.trim());
 const normalized=(value:string)=>value.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase();
 const correct=(index:number)=>placements[index]!==undefined&&normalized(words[placements[index]])===normalized(block.items[index]?.expected||'');
 const score=block.items.reduce((n,_,i)=>n+(correct(i)?1:0),0);
 function place(token:number,index:number){if(!Number.isInteger(token)||token<0||token>=words.length)return;setChecked(false);setPlacements(old=>{const next={...old};Object.keys(next).forEach(k=>{if(next[+k]===token)delete next[+k];});next[index]=token;return next;});setSelectedWord(null);}
 function drag(e:React.DragEvent,token:number){e.dataTransfer.setData('application/x-mec-preview-word',JSON.stringify({nonce:nonce.current,token}));e.dataTransfer.effectAllowed='move';}
 function slot(index:number){if(!words.length)return <span className="mb-preview-gap" aria-label={ui('Answer space')}>{mode.startsWith('Dropdown')?'⌄':'\u00a0'}</span>;const token=placements[index],result=checked?(token===undefined?'empty':correct(index)?'correct':'incorrect'):undefined;return <button type="button" className={'mb-preview-gap'+(token!==undefined?' filled':'')} data-preview-gap={index} data-result={result} aria-label={ui('Answer space')+' '+(index+1)+(result?': '+ui(result==='correct'?'Correct':result==='incorrect'?'Try again':'Not filled'):'')} aria-pressed={token!==undefined} title={ui(token!==undefined?'Click to return the word':'Drop a word here')} draggable={token!==undefined} onDragStart={e=>{if(token!==undefined)drag(e,token);}} onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect='move';}} onDrop={e=>{e.preventDefault();try{const data=JSON.parse(e.dataTransfer.getData('application/x-mec-preview-word'));if(data.nonce===nonce.current)place(data.token,index);}catch{}}} onClick={()=>{if(selectedWord!==null)place(selectedWord,index);else if(token!==undefined){setChecked(false);setPlacements(old=>{const next={...old};delete next[index];return next;});}}}>{token!==undefined?words[token]:'\u00a0'}{checked&&token!==undefined&&<span className="mb-answer-mark" aria-hidden="true">{correct(index)?' ✓':' ×'}</span>}</button>;}
 let fallbackIndex=0;
 const sentence=(text:string)=>text.split(/_{2,}/g).map((part,i)=><span key={i}>{i>0&&slot(fallbackIndex++)}{part}</span>);
 if(block.type==='video')return <MediaPreview key={block.id} block={block} scope={assetScope}/>;
 if(isGallery(block))return <GalleryPreview key={block.id} block={block} scope={assetScope}/>;
 if(isTypedGap(block))return <TypedGapPreview key={block.id} block={block}/>;
 if(isLetters(block))return <LettersPreview key={block.id} block={block}/>;
 if(isSentence(block))return <SentencePreview key={block.id} block={block}/>;
 if(isColumns(block))return <ColumnsPreview key={block.id} block={block}/>;
 if(isInlineChoice(block))return <InlineChoicePreview key={block.id} block={block}/>;
 if(block.type==='true_false')return <TrueFalsePreview key={block.id} block={block}/>;
 if(isMultipleChoice(block))return <MultipleChoicePreview key={block.id} block={block}/>;
 if(block.type==='matching')return <MatchingPreview key={block.id} block={block}/>;
 if(block.type==='ranking')return <OrderingPreview key={block.id} block={block}/>;
 return <div className="mb-student-content">
  {!!words.length&&<div className="mb-word-bank" role="group" aria-label={ui('Word bank')}>{words.map((w,i)=>Object.values(placements).includes(i)?null:<button type="button" key={i} data-word-token={i} draggable aria-pressed={selectedWord===i} onDragStart={e=>drag(e,i)} onClick={()=>setSelectedWord(selectedWord===i?null:i)} onPointerDown={e=>{if(e.pointerType==='mouse')return;touch.current=i;e.currentTarget.setPointerCapture(e.pointerId);}} onPointerUp={e=>{if(touch.current===null)return;const token=touch.current;touch.current=null;e.currentTarget.releasePointerCapture(e.pointerId);const target=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-preview-gap]');if(target)place(token,Number(target.dataset.previewGap));}} onPointerCancel={()=>{touch.current=null;}}>{w}</button>)}</div>}
  {block.type==='gaps'?<div className="mb-student-text"><FormattedText text={block.content} html={formatOf(block,'content',block.content)} gaps dropdown={mode.startsWith('Dropdown')} renderGap={slot}/></div>:<div className="mb-student-text"><FormattedText text={block.content} html={formatOf(block,'content',block.content)}/></div>}
  {block.type==='gaps'&&gaps.length===1&&block.items.map((it,i)=><p key={i}>{sentence(it.prompt)}{!/_{2,}/.test(it.prompt)&&slot(fallbackIndex++)}</p>)}
  {block.type!=='gaps'&&block.items.length>0&&<div className="mb-student-items">{block.items.map((it,i)=><div key={i}><span className="mb-item-number">{i+1}</span><p><FormattedText text={it.prompt} html={formatOf(it,'prompt',it.prompt)}/></p>{['matching','true_false'].includes(block.type)&&<span className="mb-preview-choice">{ui('Choose…')} <span aria-hidden="true">⌄</span></span>}{block.type==='writing'&&<div className="mb-writing-space"/>}</div>)}</div>}
  {canCheck&&<div className="mb-check-actions"><button type="button" onClick={()=>setChecked(true)}>{ui('Check')}</button><span role="status">{checked?score+' / '+total+' '+ui('correct'):''}</span></div>}
 </div>;
}
export function ExercisePreview({plan,selected,onBack,scopeKey,assetScope=''}:{assetScope?:string;plan:Plan;selected:string;onBack:()=>void;scopeKey:string}){
 const ordered=[...plan.stages.flatMap(s=>plan.blocks.filter(b=>b.stage===s.id)),...plan.blocks.filter(b=>!plan.stages.some(s=>s.id===b.stage))];
 const steps:Block[][]=[];ordered.forEach(b=>{const last=steps[steps.length-1];if((b as Block&{joinPrevious?:boolean}).joinPrevious&&last?.[last.length-1].stage===b.stage)last.push(b);else steps.push([b]);});
 const [notesOpen,setNotesOpen]=useState(false);
 const [index,setIndex]=useState(()=>Math.max(0,steps.findIndex(group=>group.some(b=>b.id===selected)))),block=steps[index]?.[0];
 return <section className="mb-builder mb-student-preview" aria-label={ui('Student preview')}>
  <div className="mb-preview-top"><button onClick={onBack}>‹ {ui('Back to Builder')}</button><span className="ml-inline-badge">{ui('Preview · Local Data')}</span></div>
  <h1>{plan.title}</h1><PreviewControls activeId={block?.id||'empty'} scopeKey={scopeKey} onNotes={()=>setNotesOpen(true)}/><div className="mb-preview-workspace">
  {block?<article id="activity" className="mb-student-card" key={block.id}><div className="mb-student-body">{steps[index].map(element=><section className="mb-combined-element" key={element.id} data-preview-element={element.id}><h2>{element.title}</h2><ExercisePresentation block={element} assetScope={assetScope}/></section>)}</div>
  <div className="mb-preview-footer"><button disabled={index===0} onClick={()=>setIndex(index-1)}>‹ {ui('Previous')}</button><div className="mb-preview-progress" aria-label={`${index+1} / ${steps.length}`}>{steps.map((group,i)=><span key={group[0].id} className={i<=index?'current':''}/>)}</div><button className="primary" disabled={index===steps.length-1} onClick={()=>setIndex(index+1)}>{ui('Next')} ›</button></div></article>:<p>{ui('Choose an exercise or add your first one. No planning form is required.')}</p>}
 <PreviewNotes scopeKey={scopeKey} open={notesOpen} onClose={()=>setNotesOpen(false)}/></div></section>;
}

