import type {Plan} from '../planning/model';
export type Run={text:string;bold?:boolean;italic?:boolean};
export type NoteBlock={kind:'paragraph'|'bullet';runs:Run[]};
export type NoteDocument=NoteBlock[];
export type Accent='UK'|'US'|'unspecified';
export type Pronunciation={id?:string;word:string;ipa:string;accent:Accent;comment:string;source:string;teacherEdited:boolean;audioUrl?:string|null};
export type LiveSession={id:string;teacher_id:string;student_id:string;title:string;lesson_key:string;current_activity:string;state:string;writer_epoch:number};
export type LiveSnapshot={session:LiveSession;notes:{document:NoteDocument;writer_epoch:number;sequence:number};annotations:{activity_id:string;shapes:unknown[]}[];pronunciation:Record<string,unknown>[];privateNote:string;draft:{document:Record<string,string>;revision:number};variant:'UK'|'US';packagePath:string;plan?:Plan;activityIds?:string[];followups?:{block_id:string;disposition:string}[]};
export const escapeHTML=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function documentHTML(doc:NoteDocument){return doc.map(b=>{const content=b.runs.map(r=>{let text=escapeHTML(r.text).replace(/\n/g,'<br>');if(r.bold)text='<strong>'+text+'</strong>';if(r.italic)text='<em>'+text+'</em>';return text;}).join('');return b.kind==='bullet'?'<ul><li>'+content+'</li></ul>':'<p>'+content+'</p>';}).join('');}
export function readDocument(root:HTMLElement):NoteDocument {
 const result:NoteDocument=[];let block:NoteBlock={kind:'paragraph',runs:[]};
 const flush=()=>{if(block.runs.length)result.push(block);block={kind:'paragraph',runs:[]};};
 function walk(node:Node,bold=false,italic=false){if(node.nodeType===Node.TEXT_NODE){if(node.textContent)block.runs.push({text:node.textContent,bold,italic});return;}if(!(node instanceof HTMLElement))return;const tag=node.tagName;if(['SCRIPT','STYLE','IFRAME','IMG'].includes(tag))return;
 const boundary=['P','DIV','LI'].includes(tag);if(boundary){flush();block.kind=tag==='LI'?'bullet':'paragraph';}if(tag==='BR')block.runs.push({text:'\n',bold,italic});else [...node.childNodes].forEach(n=>walk(n,bold||tag==='B'||tag==='STRONG',italic||tag==='I'||tag==='EM'));if(boundary)flush();}
 [...root.childNodes].forEach(n=>walk(n));flush();return result;
}
export const pronunciationFromRow=(r:Record<string,unknown>):Pronunciation=>({id:String(r.id),word:String(r.word),ipa:String(r.ipa),accent:r.accent as Accent,comment:String(r.comment||''),source:String(r.source||'manual'),teacherEdited:!!r.teacher_edited,audioUrl:typeof r.audio_url==='string'?r.audio_url:null});
