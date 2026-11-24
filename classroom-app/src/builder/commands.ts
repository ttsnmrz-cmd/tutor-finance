import {blankLetterWord} from './letterData';
import {blankSentence} from './sentenceData';
import {blankColumns,blankColumnWord} from './ColumnsExercise';
import {blankStatement} from './TrueFalseExercise';
import {isVocabularyList,isMultipleChoice,isInlineChoice,isColumns,isSentence,isTypedGap,isLetters,isGallery,isImageLabeling,blankChoiceQuestion,type BuilderExerciseType} from './choiceData';
import type {Block,Plan,Stage} from '../planning/model';

export function addSection(plan:Plan,name:string):{plan:Plan;section:Stage}{
 const section:Stage={id:crypto.randomUUID(),name,purpose:'',minutes:0,notes:'',reflection:false,homework:false};
 return {plan:{...plan,stages:[...plan.stages,section]},section};
}
export function addExercise(plan:Plan,stage:string,type:BuilderExerciseType,title:string):{plan:Plan;block:Block}{
 if(!plan.stages.some(s=>s.id===stage))throw Error('Choose an existing section.');
 const block:Block={id:crypto.randomUUID(),stage,type:type==='vocabulary_list'?'text':type==='image_labeling'?'text':type==='gallery'?'text':type==='typed_gap'?'gaps':type==='letters'?'ranking':type==='sentence'?'ranking':type==='columns'?'text':type==='inline_choice'?'text':type==='multiple_choice'?'questions':type,...(type==='vocabulary_list'?{choiceMode:'vocabulary_list',vocabularyWords:[],wordsPerColumn:5}:type==='image_labeling'?{choiceMode:'image_labeling',labelZones:[],labelDistractors:[]}:type==='gallery'?{choiceMode:'gallery',galleryImages:[]}:type==='typed_gap'?{choiceMode:'typed'}:type==='letters'?{choiceMode:'letters'}:type==='sentence'?{choiceMode:'sentence'}:type==='columns'?{choiceMode:'columns',columns:blankColumns()}:type==='inline_choice'?{choiceMode:'inline'}:type==='multiple_choice'?{choiceMode:'single'}:{}),title,instructions:'',content:'',items:type==='letters'?[blankLetterWord()]:type==='sentence'?[blankSentence()]:type==='matching'?[{prompt:'',expected:''}]:type==='multiple_choice'?[blankChoiceQuestion()]:type==='true_false'?[blankStatement()]:[],objectives:[],role:'practice',scope:'lesson',minutes:0};
 if(type==='columns')block.items=[blankColumnWord((block as Block&{columns:{id:string}[]}).columns[0].id)];
 return {plan:{...plan,blocks:[...plan.blocks,block]},block};
}
export function copyExercise(plan:Plan,id:string,title:string):{plan:Plan;block:Block}{
 const index=plan.blocks.findIndex(b=>b.id===id);if(index<0)throw Error('Exercise not found.');
 const block={...structuredClone(plan.blocks[index]),id:crypto.randomUUID(),title};
 const blocks=[...plan.blocks];blocks.splice(index+1,0,block);return {plan:{...plan,blocks},block};
}
export function moveExercise(plan:Plan,id:string,stage:string,before?:string):Plan{
 const block=plan.blocks.find(b=>b.id===id);if(!block)throw Error('Exercise not found.');
 if(!plan.stages.some(s=>s.id===stage))throw Error('Choose an existing section.');
 if(before===id)return plan;
 const blocks=plan.blocks.filter(b=>b.id!==id);
 let index=blocks.length;
 if(before){index=blocks.findIndex(b=>b.id===before&&b.stage===stage);if(index<0)throw Error('Invalid move destination.');}
 else{for(let i=blocks.length-1;i>=0;i--)if(blocks[i].stage===stage){index=i+1;break;}}
 blocks.splice(index,0,{...block,stage});return {...plan,blocks};
}
export function reorderSection(plan:Plan,id:string,before?:string):Plan{
 if(id===before)return plan;
 const section=plan.stages.find(s=>s.id===id);
 const stages=plan.stages.filter(s=>s.id!==id);
 const index=before?stages.findIndex(s=>s.id===before):stages.length;
 if(!section||index<0)throw Error('Invalid move destination.');
 stages.splice(index,0,section);
 return {...plan,stages};
}
export function deleteExercise(plan:Plan,id:string):Plan{
 if(!plan.blocks.some(b=>b.id===id))throw Error('Exercise not found.');
 return {...plan,blocks:plan.blocks.filter(b=>b.id!==id)};
}
// Describes existing legacy shapes only. No new interaction schema or conversion.
export function exerciseLabel(b:Block):string{
 if(isVocabularyList(b))return 'Vocabulary List';
 if(isImageLabeling(b))return 'Image Labeling';
 if(isGallery(b))return 'Image / Gallery';
 if(isTypedGap(b))return 'Type the Missing Word';
 if(isLetters(b))return 'Build a Word';
 if(isSentence(b))return 'Build a Sentence';
 if(isColumns(b))return 'Sort into Columns';
 if(isInlineChoice(b))return 'Inline Choice';
 if(isMultipleChoice(b))return 'Multiple Choice';
 if(b.type==='gaps'){
  const bank=b.items.length>0&&b.items.every(i=>!!i.options?.length)&&((b.content.match(/_{2,}/g)||[]).length===b.items.length||!b.content.trim()&&b.items.every(i=>(i.prompt.match(/_{2,}/g)||[]).length===1));
  return bank?'Drag & Drop · legacy':b.items.some(i=>!!i.options?.length)?'Dropdown · legacy':'Gap Fill (Text)';
 }
 return {text:'Text / Reading',questions:'Speaking / Discussion',matching:'Matching',true_false:'True / False',video:'Add media',ranking:'Ordering',writing:'Writing'}[b.type];
}
