import type {Block} from '../planning/model';
import {ui} from '../i18n';
import {CompactTextInput} from './MatchingExercise';
import {FormattedText,formatOf} from './textFormatting';
import {SentencePreview} from './SentenceExercise';
import {blankLetterWord,letterSentence,type LetterItem} from './letterData';

export function LettersEditor({block,onChange}:{block:Block;onChange:(b:Block)=>void}){
 const items=block.items as LetterItem[];
 const update=(id:string,field:'prompt'|'expected',value:string)=>onChange({...block,items:items.map(i=>i.letterWordId===id?{...i,[field]:value}:i)});
 return <div className="mb-letters-editor">
 {block.content&&<div className="mb-columns-existing"><FormattedText text={block.content} html={formatOf(block,'content',block.content)}/></div>}
 {items.map((item,index)=><div className="mb-letter-word-row" key={item.letterWordId}><span>{index+1}</span><CompactTextInput label={ui('Word to build')+' '+(index+1)} placeholder={ui('Enter a word')} value={item.expected||''} onChange={text=>update(item.letterWordId,'expected',text)}/><CompactTextInput label={ui('Hint (optional)')+' '+(index+1)} placeholder={ui('Hint (optional)')} value={item.prompt} onChange={text=>update(item.letterWordId,'prompt',text)}/><button aria-label={ui('Delete word')+' '+(index+1)} onClick={()=>{if(!(item.expected||item.prompt).trim()||confirm(ui('Delete this word?')))onChange({...block,items:items.filter(i=>i.letterWordId!==item.letterWordId)});}}>×</button></div>)}
 <button className="mb-add-column" onClick={()=>onChange({...block,items:[...items,blankLetterWord()]})}>+ {ui('Add word')}</button>
 <p className="mb-help">{ui('Letters will be shuffled. The student builds each word. Hints are optional.')}</p>
 {items.some(i=>/\s/.test((i.expected||'').trim()))&&<p role="alert">{ui('Enter one word per row, without spaces.')}</p>}
 </div>;
}
export function LettersPreview({block}:{block:Block}){const items=block.items as LetterItem[];return <SentencePreview block={{...block,items:items.map(letterSentence)}} variant="letters"/>;}
