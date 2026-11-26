import {TeacherPrompts} from './TeacherPrompts';
import {TextImageScope} from './inlineImages';
import {VocabularyListPreview} from './VocabularyListExercise';
import {MediaPreview} from './MediaExercise';
import {OrderingPreview} from './OrderingExercise';
import {ImageGapPreview,ImageLabelingPreview} from './ImageLabelingExercise';
import {GalleryPreview} from './GalleryExercise';
import {LettersPreview} from './LettersExercise';
import {TypedGapPreview} from './TypedGapExercise';
import {SentencePreview} from './SentenceExercise';
import {ColumnsPreview} from './ColumnsExercise';
import {InlineChoicePreview} from './InlineChoiceExercise';
import {TrueFalsePreview} from './TrueFalseExercise';
import {MultipleChoicePreview} from './MultipleChoiceExercise';
import {isImageGap,isVocabularyList,isMultipleChoice,isInlineChoice,isColumns,isSentence,isTypedGap,isLetters,isGallery,isImageLabeling} from './choiceData';
import {MatchingPreview} from './MatchingExercise';
import {LiveAnswerContext,LiveAnswerBlock,useLiveAnswer} from './liveAnswers';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {Block,Plan} from '../planning/model';
import {PreviewControls,PreviewNotes} from './PreviewWorkspaceTools';
import {ui} from '../i18n';
import {FormattedText,formatOf} from './textFormatting';
import {exerciseLabel} from './commands';
import {supabase} from '../supabase';
import {FillersPanel,initialFillerState,type FillerState} from './FillersPanel';

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
export function ExercisePresentation({block,assetScope='',teacherHints=true}:{block:Block;assetScope?:string;teacherHints?:boolean}){
 const mode=exerciseLabel(block),words=previewWordBank(block);
 const [placements,setPlacements]=useLiveAnswer<Record<number,number>>(block.id+':placements',{}),[selectedWord,setSelectedWord]=useLiveAnswer<number|null>(block.id+':selected',null),[checked,setChecked]=useLiveAnswer(block.id+':checked',false);
 const nonce=useRef(crypto.randomUUID()),touch=useRef<number|null>(null);
 const gaps=block.content.split(/_{2,}/g);
 const total=gaps.length>1?gaps.length-1:block.items.reduce((n,i)=>n+Math.max(1,(i.prompt.match(/_{2,}/g)||[]).length),0);
 const canCheck=words.length>0&&total===block.items.length&&block.items.every(i=>!!i.expected?.trim());
 const normalized=(value:string)=>value.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase();
 const correct=(index:number)=>placements[index]!==undefined&&normalized(words[placements[index]])===normalized(block.items[index]?.expected||'');
 const score=block.items.reduce((n,_,i)=>n+(correct(i)?1:0),0);
 function place(token:number,index:number){if(!Number.isInteger(token)||token<0||token>=words.length)return;setChecked(false);setPlacements(old=>{const next={...old};Object.keys(next).forEach(k=>{if(next[+k]===token)delete next[+k];});next[index]=token;return next;});setSelectedWord(null);}
 function drag(e:React.DragEvent,token:number){e.dataTransfer.setData('application/x-mec-preview-word',JSON.stringify({nonce:nonce.current,token}));e.dataTransfer.effectAllowed='move';}
 function slot(index:number){const expected=block.items[index]?.expected?.trim();const hint=teacherHints&&expected?<span className="mb-teacher-answer-hint" role="tooltip"><strong>{expected}</strong></span>:null;if(!words.length)return <span className="mb-teacher-hint-anchor"><span className="mb-preview-gap" aria-label={ui('Answer space')}>{mode.startsWith('Dropdown')?'⌄':'\u00a0'}</span>{hint}</span>;const token=placements[index],result=checked?(token===undefined?'empty':correct(index)?'correct':'incorrect'):undefined;return <span className="mb-teacher-hint-anchor"><button type="button" className={'mb-preview-gap'+(token!==undefined?' filled':'')} data-preview-gap={index} data-result={result} aria-label={ui('Answer space')+' '+(index+1)+(result?': '+ui(result==='correct'?'Correct':result==='incorrect'?'Try again':'Not filled'):'')} aria-pressed={token!==undefined} title={ui(token!==undefined?'Click to return the word':'Drop a word here')} draggable={token!==undefined} onDragStart={e=>{if(token!==undefined)drag(e,token);}} onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect='move';}} onDrop={e=>{e.preventDefault();try{const data=JSON.parse(e.dataTransfer.getData('application/x-mec-preview-word'));if(data.nonce===nonce.current)place(data.token,index);}catch{}}} onClick={()=>{if(selectedWord!==null)place(selectedWord,index);else if(token!==undefined){setChecked(false);setPlacements(old=>{const next={...old};delete next[index];return next;});}}}>{token!==undefined?words[token]:'\u00a0'}{checked&&token!==undefined&&<span className="mb-answer-mark" aria-hidden="true">{correct(index)?' ✓':' ×'}</span>}</button>{hint}</span>;}
 let fallbackIndex=0;
 const sentence=(text:string)=>text.split(/_{2,}/g).map((part,i)=><span key={i}>{i>0&&slot(fallbackIndex++)}{part}</span>);
 if(block.type==='video')return <MediaPreview key={block.id} block={block} scope={assetScope}/>;
 if(isVocabularyList(block))return <VocabularyListPreview key={block.id} block={block}/>;
 if(isImageGap(block))return <ImageGapPreview key={block.id} block={block} scope={assetScope} teacherHints={teacherHints}/>;
 if(isImageLabeling(block))return <ImageLabelingPreview key={block.id} block={block} scope={assetScope} teacherHints={teacherHints}/>;
 if(isGallery(block))return <GalleryPreview key={block.id} block={block} scope={assetScope}/>;
 if(isTypedGap(block))return <TypedGapPreview key={block.id} block={block} teacherHints={teacherHints}/>;
 if(isLetters(block))return <LettersPreview key={block.id} block={block}/>;
 if(isSentence(block))return <SentencePreview key={block.id} block={block}/>;
 if(isColumns(block))return <ColumnsPreview key={block.id} block={block} teacherHints={teacherHints}/>;
 if(isInlineChoice(block))return <InlineChoicePreview key={block.id} block={block} teacherHints={teacherHints}/>;
 if(block.type==='true_false')return <TrueFalsePreview key={block.id} block={block} teacherHints={teacherHints}/>;
 if(isMultipleChoice(block))return <MultipleChoicePreview key={block.id} block={block} teacherHints={teacherHints}/>;
 if(block.type==='matching')return <MatchingPreview key={block.id} block={block} teacherHints={teacherHints}/>;
 if(block.type==='ranking')return <OrderingPreview key={block.id} block={block} teacherHints={teacherHints}/>;
 return <div className="mb-student-content">
  {!!words.length&&<div className="mb-word-bank" role="group" aria-label={ui('Word bank')}>{words.map((w,i)=>Object.values(placements).includes(i)?null:<button type="button" key={i} data-word-token={i} draggable aria-pressed={selectedWord===i} onDragStart={e=>drag(e,i)} onClick={()=>setSelectedWord(selectedWord===i?null:i)} onPointerDown={e=>{if(e.pointerType==='mouse')return;touch.current=i;e.currentTarget.setPointerCapture(e.pointerId);}} onPointerUp={e=>{if(touch.current===null)return;const token=touch.current;touch.current=null;e.currentTarget.releasePointerCapture(e.pointerId);const target=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-preview-gap]');if(target)place(token,Number(target.dataset.previewGap));}} onPointerCancel={()=>{touch.current=null;}}>{w}</button>)}</div>}
  {block.type==='gaps'?<div className="mb-student-text"><FormattedText text={block.content} html={formatOf(block,'content',block.content)} gaps dropdown={mode.startsWith('Dropdown')} renderGap={slot}/></div>:<div className="mb-student-text"><FormattedText text={block.content} html={formatOf(block,'content',block.content)}/></div>}
  {block.type==='gaps'&&gaps.length===1&&block.items.map((it,i)=><p key={i}>{sentence(it.prompt)}{!/_{2,}/.test(it.prompt)&&slot(fallbackIndex++)}</p>)}
  {block.type!=='gaps'&&block.items.length>0&&<div className="mb-student-items">{block.items.map((it,i)=><div key={i}><span className="mb-item-number">{i+1}</span><p><FormattedText text={it.prompt} html={formatOf(it,'prompt',it.prompt)}/></p>{['matching','true_false'].includes(block.type)&&<span className="mb-preview-choice">{ui('Choose…')} <span aria-hidden="true">⌄</span></span>}{block.type==='writing'&&<div className="mb-writing-space"/>}</div>)}</div>}
  {canCheck&&<div className="mb-check-actions"><button type="button" onClick={()=>setChecked(true)}>{ui('Check')}</button><span role="status">{checked?score+' / '+total+' '+ui('correct'):''}</span></div>}
 </div>;
}
export function ExercisePreview({plan,selected,onBack,scopeKey,assetScope='',studentMode=false,liveSessionId,homework}:{homework?:{answers:Record<string,unknown>;onChange:(answers:Record<string,unknown>)=>void;readOnly:boolean};liveSessionId?:string;assetScope?:string;plan:Plan;selected:string;onBack:()=>void;scopeKey:string;studentMode?:boolean}){
 const homeworkPreview=!studentMode&&!liveSessionId&&plan.stages.some(s=>s.homework&&plan.blocks.some(b=>b.id===selected&&b.stage===s.id));
 const ordered=[...plan.stages.filter(s=>homeworkPreview? s.homework:!s.homework).flatMap(s=>plan.blocks.filter(b=>b.stage===s.id&&!b.hiddenFromStudent)),...plan.blocks.filter(b=>!homeworkPreview&&!b.hiddenFromStudent&&b.scope!=='homework'&&!plan.stages.some(s=>s.id===b.stage))];
 const steps:Block[][]=[];ordered.forEach(b=>{const last=steps[steps.length-1];if((b as Block&{joinPrevious?:boolean}).joinPrevious&&last?.[last.length-1].stage===b.stage)last.push(b);else steps.push([b]);});
 const [notesOpen,setNotesOpen]=useState(false),[teacherHints,setTeacherHints]=useState(!studentMode);
 const [studentNavOpen,setStudentNavOpen]=useState(false),[followEnabled,setFollowEnabled]=useState(false),[studentExercise,setStudentExercise]=useState<string|null>(null),[fillerOpen,setFillerOpen]=useState(false),[fillerState,setFillerState]=useState<FillerState>(initialFillerState);
 const [index,setIndex]=useState(()=>{if(studentMode){try{const saved=sessionStorage.getItem(scopeKey+':exercise');const found=steps.findIndex(group=>group.some(b=>b.id===saved));if(found>=0)return found;}catch{}}return Math.max(0,steps.findIndex(group=>group.some(b=>b.id===selected)));});
 const safeIndex=Math.min(index,Math.max(0,steps.length-1)),block=steps[safeIndex]?.[0],stage=block?plan.stages.find(s=>s.id===block.stage):undefined;
 const [remoteAnswers,setRemoteAnswers]=useState<Record<string,unknown>>(homework?.answers||{});
 const homeworkAnswers=useRef(remoteAnswers);
 const navChannel=useRef<ReturnType<typeof supabase.channel>|null>(null),followRef=useRef(false);
 const sendAnswer=useCallback((key:string,value:unknown)=>{if(homework){if(homework.readOnly)return;const next={...homeworkAnswers.current,[key]:value};homeworkAnswers.current=next;setRemoteAnswers(next);homework.onChange(next);return;}setRemoteAnswers(old=>({...old,[key]:value}));if(navChannel.current)void navChannel.current.send({type:'broadcast',event:'lesson-navigation',payload:{type:'live-answer',key,value}});},[homework]);
 useEffect(()=>{followRef.current=followEnabled;},[followEnabled]);
 useEffect(()=>{if(!liveSessionId)return;const channel=supabase.channel('classroom-follow:'+liveSessionId,{config:{broadcast:{self:false}}});navChannel.current=channel;channel.on('broadcast',{event:'lesson-navigation'},({payload})=>{if(!payload)return;if(payload.type==='live-answer'&&typeof payload.key==='string'){setRemoteAnswers(old=>({...old,[payload.key]:payload.value}));return;}if(studentMode&&payload.type==='teacher-position'&&payload.exerciseId&&payload.force!==false){setFillerOpen(false);const next=steps.findIndex(group=>group.some(b=>b.id===payload.exerciseId));if(next>=0)setIndex(next);}else if(studentMode&&payload.type==='filler'){setFillerState(payload.state||initialFillerState);setFillerOpen(!!payload.open);}else if(!studentMode&&payload.type==='bingo-turn'){setFillerState(old=>old.kind==='bingo'&&old.bingo&&payload.state?.bingo?.round===old.bingo.round?{...old,bingo:{...old.bingo,studentMarks:payload.state.bingo.studentMarks}}:old);}else if(!studentMode&&payload.type==='memory-turn'&&followRef.current){setFillerState(old=>{if(old.kind!=='memory'||!old.memory||!payload.state?.memory)return old;return {...old,memory:payload.state.memory};});}else if(!studentMode&&payload.type==='student-position'&&payload.exerciseId)setStudentExercise(payload.exerciseId);}).subscribe(()=>{if(studentMode&&steps[safeIndex]?.[0])void channel.send({type:'broadcast',event:'lesson-navigation',payload:{type:'student-position',exerciseId:steps[safeIndex][0].id}});});return()=>{navChannel.current=null;void supabase.removeChannel(channel);};},[liveSessionId,studentMode,steps.length]);
 useEffect(()=>{const exerciseId=steps[safeIndex]?.[0]?.id;if(!exerciseId)return;if(studentMode){try{sessionStorage.setItem(scopeKey+':exercise',exerciseId);}catch{}if(navChannel.current)void navChannel.current.send({type:'broadcast',event:'lesson-navigation',payload:{type:'student-position',exerciseId}});}else if(followEnabled&&navChannel.current){void navChannel.current.send({type:'broadcast',event:'lesson-navigation',payload:{type:'teacher-position',exerciseId,force:true}});}},[safeIndex,studentMode,scopeKey,steps.length,followEnabled]);
 function bringStudentHere(){const exerciseId=steps[safeIndex]?.[0]?.id;if(!exerciseId||!navChannel.current)return;void navChannel.current.send({type:'broadcast',event:'lesson-navigation',payload:{type:'teacher-position',exerciseId,force:true}});}
 function syncFiller(open:boolean,state=fillerState){if(navChannel.current)void navChannel.current.send({type:'broadcast',event:'lesson-navigation',payload:{type:'filler',open,state}});}
 useEffect(()=>{if(!studentMode&&fillerOpen&&(fillerState.kind==='memory'||fillerState.kind==='bingo'))syncFiller(true,fillerState);},[fillerState,fillerOpen,followEnabled,studentMode]);
 function toggleFiller(){const next=!fillerOpen;setFillerOpen(next);syncFiller(next);}
 const viewportRef=useRef<HTMLElement>(null);
 useEffect(()=>{
  const el=viewportRef.current;if(!el||scopeKey.startsWith("homework:review:"))return;
  const resize=()=>{const top=el.getBoundingClientRect().top+window.scrollY;el.style.setProperty('min-height',Math.max(320,window.innerHeight-top-16)+'px','important');};
  resize();window.addEventListener('resize',resize);const observer=new ResizeObserver(resize);if(el.parentElement)observer.observe(el.parentElement);return()=>{window.removeEventListener('resize',resize);observer.disconnect();};
 },[]);
 const studentAway=!studentMode&&!!studentExercise&&studentExercise!==block?.id;
 return <TextImageScope.Provider value={assetScope}><LiveAnswerContext.Provider value={{student:studentMode,enabled:!!liveSessionId||!!homework,values:remoteAnswers,send:sendAnswer}}><section ref={viewportRef} style={{display:"flex",flexDirection:"column"}} className="mb-builder mb-student-preview" data-homework-review={scopeKey.startsWith("homework:review:")?"true":undefined} aria-label={ui('Student preview')}>
  {!scopeKey.startsWith("homework:review:")&&<div className="mb-preview-top">
   <div className="mb-preview-heading-row">
    <h1>{plan.title}{stage&&<><span className="mb-preview-crumb-separator" aria-hidden="true">›</span><span className="mb-preview-section-crumb">{stage.name}</span></>}</h1>
    {studentMode&&!homework&&<PreviewControls activeId={block?.id||'empty'} scopeKey={scopeKey} studentMode={studentMode} liveSessionId={liveSessionId} onNotes={()=>setNotesOpen(true)} followEnabled={followEnabled} studentAway={studentAway} onToggleFollow={()=>{const next=!followEnabled;setFollowEnabled(next);if(next)bringStudentHere();}} onBringHere={bringStudentHere} onFillers={toggleFiller} fillersOpen={fillerOpen}/>}
    {!studentMode&&<button className="mb-preview-back" onClick={onBack}>✎ {ui('Builder')}</button>}
   </div>
   {!studentMode&&<div className="mb-preview-tools-row">
    {!studentMode&&<label className="mb-teacher-hints-toggle"><input type="checkbox" checked={teacherHints} onChange={e=>setTeacherHints(e.target.checked)}/> {ui('Teacher Hints')}</label>}
    {!studentMode&&<TeacherPrompts key={stage?.name||''} scope={assetScope} section={stage?.name||''}/>}{!studentMode&&!homework&&<PreviewControls activeId={block?.id||'empty'} scopeKey={scopeKey} studentMode={studentMode} liveSessionId={liveSessionId} onNotes={()=>setNotesOpen(true)} followEnabled={followEnabled} studentAway={studentAway} onToggleFollow={()=>{const next=!followEnabled;setFollowEnabled(next);if(next)bringStudentHere();}} onBringHere={bringStudentHere} onFillers={toggleFiller} fillersOpen={fillerOpen}/>}
   </div>}
  </div>}<div className="mb-preview-workspace" style={{flex:"1 0 auto",alignItems:"stretch"}}>
  {fillerOpen?<article id="activity" className="mb-student-card mb-filler-card"><FillersPanel studentMode={studentMode} state={fillerState} onState={next=>{setFillerState(next);if(studentMode){if(navChannel.current)void navChannel.current.send({type:'broadcast',event:'lesson-navigation',payload:{type:next.kind==='bingo'?'bingo-turn':'memory-turn',state:next}});}else syncFiller(true,next);}} onClose={()=>{setFillerOpen(false);syncFiller(false);}}/></article>:block?<article id="activity" className="mb-student-card" key={block.id}><div className="mb-preview-footer" style={{marginTop:0,borderTop:0,borderBottom:"1px solid var(--border-color,#ddd)"}}><button className="mb-student-previous" disabled={safeIndex===0} onClick={()=>setIndex(safeIndex-1)}>‹ {ui('Previous')}</button><div className="mb-preview-progress" aria-label={`${safeIndex+1} / ${steps.length}`}>{steps.map((group,i)=><button type="button" key={group[0].id} className={i<=safeIndex?'current':''} aria-current={i===safeIndex?'step':undefined} aria-label={`${i+1}. ${group[0].title.trim()||ui(exerciseLabel(group[0]))}`} title={`${i+1}. ${group[0].title.trim()||ui(exerciseLabel(group[0]))}`} onClick={()=>setIndex(i)}/>)}</div><button className="primary" disabled={safeIndex===steps.length-1} onClick={()=>setIndex(safeIndex+1)}>{ui('Next')} ›</button></div><div className="mb-student-body" style={{flex:"1 0 auto"}}>{steps[safeIndex].map(element=><section className="mb-combined-element" key={element.id} data-preview-element={element.id}>{!studentMode&&element.teacherNote?.trim()&&<aside className="mb-preview-teacher-note" aria-label={ui('Teacher note')}><strong>{ui('Teacher note')} · {ui('Visible only to teacher')}</strong><p>{element.teacherNote}</p></aside>}{element.title.trim()&&<h2 className="mb-preview-instruction">{element.title}</h2>}<LiveAnswerBlock.Provider value={element.id}><ExercisePresentation block={element} assetScope={assetScope} teacherHints={teacherHints}/></LiveAnswerBlock.Provider></section>)}</div>
  <div className="mb-preview-footer" style={{marginTop:"auto"}}><button className="mb-student-previous" disabled={safeIndex===0} onClick={()=>setIndex(safeIndex-1)}>‹ {ui('Previous')}</button><div className="mb-preview-progress" aria-label={`${safeIndex+1} / ${steps.length}`}>{steps.map((group,i)=><button type="button" key={group[0].id} className={i<=safeIndex?'current':''} aria-current={i===safeIndex?'step':undefined} aria-label={`${i+1}. ${group[0].title.trim()||ui(exerciseLabel(group[0]))}`} title={`${i+1}. ${group[0].title.trim()||ui(exerciseLabel(group[0]))}`} onClick={()=>setIndex(i)}/>)}</div><button className="primary" disabled={safeIndex===steps.length-1} onClick={()=>setIndex(safeIndex+1)}>{ui('Next')} ›</button></div></article>:<p>{ui('Choose an exercise or add your first one. No planning form is required.')}</p>}
 {!studentMode&&<PreviewNotes key={liveSessionId||scopeKey} liveSessionId={liveSessionId} scopeKey={scopeKey} open={notesOpen} onClose={()=>setNotesOpen(false)}/>}</div></section></LiveAnswerContext.Provider></TextImageScope.Provider>;
}

