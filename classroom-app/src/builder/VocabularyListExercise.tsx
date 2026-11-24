import type {Block} from '../planning/model';
import {useState} from 'react';
import {ui} from '../i18n';
import './vocabulary-list.css';
type Word={word:string;ipa:string;translation:string};
type VocabularyBlock=Block&{vocabularyWords?:Word[];wordsPerColumn?:number};
const blank=()=>({word:'',ipa:'',translation:''});
function speak(word:string){if(!window.speechSynthesis)return;const u=new SpeechSynthesisUtterance(word);u.lang='en-GB';const voice=speechSynthesis.getVoices().find(v=>v.lang==='en-GB');if(voice)u.voice=voice;speechSynthesis.cancel();speechSynthesis.speak(u);}
export function VocabularyListEditor({block,onChange}:{block:Block;onChange:(b:Block)=>void}){
 const b=block as VocabularyBlock,words=b.vocabularyWords||[],[bulk,setBulk]=useState('');
 const patch=(p:Partial<VocabularyBlock>)=>onChange({...b,...p});
 return <div className="mb-vocab-editor"><label>{ui('Words per column')} <input type="number" min={1} max={50} value={b.wordsPerColumn||5} onChange={e=>patch({wordsPerColumn:Math.max(1,Math.min(50,Number(e.target.value)||1))})}/></label>
 <div className="mb-vocab-fields"><strong>{ui('Word')}</strong><strong>IPA</strong><strong>{ui('Translation')}</strong><span/></div>
 {words.map((w,i)=><div className="mb-vocab-fields" key={i}>{(['word','ipa','translation'] as const).map(k=><input key={k} aria-label={k+' '+(i+1)} value={w[k]} onChange={e=>patch({vocabularyWords:words.map((x,j)=>j===i?{...x,[k]:e.target.value}:x)})}/>)}<button type="button" aria-label={ui('Delete item')} onClick={()=>patch({vocabularyWords:words.filter((_,j)=>j!==i)})}>×</button></div>)}
 <button type="button" onClick={()=>patch({vocabularyWords:[...words,blank()]})}>+ {ui('Add word')}</button>
 <details><summary>{ui('Bulk paste')}</summary><textarea rows={5} placeholder={'word | /IPA/ | translation\nword | translation'} value={bulk} onChange={e=>setBulk(e.target.value)}/><button type="button" onClick={()=>{const rows=bulk.split(/\r?\n/).filter(x=>x.trim()).map(line=>{const parts=line.split(/\t|\s*\|\s*|\s+[—–-]\s+/).map(x=>x.trim());return {word:parts[0],ipa:parts.length>2?parts[1]:'',translation:parts.length>2?parts.slice(2).join(' '):parts[1]||''};});patch({vocabularyWords:[...words,...rows]});setBulk('');}}>{ui('Add words')}</button></details></div>;
}
export function VocabularyListPreview({block}:{block:Block}){
 const b=block as VocabularyBlock,words=(b.vocabularyWords||[]).filter(w=>w.word.trim()),n=Math.max(1,Math.min(50,Math.floor(b.wordsPerColumn||5))),columns=Array.from({length:Math.ceil(words.length/n)},(_,i)=>words.slice(i*n,(i+1)*n));
 return <div className="mb-vocab-columns">{columns.map((col,i)=><div className="mb-vocab-column" key={i}>{col.map((w,j)=><div className="mb-vocab-word" key={j}><div><strong>{w.word}</strong> <button type="button" aria-label={'Listen: '+w.word} title={'Listen: '+w.word} onClick={()=>speak(w.word)}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H3v6h3l5 4zM15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/></svg></button></div>{w.ipa&&<span className="mb-vocab-ipa">{w.ipa}</span>}{w.translation&&<span>{w.translation}</span>}</div>)}</div>)}</div>;
}
