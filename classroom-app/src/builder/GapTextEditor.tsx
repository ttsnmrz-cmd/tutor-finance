import {TextImageTools} from './inlineImages';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {Block,Item} from '../planning/model';
import {ui} from '../i18n';
import {FormattingToolbar} from './RichTextField';
import {editableText,formatOf,formatPatch,sanitizeHtml,storedHtml} from './textFormatting';
import {SelectionPopup} from './SelectionPopup';

// Only unambiguous existing typed-gap shapes use the visual authoring editor.
export function supportsGapAuthoring(block:Block){return block.type==='gaps'&&!block.items.some(i=>i.options?.length)&&(block.content.match(/_{2,}/g)||[]).length===block.items.length&&block.items.every(i=>typeof i.expected==='string'&&i.expected.length>0);}
export function GapTextEditor({block,onChange,hideFormatting=false}:{block:Block;onChange:(block:Block)=>void;hideFormatting?:boolean}){
 const root=useRef<HTMLDivElement>(null),range=useRef<Range|null>(null),items=useRef(new Map<string,Item>()),signature=useRef('');
 const [selection,setSelection]=useState(false),[active,setActive]=useState<string|null>(null);
 const html=formatOf(block,'content',block.content);
 const key=JSON.stringify([block.content,block.items,html]);
 useLayoutEffect(()=>{
  if(signature.current===key)return;signature.current=key;const el=root.current;if(!el)return;
  el.replaceChildren();items.current.clear();if(html)el.innerHTML=sanitizeHtml(html);else el.textContent=block.content;
  const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),nodes:Text[]=[];let n;while(n=walker.nextNode())nodes.push(n as Text);let index=0;
  nodes.forEach(node=>{const parts=(node.textContent||'').split(/_{2,}/g);if(parts.length<2)return;const fragment=document.createDocumentFragment();parts.forEach((part,i)=>{if(i){const id=crypto.randomUUID(),item=block.items[index++];items.current.set(id,item);fragment.append(gap(id,item.expected||''));}fragment.append(document.createTextNode(part));});node.replaceWith(fragment);});
  range.current=null;setSelection(false);setActive(null);
 },[key]);
 function gap(id:string,word:string){const span=document.createElement('span');span.dataset.gap=id;span.contentEditable='false';span.className='mb-authored-gap';span.textContent=word;span.setAttribute('role','button');span.tabIndex=0;span.setAttribute('aria-label',ui('Gap')+': '+word);return span;}
 function commit(){const el=root.current;if(!el)return;const ordered:Item[]=[];
  el.querySelectorAll<HTMLElement>('[data-gap]').forEach(node=>{const item=items.current.get(node.dataset.gap!);if(item)ordered.push({...item});});
  const content=editableText(el),html=storedHtml(el);signature.current=JSON.stringify([content,ordered,html]);onChange({...block,...formatPatch(block,'content',content,html),content,items:ordered});setSelection(false);setActive(null);
 }
 // Chromium can delete a neighboring non-editable gap together with a line break.
 function safeDelete(event:Event,backward:boolean){const el=root.current,sel=getSelection();if(!el||!sel?.rangeCount)return;const caret=sel.getRangeAt(0);if(!caret.collapsed||!el.contains(caret.startContainer))return;
  const node=caret.startContainer,offset=caret.startOffset;
  if(node.nodeType===Node.TEXT_NODE){const text=node.textContent||'',at=backward?offset-1:offset;if(at>=0&&at<text.length&&/[\r\n]/.test(text[at])){event.preventDefault();const r=caret.cloneRange();r.setStart(node,at);r.setEnd(node,at+1);r.deleteContents();const space=document.createTextNode(' ');r.insertNode(space);r.setStartAfter(space);r.collapse(true);sel.removeAllRanges();sel.addRange(r);commit();return;}}
  let adjacent:Node|null=node,boundary=offset;while(adjacent&&adjacent!==el){if(adjacent.nodeType===3){if(backward?boundary>0:boundary<(adjacent.textContent||'').length)break;}else if(backward?boundary>0:boundary<adjacent.childNodes.length){const child=adjacent.childNodes[backward?boundary-1:boundary];if(child instanceof HTMLBRElement){event.preventDefault();const space=document.createTextNode(' ');child.replaceWith(space);const r=document.createRange();r.setStartAfter(space);r.collapse(true);sel.removeAllRanges();sel.addRange(r);commit();return;}break;}const neighbor=backward?adjacent.previousSibling:adjacent.nextSibling;if(neighbor){if(neighbor instanceof HTMLBRElement){event.preventDefault();const space=document.createTextNode(' ');neighbor.replaceWith(space);const r=document.createRange();r.setStartAfter(space);r.collapse(true);sel.removeAllRanges();sel.addRange(r);commit();return;}break;}const parent:Node|null=adjacent.parentNode;if(!parent)break;boundary=Array.prototype.indexOf.call(parent.childNodes,adjacent)+(backward?0:1);adjacent=parent;}
  let line:HTMLElement|null=node instanceof HTMLElement?node:node.parentElement;while(line&&line!==el&&!['DIV','P','LI','H2','H3'].includes(line.tagName))line=line.parentElement;
  if(line&&line!==el){const edge=caret.cloneRange();edge.selectNodeContents(line);if(backward)edge.setEnd(caret.startContainer,caret.startOffset);else edge.setStart(caret.startContainer,caret.startOffset);if(!edge.toString()&&!edge.cloneContents().querySelector('[data-gap],[data-mec-image]')){const other=backward?line.previousSibling:line.nextSibling;if(other){event.preventDefault();const destination=backward&&other instanceof HTMLElement&&['DIV','P','LI','H2','H3'].includes(other.tagName)?other:line;const join=document.createTextNode(' ');if(backward&&destination===other){destination.append(join,...Array.from(line.childNodes));line.remove();}else if(backward){line.before(join,...Array.from(line.childNodes));line.remove();}else{line.append(join);if(other instanceof HTMLElement&&['DIV','P','LI','H2','H3'].includes(other.tagName)){line.append(...Array.from(other.childNodes));other.remove();}else line.append(other);}const r=document.createRange();r.setStartAfter(join);r.collapse(true);sel.removeAllRanges();sel.addRange(r);commit();return;}}}
  // At a soft-wrap/atomic boundary there is no line break to remove. Keep the gap.
  const original=caret.cloneRange();sel.modify('extend',backward?'backward':'forward','character');const candidate=sel.rangeCount?sel.getRangeAt(0):null;const touches=candidate&&Array.from(el.querySelectorAll('[data-gap],[data-mec-image]')).some(g=>candidate.intersectsNode(g));sel.removeAllRanges();sel.addRange(original);if(touches)event.preventDefault();
 }
 useEffect(()=>{const el=root.current;if(!el)return;const keys=(e:KeyboardEvent)=>{if(e.key==='Backspace'||e.key==='Delete')safeDelete(e,e.key==='Backspace');};const before=(e:InputEvent)=>{if(e.inputType==='deleteContentBackward'||e.inputType==='deleteContentForward')safeDelete(e,e.inputType==='deleteContentBackward');};el.addEventListener('keydown',keys);el.addEventListener('beforeinput',before);return()=>{el.removeEventListener('keydown',keys);el.removeEventListener('beforeinput',before);};});
 function capture(){const sel=window.getSelection();if(!sel||sel.isCollapsed||!sel.rangeCount){setSelection(false);return;}const r=sel.getRangeAt(0),el=root.current;
  if(!el?.contains(r.startContainer)||!el.contains(r.endContainer)||!r.toString().trim()||Array.from(el.querySelectorAll('[data-gap],[data-mec-image]')).some(g=>r.intersectsNode(g))){setSelection(false);return;}
  range.current=r.cloneRange();setActive(null);setSelection(true);
 }
 function format(command:string,value?:string){const el=root.current;if(!el)return;el.focus();const sel=getSelection();if(range.current&&el.contains(range.current.commonAncestorContainer)){sel?.removeAllRanges();sel?.addRange(range.current);}document.execCommand(command,false,value);commit();capture();}
 useEffect(()=>{const changed=()=>capture();document.addEventListener('selectionchange',changed);return()=>document.removeEventListener('selectionchange',changed);},[]);
 function makeGap(){const r=range.current;if(!r||!root.current?.contains(r.commonAncestorContainer))return;const raw=r.toString(),word=raw.trim();if(!word||/_{2,}/.test(word))return;
  const id=crypto.randomUUID();items.current.set(id,{prompt:word,expected:word});r.deleteContents();const fragment=document.createDocumentFragment(),prefix=raw.match(/^\s*/)?.[0]||'',suffix=raw.match(/\s*$/)?.[0]||'';if(prefix)fragment.append(document.createTextNode(prefix));const chip=gap(id,word);fragment.append(chip);if(suffix)fragment.append(document.createTextNode(suffix));r.insertNode(fragment);window.getSelection()?.removeAllRanges();range.current=null;commit();root.current?.focus();
 }
 function remove(id:string){const chip=Array.from(root.current?.querySelectorAll<HTMLElement>('[data-gap]')||[]).find(n=>n.dataset.gap===id),item=items.current.get(id);if(!chip||!item)return;chip.replaceWith(document.createTextNode(item.expected||''));commit();}
 return <div className="mb-gap-author"><div className="mb-gap-surface">
 {!hideFormatting?<FormattingToolbar onFormat={format}><TextImageTools root={root} rangeRef={range} onChange={commit}/></FormattingToolbar>:<div className="mb-text-image-only"><TextImageTools root={root} rangeRef={range} onChange={commit}/></div>}
 {(selection&&range.current||active)&&<SelectionPopup onDismiss={()=>{setSelection(false);setActive(null);}} anchor={selection?range.current!:Array.from(root.current?.querySelectorAll<HTMLElement>('[data-gap]')||[]).find(n=>n.dataset.gap===active)!}><div role="toolbar" aria-label={ui('Text selection actions')}>{selection?<button type="button" className="mb-make-gap" onClick={makeGap}>▧ {ui('Make gap')}</button>:<button type="button" onClick={()=>active&&remove(active)}>{ui('Remove gap')}</button>}</div></SelectionPopup>}
 <div ref={root} className="mb-gap-editable" contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label={ui('Exercise text')} onInput={commit} onMouseUp={capture} onKeyUp={e=>{if(e.key==='Enter'&&(e.target as HTMLElement).dataset.gap){setActive((e.target as HTMLElement).dataset.gap!);return;}capture();}} onClick={e=>{const chip=(e.target as HTMLElement).closest<HTMLElement>('[data-gap]');if(chip){const r=document.createRange();r.selectNode(chip);range.current=r;setActive(chip.dataset.gap!);setSelection(false);}}} onPaste={e=>{e.preventDefault();const sel=window.getSelection();if(!sel?.rangeCount||!root.current?.contains(sel.anchorNode))return;const r=sel.getRangeAt(0);r.deleteContents();const text=document.createTextNode(e.clipboardData.getData('text/plain'));r.insertNode(text);r.setStartAfter(text);r.collapse(true);sel.removeAllRanges();sel.addRange(r);commit();}}/>
 </div><p className="mb-gap-hint">{ui('Select a word or phrase and click Make gap. Click a gap to restore the word.')}</p></div>;
}
