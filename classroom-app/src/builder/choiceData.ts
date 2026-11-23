import type {Block,Item} from '../planning/model';
export type BuilderExerciseType=Block['type']|'multiple_choice'|'inline_choice'|'columns'|'sentence'|'typed_gap'|'letters'|'gallery'|'image_labeling';
export type ChoiceItem=Item&{choiceAnswerIndex?:number;choiceAnswerIndices?:number[]};
export function isMultipleChoice(block:Block){return block.type==='questions'&&(block as Block&{choiceMode?:string}).choiceMode==='single';}
export function builderType(block:Block):BuilderExerciseType{return isImageLabeling(block)?'image_labeling':isGallery(block)?'gallery':isTypedGap(block)?'typed_gap':isLetters(block)?'letters':isSentence(block)?'sentence':isColumns(block)?'columns':isInlineChoice(block)?'inline_choice':isMultipleChoice(block)?'multiple_choice':block.type;}
export function blankChoiceQuestion():ChoiceItem{return {prompt:'',options:['','']};}
export function answerIndex(item:ChoiceItem):number|undefined{const options=item.options||[];const key=item.choiceAnswerIndex;if(typeof key==='number'&&Number.isInteger(key)&&key>=0&&key<options.length)return key;const found=options.findIndex(o=>o!==''&&o===item.expected);return found<0?undefined:found;}
export function readyQuestion(item:ChoiceItem){return !!item.prompt.trim()&&(item.options?.length||0)>=2&&item.options!.every(o=>!!o.trim())&&answerIndices(item).length>0;}

export function isInlineChoice(block:Block){return block.type==='text'&&(block as Block&{choiceMode?:string}).choiceMode==='inline';}

export function isColumns(block:Block){return block.type==='text'&&(block as Block&{choiceMode?:string}).choiceMode==='columns';}

export function isSentence(block:Block){return block.type==='ranking'&&(block as Block&{choiceMode?:string}).choiceMode==='sentence';}

export function isTypedGap(block:Block){return block.type==='gaps'&&(block as Block&{choiceMode?:string}).choiceMode==='typed';}
export function isLetters(block:Block){return block.type==='ranking'&&(block as Block&{choiceMode?:string}).choiceMode==='letters';}

export function isGallery(block:Block){return block.type==='text'&&(block as Block&{choiceMode?:string}).choiceMode==='gallery';}

export function answerIndices(item:ChoiceItem):number[]{if(Array.isArray(item.choiceAnswerIndices))return [...new Set(item.choiceAnswerIndices.filter(i=>Number.isInteger(i)&&i>=0&&i<(item.options?.length||0)))];const index=answerIndex(item);return index===undefined?[]:[index];}
export function withChoiceKeys(item:ChoiceItem,indices:number[]):ChoiceItem{return {...item,choiceAnswerIndices:indices,choiceAnswerIndex:indices.length===1?indices[0]:undefined,expected:indices.length===1?item.options?.[indices[0]]:undefined};}

export function isImageLabeling(block:Block){return block.type==='text'&&(block as Block&{choiceMode?:string}).choiceMode==='image_labeling';}
