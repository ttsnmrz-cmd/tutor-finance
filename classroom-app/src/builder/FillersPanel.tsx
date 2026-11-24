import {useState} from 'react';
import {ui} from '../i18n';

type FillerKind='dice'|'would'|'question';
const questions=[
 'What made you smile today?','What would you do with one completely free day?','What is something you are really good at?','What is the best thing about your week?','If you could learn any skill instantly, what would it be?','What is one thing you would like to change about your daily routine?'
];
const woulds=[
 ['live by the sea','live in the mountains'],['travel to the past','travel to the future'],['always be 10 minutes early','always be 20 minutes late'],['give up your phone for a week','give up sweets for a month'],['be able to fly','be able to become invisible'],['work four long days','work five short days']
];
const dice=[
 'Name 3 things connected with today’s topic.','Describe something without saying its name.','Ask your teacher a question.','Make a sentence using a word from today’s lesson.','Tell a short story in 30 seconds.','Choose one new word and explain it in English.'
];
const pick=<T,>(items:T[],old?:T)=>{const pool=items.length>1?items.filter(x=>x!==old):items;return pool[Math.floor(Math.random()*pool.length)]||items[0];};

export type FillerState={kind:FillerKind;question:string;would:string[];roll:number};
export const initialFillerState: FillerState={kind:'dice',question:questions[0],would:woulds[0],roll:0};
export function FillersPanel({studentMode=false,onClose,state,onState}:{studentMode?:boolean;onClose?:()=>void;state?:FillerState;onState?:(state:FillerState)=>void}){
 const [local,setLocal]=useState<FillerState>(initialFillerState);const current=state||local,kind=current.kind,question=current.question,would=current.would,roll=current.roll;const update=(next:FillerState)=>{setLocal(next);onState?.(next);};
 const next=()=>{if(kind==='dice')update({...current,roll:Math.floor(Math.random()*6)});else if(kind==='would')update({...current,would:pick(woulds,current.would)});else update({...current,question:pick(questions,current.question)});};
 return <section className="mb-fillers" aria-label={ui('Fillers')}>
  <header><div><span className="mb-filler-kicker">🎲 {ui('Fillers')}</span><h2>{ui('Quick activity')}</h2></div>{!studentMode&&onClose&&<button type="button" onClick={onClose}>← {ui('Back to lesson')}</button>}</header>
  {!studentMode&&<nav aria-label={ui('Choose a filler')}>
   <button className={kind==='dice'?'active':''} onClick={()=>update({...current,kind:'dice'})}>🎲 {ui('Dice Challenge')}</button>
   <button className={kind==='would'?'active':''} onClick={()=>update({...current,kind:'would'})}>↔ {ui('Would You Rather?')}</button>
   <button className={kind==='question'?'active':''} onClick={()=>update({...current,kind:'question'})}>💬 {ui('Random Question')}</button>
  </nav>}
  <div className="mb-filler-stage">
   {kind==='dice'&&<><div className="mb-filler-die" aria-label={(roll+1).toString()}>{['⚀','⚁','⚂','⚃','⚄','⚅'][roll]}</div><p>{dice[roll]}</p></>}
   {kind==='would'&&<><span className="mb-filler-label">{ui('Would you rather…')}</span><div className="mb-filler-choice"><strong>{would[0]}</strong><span>{ui('or')}</span><strong>{would[1]}?</strong></div><p>{ui('Choose one and explain why.')}</p></>}
   {kind==='question'&&<><span className="mb-filler-label">{ui('Answer in English')}</span><p className="mb-filler-question">{question}</p></>}
  </div>
  {!studentMode&&<button type="button" className="mb-filler-next" onClick={next}>{kind==='dice'?ui('Roll again'):ui('Another one')} ↻</button>}
 </section>;
}
