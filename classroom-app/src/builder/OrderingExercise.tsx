import {useState} from 'react';
import type {Block} from '../planning/model';
import {FormattedText,formatOf} from './textFormatting';
import {ui} from '../i18n';
export function OrderingPreview({block,teacherHints=false}:{block:Block;teacherHints?:boolean}){
 const [order,setOrder]=useState(()=>{const a=block.items.map((_,i)=>i);for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}if(a.length>1&&a.every((v,i)=>v===i))[a[0],a[1]]=[a[1],a[0]];return a;}),[checked,setChecked]=useState(false);
 function move(index:number,delta:number){const to=index+delta;if(to<0||to>=order.length)return;const a=[...order];[a[index],a[to]]=[a[to],a[index]];setOrder(a);setChecked(false);}
 const correct=order.every((v,i)=>block.items[v].prompt===block.items[i].prompt);
 return <div className="mb-order-preview">{block.content&&<div className="mb-columns-existing"><FormattedText text={block.content} html={formatOf(block,'content',block.content)}/></div>}<p className="mb-help">{ui('Use the arrows to put the items in the correct order.')}</p>{order.map((v,i)=><div className="mb-order-row" key={v} data-order-item={v}><span>{i+1}.</span>{teacherHints&&<span className="mb-order-correct-index" title="Правильный порядковый номер">{v+1}</span>}<div><FormattedText text={block.items[v].prompt} html={formatOf(block.items[v],'prompt',block.items[v].prompt)}/></div><div className="mb-order-buttons"><button aria-label={ui('Move item up')+' '+(i+1)} disabled={!i} onClick={()=>move(i,-1)}>↑</button><button aria-label={ui('Move item down')+' '+(i+1)} disabled={i===order.length-1} onClick={()=>move(i,1)}>↓</button></div></div>)}<div className="mb-inline-check"><button disabled={!order.length||block.items.some(i=>!i.prompt.trim())} onClick={()=>setChecked(true)}>{ui('Check answers')}</button>{checked&&<span role="status" data-result={correct?'correct':'incorrect'}>{correct?'✓ '+ui('Correct'):'× '+ui('Try again')}</span>}</div></div>;
}
