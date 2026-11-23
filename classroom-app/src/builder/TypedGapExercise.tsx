import {useState} from 'react';
import type {Block} from '../planning/model';
import {ui} from '../i18n';
import {FormattedText,formatOf} from './textFormatting';

export function TypedGapPreview({block,teacherHints=false}:{block:Block;teacherHints?:boolean}){
 const [answers,setAnswers]=useState<Record<number,string>>({}),[checked,setChecked]=useState(false);
 const count=(block.content.match(/_{2,}/g)||[]).length;
 const ready=count>0&&count===block.items.length&&block.items.every(i=>!!i.expected?.trim()&&!i.options?.length);
 const normalize=(s:string)=>s.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase();
 const correct=(index:number)=>!!answers[index]?.trim()&&normalize(answers[index])===normalize(block.items[index]?.expected||'');
 return <div className="mb-typed-gap-preview"><div className="mb-typed-gap-text"><FormattedText text={block.content} html={formatOf(block,'content',block.content)} gaps renderGap={index=>{const result=checked?(!answers[index]?.trim()?'empty':correct(index)?'correct':'incorrect'):undefined;return <span className="mb-typed-answer mb-teacher-hint-anchor" data-result={result}><input aria-label={ui('Answer space')+' '+(index+1)} aria-invalid={result==='incorrect'} style={{width:Math.min(32,Math.max(8,(answers[index]||'').length+2))+'ch'}} autoComplete="off" spellCheck={false} autoCapitalize="off" value={answers[index]||''} onChange={e=>{setAnswers({...answers,[index]:e.target.value});setChecked(false);}} onKeyDown={e=>{if(e.key==='Enter'&&ready)setChecked(true);}}/>{checked&&<span className="mb-typed-answer-mark" aria-label={ui(result==='correct'?'Correct':result==='incorrect'?'Try again':'Not filled')}>{result==='correct'?'✓':result==='incorrect'?'×':'–'}</span>}</span>{teacherHints&&block.items[index]?.expected?.trim()&&<span className="mb-teacher-answer-hint" role="tooltip"><small>✓ Правильный ответ</small><strong>{block.items[index].expected}</strong></span>};}}/></div>
 <div className="mb-inline-check"><button className="primary" disabled={!ready} onClick={()=>setChecked(true)}>{ui('Check answers')}</button>{checked&&<span role="status">{block.items.filter((_,i)=>correct(i)).length} / {block.items.length} {ui('correct')}</span>}</div>
 </div>;
}
