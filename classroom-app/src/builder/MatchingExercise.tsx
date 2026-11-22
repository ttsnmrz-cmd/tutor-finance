import {useLayoutEffect,useRef,useState} from 'react';
import type {Block} from '../planning/model';
import {ui} from '../i18n';
import {FormattedText,formatOf} from './textFormatting';

export function CompactTextInput({label,value,onChange,placeholder}:{label:string;value:string;onChange:(value:string)=>void;placeholder?:string}){const ref=useRef<HTMLTextAreaElement>(null);useLayoutEffect(()=>{const el=ref.current;if(!el)return;const fit=()=>{el.style.height='0px';el.style.height=Math.max(40,el.scrollHeight+2)+'px';};fit();const observer=new ResizeObserver(()=>{if(el.clientWidth!==Number(el.dataset.width)){el.dataset.width=String(el.clientWidth);fit();}});observer.observe(el);return()=>observer.disconnect();},[value]);return <textarea ref={ref} aria-label={label} placeholder={placeholder} rows={1} value={value} onChange={e=>onChange(e.target.value)}/>;}
export function MatchingEditor({block,onChange}:{block:Block;onChange:(next:Block)=>void}){
 const update=(index:number,field:'prompt'|'expected',value:string)=>onChange({...block,items:block.items.map((item,i)=>i===index?{...item,[field]:value}:item)});
 return <div className="mb-matching-editor"><div className="mb-matching-labels"><span>{ui('Word or phrase')}</span><span>{ui('Translation or match')}</span><span/></div>{block.items.map((item,i)=><div className="mb-matching-row" key={i}><CompactTextInput label={ui('Left text')+' '+(i+1)} value={item.prompt} onChange={value=>update(i,'prompt',value)}/><CompactTextInput label={ui('Right text')+' '+(i+1)} value={item.expected||''} onChange={value=>update(i,'expected',value)}/><button type="button" aria-label={ui('Delete pair')+' '+(i+1)} onClick={()=>{if(confirm(ui('Delete this pair?')))onChange({...block,items:block.items.filter((_,n)=>n!==i)});}}>×</button></div>)}<button type="button" onClick={()=>onChange({...block,items:[...block.items,{prompt:'',expected:''}]})}>+ {ui('Add pair')}</button>{block.items.some(i=>!i.prompt.trim()||!i.expected?.trim())&&<p className="mb-help">{ui('Complete both sides of each pair before trying Preview.')}</p>}</div>;
}
function shuffled(ids:number[]){const next=[...ids];for(let i=next.length-1;i>0;i--){const values=new Uint32Array(1);crypto.getRandomValues(values);const j=values[0]%(i+1);[next[i],next[j]]=[next[j],next[i]];}return next;}
export function MatchingPreview({block}:{block:Block}){
 const valid=block.items.map((item,id)=>({item,id})).filter(({item})=>item.prompt.trim()&&item.expected?.trim());
 const [order]=useState(()=>{const ids=valid.map(p=>p.id),left=shuffled(ids);let right=shuffled(ids);if(right.length>1&&right.every((id,i)=>id===left[i]))right=[...right.slice(1),right[0]];return {left,right};});
 const [selected,setSelected]=useState<number|null>(null),[matches,setMatches]=useState<Record<number,number>>({}),[checked,setChecked]=useState(false);
 const norm=(text:string)=>text.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase();
 const correct=(id:number)=>matches[id]!==undefined&&norm(block.items[matches[id]]?.expected||'')===norm(block.items[id].expected||'');
 const score=valid.reduce((n,{id})=>n+(correct(id)?1:0),0);
 function link(right:number){if(selected===null)return;setMatches(old=>{const next={...old};for(const k of Object.keys(next))if(next[+k]===right)delete next[+k];next[selected]=right;return next;});setSelected(null);setChecked(false);}
 function unlink(left:number){setMatches(old=>{const next={...old};delete next[left];return next;});setChecked(false);}
 function card(id:number,side:'left'|'right'){const left=side==='left'?id:Number(Object.keys(matches).find(k=>matches[+k]===id)??-1),paired=side==='left'?matches[id]!==undefined:left>=0,result=checked&&paired?(correct(left)?'correct':'incorrect'):undefined,item=block.items[id],text=side==='left'?item.prompt:item.expected||'';const pairNumber=paired?order.left.indexOf(left)+1:undefined;
  return <button type="button" key={id} data-match-side={side} data-match-id={id} data-result={result} aria-pressed={side==='left'?selected===id:paired} className={'mb-match-card'+(side==='left'&&selected===id?' selected':'')+(paired?' paired':'')} onClick={()=>{if(side==='right'){if(selected!==null)link(id);else if(left>=0)unlink(left);}else if(selected===id)setSelected(null);else setSelected(id);}}><FormattedText text={text} html={formatOf(item,side==='left'?'prompt':'expected',text)}/>{paired&&<span className="mb-match-badge" aria-label={ui('Pair')+' '+pairNumber}>{pairNumber}{checked?(result==='correct'?' ✓':' ×'):''}</span>}</button>;
 }
 return <section className="mb-matching-preview" aria-label={ui('Matching')}>
 {block.content&&<div className="mb-student-text"><FormattedText text={block.content} html={formatOf(block,'content',block.content)}/></div>}
 <p className="mb-match-hint">{ui('Choose a card on the left, then its match on the right. Click a paired right card to undo.')}</p>
 <div className="mb-matching-columns"><div aria-label={ui('Left column')}>{order.left.map(id=>card(id,'left'))}</div><div aria-label={ui('Right column')}>{order.right.map(id=>card(id,'right'))}</div></div>
 {valid.length<block.items.length&&<p className="mb-help">{ui('Some pairs are incomplete. Finish them in the Builder.')}</p>}
 <div className="mb-check-actions"><button type="button" disabled={!valid.length} onClick={()=>setChecked(true)}>{ui('Check')}</button><span role="status">{checked?score+' / '+valid.length+' '+ui('correct'):''}</span></div>
 </section>;
}
