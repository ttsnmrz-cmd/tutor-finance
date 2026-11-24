import {useLiveAnswer} from './liveAnswers';
import {TextImageTools} from './inlineImages';
import {useEffect,useLayoutEffect,useRef,useState,Fragment} from 'react';
import type {Block,Item} from '../planning/model';
import {ui} from '../i18n';
import {FormattingToolbar} from './RichTextField';
import {editableText,formatOf,formatPatch,sanitizeHtml,FormattedText} from './textFormatting';
import {SelectionPopup} from './SelectionPopup';
import {answerIndex,type ChoiceItem} from './choiceData';

type InlineItem=ChoiceItem&{inlineChoiceId:string;originalHtml?:string};
const token=(id:string)=>'⟦choice:'+id+'⟧';
const entries=(b:Block)=>b.items as InlineItem[];
export function InlineChoiceEditor({block,onChange}:{block:Block;onChange:(b:Block)=>void}){
 const root=useRef<HTMLDivElement>(null),range=useRef<Range|null>(null),signature=useRef(''),editing=useRef(false);
 const [selected,setSelected]=useState(false),[active,setActive]=useState<string|null>(null),[form,setForm]=useState<{id?:string;options:string[];correct:number;anchor:Range|HTMLElement}|null>(null),[error,setError]=useState('');
 const html=formatOf(block,'content',block.content),key=JSON.stringify([block.content,block.items,html]);
 const dismiss=()=>{setSelected(false);setActive(null);setForm(null);editing.current=false;setError('');};
 function chip(item:InlineItem){const span=document.createElement('span');span.dataset.choice=item.inlineChoiceId;span.contentEditable='false';span.className='mb-authored-gap mb-inline-authored';span.textContent=(item.options||[]).join(' / ');span.tabIndex=0;span.setAttribute('role','button');span.setAttribute('aria-label',ui('Edit choices')+': '+span.textContent);return span;}
 useLayoutEffect(()=>{if(signature.current===key)return;signature.current=key;const el=root.current;if(!el)return;el.replaceChildren();if(html)el.innerHTML=sanitizeHtml(html);else el.textContent=block.content;const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),nodes:Text[]=[];let n;while(n=walker.nextNode())nodes.push(n as Text);
 nodes.forEach(node=>{const parts=(node.textContent||'').split(/(⟦choice:[a-f0-9-]+⟧)/g);if(parts.length<2)return;const frag=document.createDocumentFragment();parts.forEach(part=>{const item=entries(block).find(i=>token(i.inlineChoiceId)===part);frag.append(item?chip(item):document.createTextNode(part));});node.replaceWith(frag);});dismiss();},[key]);
 function commit(nextItems=entries(block)){const el=root.current;if(!el)return;const clone=el.cloneNode(true) as HTMLElement,ids=new Set<string>();clone.querySelectorAll<HTMLElement>('[data-choice]').forEach(span=>{ids.add(span.dataset.choice!);span.replaceWith(document.createTextNode(token(span.dataset.choice!)));});const content=editableText(clone),markup=sanitizeHtml(clone.innerHTML),items=nextItems.filter(i=>ids.has(i.inlineChoiceId));signature.current=JSON.stringify([content,items,markup]);onChange({...block,...formatPatch(block,'content',content,markup),content,items});}
 function capture(){if(editing.current)return;const sel=getSelection();if(!sel?.rangeCount){setSelected(false);return;}const r=sel.getRangeAt(0),el=root.current;if(!el?.contains(r.startContainer)||!el.contains(r.endContainer)){setSelected(false);return;}range.current=r.cloneRange();if(sel.isCollapsed||!r.toString().trim()||Array.from(el.querySelectorAll('[data-choice],[data-mec-image]')).some(n=>r.intersectsNode(n))){setSelected(false);return;}setSelected(true);setActive(null);}
 useEffect(()=>{document.addEventListener('selectionchange',capture);return()=>document.removeEventListener('selectionchange',capture);},[]);
 function format(command:string,value?:string){const el=root.current;if(!el)return;el.focus();const sel=getSelection();if(range.current&&el.contains(range.current.commonAncestorContainer)){sel?.removeAllRanges();sel?.addRange(range.current);}document.execCommand(command,false,value);commit();capture();}
 function openForm(){const r=range.current;if(!r)return;editing.current=true;setForm({options:[r.toString().trim(),''],correct:0,anchor:r.cloneRange()});setSelected(false);}
 function edit(id:string){const el=root.current?.querySelector<HTMLElement>('[data-choice="'+id+'"]'),item=entries(block).find(i=>i.inlineChoiceId===id);if(!el||!item)return;editing.current=true;setSelected(false);setActive(null);setForm({id,options:[...(item.options||[])],correct:answerIndex(item)??0,anchor:el});}
 function save(){if(!form)return;const options=form.options.map(o=>o.trim());if(options.length<2||options.some(o=>!o)||form.correct<0||form.correct>=options.length){setError(ui('Enter at least two options and select the correct one.'));return;}
 const id=form.id||crypto.randomUUID(),old=entries(block).find(i=>i.inlineChoiceId===id);let originalHtml=old?.originalHtml,prompt=old?.prompt||range.current?.toString().trim()||options[form.correct];
 if(!form.id){const r=range.current;if(!r||!root.current?.contains(r.commonAncestorContainer))return;const raw=r.toString(),box=document.createElement('div');box.append(r.cloneContents());const walker=document.createTreeWalker(box,NodeFilter.SHOW_TEXT),texts:Text[]=[];let node;while(node=walker.nextNode())texts.push(node as Text);if(texts.length){texts[0].textContent=texts[0].textContent?.replace(/^\s+/,'')||'';const last=texts[texts.length-1];last.textContent=last.textContent?.replace(/\s+$/,'')||'';}originalHtml=sanitizeHtml(box.innerHTML);r.deleteContents();const frag=document.createDocumentFragment();if(raw.match(/^\s+/))frag.append(document.createTextNode(raw.match(/^\s+/)![0]));frag.append(chip({inlineChoiceId:id,prompt,options,choiceAnswerIndex:form.correct}));if(raw.match(/\s+$/))frag.append(document.createTextNode(raw.match(/\s+$/)![0]));r.insertNode(frag);
 }else{root.current?.querySelector('[data-choice="'+id+'"]')?.replaceWith(chip({inlineChoiceId:id,prompt,options,choiceAnswerIndex:form.correct}));}
 const item:InlineItem={...old,inlineChoiceId:id,prompt,options,expected:options[form.correct],choiceAnswerIndex:form.correct,originalHtml};commit([...entries(block).filter(i=>i.inlineChoiceId!==id),item]);getSelection()?.removeAllRanges();range.current=null;dismiss();}
 function remove(id:string){const el=root.current?.querySelector('[data-choice="'+id+'"]'),item=entries(block).find(i=>i.inlineChoiceId===id);if(!el||!item)return;const t=document.createElement('template');t.innerHTML=item.originalHtml?sanitizeHtml(item.originalHtml):'';if(item.originalHtml)el.replaceWith(t.content);else el.replaceWith(document.createTextNode(item.prompt));commit();dismiss();}
 const activeEl=active?root.current?.querySelector<HTMLElement>('[data-choice="'+active+'"]'):null;
 return <div className="mb-inline-author"><FormattingToolbar onFormat={format}><TextImageTools root={root} rangeRef={range} onChange={()=>commit()}/></FormattingToolbar>
 <div ref={root} className="mb-gap-editable mb-inline-editable" contentEditable suppressContentEditableWarning role="textbox" aria-label={ui('Exercise text')} aria-multiline="true" onInput={()=>{commit();dismiss();}} onMouseUp={capture} onKeyUp={capture} onClick={e=>{const el=(e.target as Element).closest<HTMLElement>('[data-choice]');if(el){setActive(el.dataset.choice!);setSelected(false);}}} onKeyDown={e=>{if(e.key==='Backspace'||e.key==='Delete'){const sel=getSelection();if(sel?.rangeCount&&sel.isCollapsed){const original=sel.getRangeAt(0).cloneRange();sel.modify('extend',e.key==='Backspace'?'backward':'forward','character');const candidate=sel.rangeCount?sel.getRangeAt(0):null;const touches=candidate&&Array.from(root.current?.querySelectorAll('[data-choice],[data-mec-image]')||[]).some(n=>candidate.intersectsNode(n));sel.removeAllRanges();sel.addRange(original);if(touches)e.preventDefault();}}const el=e.target as HTMLElement;if(e.key==='Enter'&&el.dataset.choice){e.preventDefault();edit(el.dataset.choice);}}} onPaste={e=>{e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain'));commit();}}/>
 <p className="mb-gap-hint">{ui('Select a word or phrase and click Add choices.')}</p>
 {!form&&selected&&range.current&&<SelectionPopup anchor={range.current} onDismiss={dismiss}><button onClick={openForm}>{ui('Add choices')}</button></SelectionPopup>}
 {!form&&activeEl&&<SelectionPopup anchor={activeEl} onDismiss={dismiss}><div role="toolbar"><button onClick={()=>edit(active!)}>{ui('Edit choices')}</button><button onClick={()=>remove(active!)}>{ui('Remove choices')}</button></div></SelectionPopup>}
 {form&&<SelectionPopup anchor={form.anchor} onDismiss={dismiss}><div className="mb-inline-form" role="dialog" aria-label={ui('Edit choices')}><strong>{ui('Options')}</strong>{form.options.map((option,index)=><div className="mb-inline-option-row" key={index}><input type="radio" name="inline-correct" aria-label={ui('Correct option')+' '+(index+1)} checked={form.correct===index} onChange={()=>setForm({...form,correct:index})}/><input autoFocus={index===1} aria-label={ui('Option')+' '+(index+1)} value={option} onChange={e=>setForm({...form,options:form.options.map((o,i)=>i===index?e.target.value:o)})}/><button disabled={form.options.length<=2} aria-label={ui('Delete option')+' '+(index+1)} onClick={()=>setForm({...form,options:form.options.filter((_,i)=>i!==index),correct:form.correct===index?-1:form.correct>index?form.correct-1:form.correct})}>×</button></div>)}<button onClick={()=>setForm({...form,options:[...form.options,'']})}>+ {ui('Add option')}</button>{error&&<p role="alert">{error}</p>}<div className="mb-inline-form-actions">{form.id&&<button onClick={()=>remove(form.id!)}>{ui('Remove choices')}</button>}<button className="primary" onClick={save}>{ui('Save choices')}</button></div></div></SelectionPopup>}
 </div>;
}
/** Shuffle only the displayed order. Stored options and answer indices stay unchanged. */
function shuffledIndices(count:number):number[]{
 const indices=Array.from({length:count},(_,i)=>i);
 for(let i=indices.length-1;i>0;i--){
  const j=Math.floor(Math.random()*(i+1));
  [indices[i],indices[j]]=[indices[j],indices[i]];
 }
 return indices;
}
export function InlineChoicePreview({block,teacherHints=false}:{block:Block;teacherHints?:boolean}){
 const [answers,setAnswers]=useLiveAnswer<Record<string,number>>(block.id+':answers',{}),[checked,setChecked]=useLiveAnswer(block.id+':checked',false);
 const items=entries(block);
 // Stable while the student interacts; a new preview mount produces a new shuffle.
 const order=useRef(new Map<string,{signature:string;indices:number[]}>());
 const displayed=(item:InlineItem)=>{
  const options=item.options||[];
  const signature=JSON.stringify(options);
  const cached=order.current.get(item.inlineChoiceId);
  if(cached?.signature===signature)return cached.indices;
  const indices=shuffledIndices(options.length);
  order.current.set(item.inlineChoiceId,{signature,indices});
  return indices;
 };
 const ready=items.length>0&&items.every(i=>i.options?.length&&answerIndex(i)!==undefined);
 return <div className="mb-inline-preview"><div className="mb-inline-paragraph"><FormattedText text={block.content} html={formatOf(block,'content',block.content)} renderToken={id=>{const item=items.find(i=>i.inlineChoiceId===id);if(!item)return token(id);return <span className="mb-inline-group" role="group" aria-label={ui('Choose the correct option')+' '+(items.indexOf(item)+1)}>{displayed(item).map((originalIndex,position)=><Fragment key={originalIndex}>{position>0&&<span className="mb-inline-slash"> / </span>}<button className={teacherHints&&originalIndex===answerIndex(item)?'mb-teacher-inline-correct':''} aria-pressed={answers[id]===originalIndex} data-result={checked&&answers[id]===originalIndex?(originalIndex===answerIndex(item)?'correct':'incorrect'):undefined} onClick={()=>{setAnswers({...answers,[id]:originalIndex});setChecked(false);}}>{item.options?.[originalIndex]}</button></Fragment>)}</span>;}}/></div><div className="mb-inline-check"><button className="primary" disabled={!ready} onClick={()=>setChecked(true)}>{ui('Check answers')}</button>{checked&&<span role="status">{items.filter(i=>answers[i.inlineChoiceId]===answerIndex(i)).length} / {items.length} {ui('correct')}</span>}</div></div>;
}
