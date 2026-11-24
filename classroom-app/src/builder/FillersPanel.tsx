import {useState,useEffect} from 'react';
import {ui} from '../i18n';
import {VocabularySets} from './VocabularySets';

type FillerKind='dice'|'would'|'question'|'memory';
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

const themes:Record<string,string[][]>={Animals:[['dog','🐶'],['cat','🐱'],['frog','🐸'],['bird','🐦'],['fish','🐟'],['rabbit','🐰'],['horse','🐴'],['duck','🦆']],Food:[['apple','🍎'],['banana','🍌'],['bread','🍞'],['cheese','🧀'],['carrot','🥕'],['egg','🥚'],['pizza','🍕'],['pear','🍐']],Transport:[['car','🚗'],['bus','🚌'],['train','🚆'],['plane','✈️'],['bike','🚲'],['boat','⛵'],['truck','🚚'],['taxi','🚕']],School:[['book','📕'],['pencil','✏️'],['scissors','✂️'],['backpack','🎒'],['ruler','📏'],['pen','🖊️'],['computer','💻'],['globe','🌍']]};
type MemoryCard={word:string;picture:string;image:boolean};
type MemoryState={theme:string;count:number;cards:MemoryCard[];open:number[];matched:number[];moves:number;customPairs?:string[][]};
function newMemory(theme='Animals',count=5,customPairs?:string[][]):MemoryState{const pairs=customPairs||themes[theme]||themes.Animals;count=Math.min(count,pairs.length);const cards=pairs.slice(0,count).flatMap(([word,picture])=>[{word,picture,image:false},{word,picture,image:true}]);for(let i=cards.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]];}return {theme,count,cards,open:[],matched:[],moves:0,customPairs};}
export type FillerState={kind:FillerKind;question:string;would:string[];roll:number;memory?:MemoryState};
export const initialFillerState: FillerState={kind:'dice',question:questions[0],would:woulds[0],roll:0};
export function FillersPanel({studentMode=false,onClose,state,onState}:{studentMode?:boolean;onClose?:()=>void;state?:FillerState;onState?:(state:FillerState)=>void}){
 const [local,setLocal]=useState<FillerState>(initialFillerState);const current=state||local,kind=current.kind,question=current.question,would=current.would,roll=current.roll;const update=(next:FillerState)=>{setLocal(next);onState?.(next);};
 const memory=current.memory;const [libraryOpen,setLibraryOpen]=useState(false);
 const flip=(i:number)=>{if(!memory||memory.open.length>=2||memory.open.includes(i)||memory.matched.includes(i))return;const open=[...memory.open,i];const match=open.length===2&&memory.cards[open[0]].word===memory.cards[i].word;update({...current,memory:{...memory,open:match?[]:open,matched:match?[...memory.matched,...open]:memory.matched,moves:memory.moves+(open.length===2?1:0)}});if(memory.cards[i].image&&typeof speechSynthesis!=='undefined'){const utterance=new SpeechSynthesisUtterance(memory.cards[i].word);utterance.lang='en-GB';speechSynthesis.speak(utterance);}};
 useEffect(()=>{if(studentMode||kind!=='memory'||!memory||memory.open.length!==2)return;const timer=setTimeout(()=>update({...current,memory:{...memory,open:[]}}),1100);return()=>clearTimeout(timer);},[memory,kind,studentMode]);
 const next=()=>{if(kind==='dice')update({...current,roll:Math.floor(Math.random()*6)});else if(kind==='would')update({...current,would:pick(woulds,current.would)});else update({...current,question:pick(questions,current.question)});};
 return <section className="mb-fillers" aria-label={ui('Fillers')}>
  <header><div><span className="mb-filler-kicker">🎲 {ui('Fillers')}</span><h2>{ui('Quick activity')}</h2></div>{!studentMode&&onClose&&<button type="button" onClick={onClose}>← {ui('Back to lesson')}</button>}</header>
  {!studentMode&&<nav aria-label={ui('Choose a filler')}>
   <button className={kind==='dice'?'active':''} onClick={()=>update({...current,kind:'dice'})}>🎲 {ui('Dice Challenge')}</button>
   <button className={kind==='would'?'active':''} onClick={()=>update({...current,kind:'would'})}>↔ {ui('Would You Rather?')}</button>
   <button className={kind==='question'?'active':''} onClick={()=>update({...current,kind:'question'})}>💬 {ui('Random Question')}</button>
   <button className={kind==='memory'?'active':''} onClick={()=>update({...current,kind:'memory',memory:current.memory||newMemory()})}>🃏 Memory</button>
  </nav>}
  {kind==='memory'&&memory?<div style={{display:'grid',gap:12}}>
  {!studentMode&&<div style={{display:'flex',gap:8,flexWrap:'wrap'}}><select aria-label="Theme" value={memory.customPairs?"__custom":memory.theme} onChange={e=>update({...current,memory:newMemory(e.target.value,memory.count)})}>{memory.customPairs&&<option value="__custom" disabled>{memory.theme}</option>}{Object.keys(themes).map(t=><option key={t}>{t}</option>)}</select><select aria-label="Pairs" value={memory.count} onChange={e=>update({...current,memory:newMemory(memory.theme,Number(e.target.value),memory.customPairs)})}>{[...new Set([memory.count,4,5,6,8])].filter(n=>n<=(memory.customPairs?.length||8)).sort((a,b)=>a-b).map(n=><option key={n} value={n}>{n} pairs</option>)}</select><button onClick={()=>update({...current,memory:newMemory(memory.theme,memory.count,memory.customPairs)})}>↻ New game</button><button onClick={()=>setLibraryOpen(!libraryOpen)}>My sets {libraryOpen?'▴':'▾'}</button></div>}
  {!studentMode&&libraryOpen&&<VocabularySets onPlay={set=>{update({...current,memory:newMemory(set.name,Math.min(5,set.pairs.length),set.pairs)});setLibraryOpen(false);}}/>}
  <div role="status">Find the pairs · {memory.matched.length/2}/{memory.count} · Moves: {memory.moves}</div>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(100px,1fr))',gap:10}}>{memory.cards.map((card,i)=>{const matched=memory.matched.includes(i),visible=matched||memory.open.includes(i);return <button type="button" key={i} disabled={matched||memory.open.length===2||memory.open.includes(i)} aria-label={visible?(card.image?card.picture:card.word):'Card '+(i+1)} onClick={()=>flip(i)} style={{minHeight:100,borderRadius:12,border:matched?'2px solid #26965b':'1px solid #d9d0e5',background:matched?'#e6f7ec':visible?'#f4f5f7':'#4e2a84',color:visible?'#1f242d':'white',fontSize:visible&&!card.image?18:36,opacity:1}}>{visible?(card.image&&/^https:\/\//i.test(card.picture)?<img src={card.picture} alt="" referrerPolicy="no-referrer" style={{width:'100%',height:76,objectFit:'contain'}}/>:card.image?card.picture:card.word):'?'}</button>;})}</div>
  {memory.matched.length===memory.cards.length&&<strong role="status">🎉 Well done!</strong>}</div>:<div className="mb-filler-stage">
   {kind==='dice'&&<><div className="mb-filler-die" aria-label={(roll+1).toString()}>{['⚀','⚁','⚂','⚃','⚄','⚅'][roll]}</div><p>{dice[roll]}</p></>}
   {kind==='would'&&<><span className="mb-filler-label">{ui('Would you rather…')}</span><div className="mb-filler-choice"><strong>{would[0]}</strong><span>{ui('or')}</span><strong>{would[1]}?</strong></div><p>{ui('Choose one and explain why.')}</p></>}
   {kind==='question'&&<><span className="mb-filler-label">{ui('Answer in English')}</span><p className="mb-filler-question">{question}</p></>}
  </div>}
  {!studentMode&&kind!=='memory'&&<button type="button" className="mb-filler-next" onClick={next}>{kind==='dice'?ui('Roll again'):ui('Another one')} ↻</button>}
 </section>;
}
