import {MediaEditor} from './MediaExercise';
import {GalleryEditor} from './GalleryExercise';
import {LettersEditor} from './LettersExercise';
import {SentenceEditor} from './SentenceExercise';
import {ColumnsEditor} from './ColumnsExercise';
import {InlineChoiceEditor} from './InlineChoiceExercise';
import {TrueFalseEditor} from './TrueFalseExercise';
import {MultipleChoiceEditor} from './MultipleChoiceExercise';
import {builderType,isMultipleChoice,isInlineChoice,isColumns,isSentence,isTypedGap,isLetters,isGallery,type BuilderExerciseType} from './choiceData';
import {useEffect,useState} from 'react';
import {matchingToGapText,hasUnconvertedPairs,switchBlockType} from './typeConversion';
import {MatchingEditor} from './MatchingExercise';
import type {Block,Item} from '../planning/model';
import {blockTypes} from '../planning/model';
import {RichTextField} from './RichTextField';
import {formatOf,formatPatch} from './textFormatting';
import {ui} from '../i18n';
import {exerciseLabel} from './commands';
import {GapTextEditor,supportsGapAuthoring} from './GapTextEditor';

export function ExerciseEditor({block,onChange,onSave,saveStatus,assetScope='',canJoinPrevious=false}:{canJoinPrevious?:boolean;assetScope?:string;block:Block;onChange:(block:Block)=>void;onSave:()=>void;saveStatus:string}){
 useEffect(()=>{if(hasUnconvertedPairs(block))onChange(matchingToGapText(block));},[block.id,block.type,block.content,block.items]);
 const [noteOpen,setNoteOpen]=useState(!!block.teacherNote); const visualGaps=supportsGapAuthoring(block);
 const patch=(p:Partial<Block>)=>onChange({...block,...p});
 const item=(index:number,p:Partial<Item>)=>patch({items:block.items.map((old,i)=>i===index?{...old,...p}:old)});
 return <section className="mb-editor" aria-label={ui('Exercise editor')}>
  <div className="mb-editor-heading"><h2><input aria-label={ui('Exercise title')} value={block.title} onChange={e=>patch({title:e.target.value})}/></h2><select aria-label={ui('Exercise type')} value={builderType(block)} onChange={e=>{const type=e.target.value as BuilderExerciseType;if(type===builderType(block))return;if((block.content.trim()||block.items.length)&&!confirm(ui('Change exercise type? Text, formatting and existing answers will be kept. Review the exercise after changing its type.')))return;onChange(switchBlockType(block,type));}}>{([...blockTypes.filter(t=>t!=='questions'||block.type==='questions'&&!isMultipleChoice(block)),'multiple_choice','inline_choice','columns','sentence','typed_gap','letters','gallery'] as BuilderExerciseType[]).map(type=><option key={type} value={type}>{ui(type==='gallery'?'Image / Gallery':type==='typed_gap'?'Type the Missing Word':type==='letters'?'Build a Word':type==='sentence'?'Build a Sentence':type==='columns'?'Sort into Columns':type==='inline_choice'?'Choose the Correct Option':type==='multiple_choice'?'Multiple Choice':type==='questions'?'Speaking / Discussion':block.type!=='gaps'&&type==='gaps'?'Gap Fill (Text)':exerciseLabel({...block,type,choiceMode:undefined} as Block))}</option>)}</select></div>


  <div className="mb-teacher-note-editor">
   {!noteOpen?<button type="button" className="mb-teacher-note-add" onClick={()=>setNoteOpen(true)}>＋ {ui('Add teacher note')}</button>:
    <div className="mb-teacher-note-card"><div className="mb-teacher-note-heading"><strong>{ui('Teacher note')}</strong><span>{ui('Visible only to teacher')}</span><button type="button" aria-label={ui('Remove teacher note')} onClick={()=>{patch({teacherNote:''});setNoteOpen(false);}}>×</button></div><textarea rows={3} aria-label={ui('Teacher note')} placeholder={ui('Add instructions or reminders for yourself…')} value={block.teacherNote||''} onChange={e=>patch({teacherNote:e.target.value})}/></div>}
  </div>
  <label className="mb-join-previous"><input type="checkbox" aria-label={ui('Show together with previous')} disabled={!canJoinPrevious} checked={canJoinPrevious&&!!(block as Block&{joinPrevious?:boolean}).joinPrevious} onChange={e=>onChange({...block,joinPrevious:e.target.checked} as Block)}/>{ui('Show together with previous')}</label>
  {block.type==='video'?<MediaEditor block={block} onChange={onChange} scope={assetScope}/>:isGallery(block)?<GalleryEditor block={block} onChange={onChange} scope={assetScope}/>:isLetters(block)?<LettersEditor block={block} onChange={onChange}/>:isSentence(block)?<SentenceEditor block={block} onChange={onChange}/>:isColumns(block)?<ColumnsEditor block={block} onChange={onChange}/>:isInlineChoice(block)?<InlineChoiceEditor block={block} onChange={onChange}/>:block.type==='true_false'?<TrueFalseEditor block={block} onChange={onChange}/>:isMultipleChoice(block)?<MultipleChoiceEditor block={block} onChange={onChange}/>:block.type==='matching'?<MatchingEditor block={block} onChange={onChange}/>:visualGaps?<GapTextEditor block={block} onChange={onChange} hideFormatting={isTypedGap(block)}/>:<RichTextField label={ui('Content')} hideLabel value={block.content} html={formatOf(block,'content',block.content)} onChange={(value,html)=>patch({...formatPatch(block,'content',value,html),content:value})}/>} 
  {block.type==='gaps'&&!visualGaps&&<p className="mb-help">{ui('Use ____ for existing gaps. Correct answers stay in the items below. This is an authoring form, not the student interaction.')}</p>}

  {!visualGaps&&!isLetters(block)&&!isSentence(block)&&!['true_false','matching','questions','text','video','writing'].includes(block.type)&&<div className="mb-items"><h3>{ui(block.type==='ranking'?'Ordering items':'Exercise items')}</h3>
   {block.items.map((it,index)=><div className="mb-item-fields" key={index}><RichTextField label={ui('Prompt')} compact value={it.prompt} html={formatOf(it,'prompt',it.prompt)} onChange={(value,html)=>item(index,{...formatPatch(it,'prompt',value,html),prompt:value})}/>
    {block.type!=='ranking'&&<label className="mb-field">{ui('Correct answer')}<input value={it.expected||''} onChange={e=>item(index,{expected:e.target.value})}/></label>}
    {(!!it.options?.length||['matching','true_false'].includes(block.type))&&<label className="mb-field">{ui('Options · one per line')}<textarea rows={3} value={(it.options||[]).join('\n')} readOnly={block.type==='gaps'} onChange={e=>item(index,{options:e.target.value.split('\n')})}/>{block.type==='gaps'&&<small>{ui('Legacy word bank/options are retained unchanged in Phase 1.')}</small>}</label>}
    {block.type==='ranking'&&<div className="mb-order-buttons"><button aria-label={ui('Move item up')+' '+(index+1)} disabled={index===0} onClick={()=>{const next=[...block.items];[next[index-1],next[index]]=[next[index],next[index-1]];patch({items:next});}}>↑</button><button aria-label={ui('Move item down')+' '+(index+1)} disabled={index===block.items.length-1} onClick={()=>{const next=[...block.items];[next[index],next[index+1]]=[next[index+1],next[index]];patch({items:next});}}>↓</button></div>}
    <button className="mb-item-remove" onClick={()=>{if(confirm(ui('Delete this item?')))patch({items:block.items.filter((_,i)=>i!==index)});}}>{ui('Delete item')}</button>
   </div>)}
   <button onClick={()=>patch({items:[...block.items,{prompt:'',...(block.type==='true_false'?{options:['True','False']}:{} )}]})}>+ {ui('Add item')}</button>
  </div>}
  <div className="mb-editor-footer"><span role="status">{ui(saveStatus)}</span><button className="primary" aria-label={ui('Save')} onClick={onSave}>✓ {ui('Save')}</button></div>
 </section>;
}
