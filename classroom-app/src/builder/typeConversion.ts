import {blankLetterWord} from './letterData';
import {blankSentence} from './sentenceData';
import {blankColumns,blankColumnWord} from './ColumnsExercise';
import {blankStatement} from './TrueFalseExercise';
import {builderType,isInlineChoice,isColumns,isSentence,isTypedGap,isLetters,isGallery,blankChoiceQuestion,type BuilderExerciseType} from './choiceData';
import type {Block} from '../planning/model';
import {formatOf,formatPatch} from './textFormatting';
type Backup={at:string;block:Block};
type ArchivedBlock=Block&{typeConversionBackups?:Backup[]};
/** Keep the source shape recoverable, but give the new gap editor plain text only. */
export function matchingToGapText(block:Block):Block{
 const {typeConversionBackups=[],...source}=block as ArchivedBlock;
 const pairs=block.items.map((item,i)=>builderType(block)==='multiple_choice'?`${i+1}. ${item.prompt}\n${(item.options||[]).map(option=>'- '+option).join('\n')}`:`${i+1}. ${[...new Set([item.prompt,item.expected||''].filter(Boolean))].join(' — ')}`).join('\n');
 const content=[block.content,pairs].filter(x=>x.trim()).join('\n\n');
 const escaped=document.createElement('div');escaped.textContent=content;
 const next:ArchivedBlock={...block,...formatPatch(block,'content',content,carryImages(block,content)),type:'gaps',content,items:[],typeConversionBackups:[...typeConversionBackups,{at:new Date().toISOString(),block:structuredClone(source)}]};
 return next;
}
export function hasUnconvertedPairs(block:Block){return block.type==='gaps'&&!/_{2,}/.test(block.content)&&block.items.length>0&&block.items.every(i=>!/_{2,}/.test(i.prompt));}

export function switchBlockType(block:Block,type:BuilderExerciseType):Block{
 if(type===builderType(block))return block;
 if(isGallery(block))block={...block,choiceMode:undefined} as Block;
 if(isTypedGap(block))block={...block,choiceMode:undefined} as Block;
 if(isLetters(block)){const {typeConversionBackups=[],...source}=block as ArchivedBlock;const content=[block.content,...block.items.map(i=>[i.expected,i.prompt].filter(Boolean).join(' — '))].filter(Boolean).join('\n');block={...block,...formatPatch(block,'content',content,carryImages(block,content)),content,items:[],choiceMode:undefined,typeConversionBackups:[...typeConversionBackups,{at:new Date().toISOString(),block:structuredClone(source)}]} as Block;}
 if(isSentence(block)){const {typeConversionBackups=[],...source}=block as ArchivedBlock;const content=[block.content,...block.items.map(i=>i.prompt)].filter(Boolean).join('\n');block={...block,...formatPatch(block,'content',content,escapeText(content)),content,items:[],choiceMode:undefined,typeConversionBackups:[...typeConversionBackups,{at:new Date().toISOString(),block:structuredClone(source)}]} as Block;}
 if(isColumns(block)){const {typeConversionBackups=[],...source}=block as ArchivedBlock;const cols=(block as Block&{columns:{id:string;title:string}[]}).columns||[];const list=cols.map(c=>c.title+'\n'+block.items.filter(i=>i.expected===c.id).map(i=>'- '+i.prompt).join('\n')).join('\n\n');const content=[block.content,list].filter(Boolean).join('\n\n');block={...block,...formatPatch(block,'content',content,escapeText(content)),content,items:[],choiceMode:undefined,typeConversionBackups:[...typeConversionBackups,{at:new Date().toISOString(),block:structuredClone(source)}]} as Block;}
 if(isInlineChoice(block)){const original=structuredClone(block),items=block.items as (Block['items'][number]&{inlineChoiceId?:string})[];const replace=(value:string,html=false)=>value.replace(/⟦choice:([a-f0-9-]+)⟧/g,(_,id)=>{const item=items.find(i=>i.inlineChoiceId===id),text=item?[(item.options||[]).join(' / ')].join(''):'';return html?escapeText(text):text;});const content=replace(block.content),html=replace(formatOf(block,'content',block.content)||escapeText(block.content),true);block={...block,...formatPatch(block,'content',content,html),content,items:[],choiceMode:undefined,typeConversionBackups:[...((block as ArchivedBlock).typeConversionBackups||[]),{at:new Date().toISOString(),block:original}]} as Block;}
 if(type==='gallery'){const {typeConversionBackups=[],...source}=block as ArchivedBlock;const flattened=block.items.length?matchingToGapText(block):block;return {...flattened,type:'text',choiceMode:'gallery',galleryImages:(block as Block&{galleryImages?:unknown[]}).galleryImages||[],items:[],typeConversionBackups:[...typeConversionBackups,{at:new Date().toISOString(),block:structuredClone(source)}]} as Block;}
 if(type==='typed_gap'){const next=switchBlockType(block,'gaps');return {...next,choiceMode:'typed'} as Block;}
 if(type==='letters'){const {typeConversionBackups=[],...source}=block as ArchivedBlock;const flattened=block.items.length?matchingToGapText(block):block;return {...flattened,type:'ranking',choiceMode:'letters',items:[blankLetterWord()],typeConversionBackups:[...typeConversionBackups,{at:new Date().toISOString(),block:structuredClone(source)}]} as Block;}
 if(type==='sentence'){const {typeConversionBackups=[],...source}=block as ArchivedBlock;const flattened=block.items.length?matchingToGapText(block):block;return {...flattened,type:'ranking',choiceMode:'sentence',items:[blankSentence()],typeConversionBackups:[...typeConversionBackups,{at:new Date().toISOString(),block:structuredClone(source)}]} as Block;}
 if(type==='columns'){const {typeConversionBackups=[],...source}=block as ArchivedBlock;const flattened=block.items.length?matchingToGapText(block):block;const columns=blankColumns();return {...flattened,type:'text',choiceMode:'columns',columns,items:[blankColumnWord(columns[0].id)],typeConversionBackups:[...typeConversionBackups,{at:new Date().toISOString(),block:structuredClone(source)}]} as Block;}
 if(type==='inline_choice'){const {typeConversionBackups=[],...source}=block as ArchivedBlock;const flattened=block.items.length?matchingToGapText(block):block;return {...flattened,type:'text',choiceMode:'inline',items:[],typeConversionBackups:[...typeConversionBackups,{at:new Date().toISOString(),block:structuredClone(source)}]} as Block;}
 if(type==='multiple_choice'){const {typeConversionBackups=[],...source}=block as ArchivedBlock;const next:ArchivedBlock&{choiceMode:'single'}={...block,type:'questions',choiceMode:'single',items:block.items.length?block.items.map(i=>({...i,options:i.options?.length?[...i.options]:['','']})):[blankChoiceQuestion()],typeConversionBackups:[...typeConversionBackups,{at:new Date().toISOString(),block:structuredClone(source)}]};return next;}
 if(type==='gaps'){const valid=builderType(block)!=='multiple_choice'&&block.type!=='matching'&&(block.content.match(/_{2,}/g)||[]).length===block.items.length&&block.items.every(i=>!!i.expected&&!i.options?.length);return valid?{...block,type}:matchingToGapText(block);}
 const {choiceMode:unused,...plain}=block as Block&{choiceMode?:string};block=plain;
 const archived=(block as ArchivedBlock).typeConversionBackups||[];
 const matching=type==='matching'?[...archived].reverse().find(entry=>entry.block.type==='matching'):undefined;
 if(matching){const {typeConversionBackups:ignored,...source}=block as ArchivedBlock;const next:ArchivedBlock={...block,type,content:matching.block.content,items:structuredClone(matching.block.items),...formatPatch(block,'content',matching.block.content,formatOf(matching.block,'content',matching.block.content)||escapeText(matching.block.content)),typeConversionBackups:[...archived,{at:new Date().toISOString(),block:structuredClone(source)}]};return next;}
 return {...block,type,items:!block.items.length?(type==='matching'?[{prompt:'',expected:''}]:type==='true_false'?[blankStatement()]:block.items):block.items};
}
function escapeText(text:string){const el=document.createElement('div');el.textContent=text;return el.innerHTML;}

function carryImages(block:Block,content:string){const html=formatOf(block,'content',block.content);return html?.includes('data-mec-image')&&content.startsWith(block.content)?html+escapeText(content.slice(block.content.length)):escapeText(content);}
