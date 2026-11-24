import {blankPlan,isPlan} from '../planning/model';
import type {Plan} from '../planning/model';
import type {VersionRow} from '../planning/api';
import type {LibraryPlan,MaterialSection,MaterialsRepository} from './repository';

type Store={schema:1;sections:MaterialSection[];drafts:LibraryPlan[];versions:VersionRow[]};
const copy=<T,>(x:T):T=>structuredClone(x);
const now=()=>new Date().toISOString();
export function createMockRepository(user:string):MaterialsRepository {
 const key='mec:materials:mock-preview:v1:'+encodeURIComponent(user);
 function seed():Store {
  const folder=(id:string,title:string,parent_id:string|null,position:number):MaterialSection=>({id,title,parent_id,position,teacher_id:user,updated_at:'2026-11-18T12:00:00Z'});
  const sections=[folder('general','General English',null,0),folder('a1','A1 – Beginners','general',0),folder('a2','A2 – Elementary','general',1),folder('b1','B1 – Intermediate','general',2),folder('business','Business English','b1',0),folder('daily','Daily Life','b1',1),folder('b2','B2 – Upper Intermediate','general',3),folder('exam','Exam Preparation',null,1),folder('it','IT English',null,2),folder('speaking','Speaking Practice',null,3),folder('grammar','Grammar',null,4),folder('vocabulary','Vocabulary',null,5),folder('interviews','Job Interviews','business',0),folder('meetings','Meetings & Collaboration','business',1)];
  const titles=['Introducing Yourself in a Meeting','Describing Your Company','Solving Problems at Work','Giving and Receiving Feedback'];
  const drafts=titles.map((title,i):LibraryPlan=>{const body=blankPlan();body.title=title;body.cefr='B1';body.objectives[0].text='Explain an idea clearly.';body.outcomes='Give one clear explanation.';body.blocks=[{id:'sample-text-'+i,stage:body.stages[0].id,title:'Getting started',type:'text',instructions:'Discuss the question.',content:'What helps people communicate clearly at work?',items:[],objectives:[body.objectives[0].id],role:'practice',scope:'lesson',minutes:5}];return{id:'sample-'+i,teacher_id:user,body,section_id:'business',revision:1,updated_at:`2026-11-${20-i*2}T12:00:00Z`};});
  const versions=drafts.filter((_,i)=>i!==1).map((r):VersionRow=>{const body=copy(r.body);body.stages.forEach(s=>s.notes='');body.blocks.forEach(b=>b.items.forEach(i=>delete i.expected));return{id:'version-'+r.id,plan_id:r.id,title:r.body.title,body,published_at:r.updated_at};});
  return {schema:1,sections,drafts,versions};
 }
 function read():Store {
  const raw=localStorage.getItem(key);if(!raw){const initial=seed();write(initial);return initial;}
  const s=JSON.parse(raw) as Store;
  if(s.schema!==1||!Array.isArray(s.sections)||!Array.isArray(s.drafts)||!Array.isArray(s.versions)||!s.drafts.every(r=>r.teacher_id===user&&isPlan(r.body)))throw Error('Local preview data could not be read.');
  return s;
 }
 function write(s:Store){localStorage.setItem(key,JSON.stringify(s));}
 function title(value:string){const t=value.trim();if(!t||t.length>160)throw Error('Enter a title of 1–160 characters.');return t;}
 function destination(s:Store,parent:string|null){if(parent!==null&&!s.sections.some(f=>f.id===parent&&f.teacher_id===user))throw Error('Choose an existing folder.');}
 return {
  recoveryKey:key+':editor-recovery',
  storageKey:key,
  sections:async()=>copy(read().sections),
  library:async()=>{const s=read();return {drafts:copy(s.drafts),versions:copy(s.versions)};},
  async createFolder(value,parent){const s=read();destination(s,parent);s.sections.push({id:crypto.randomUUID(),teacher_id:user,parent_id:parent,title:title(value),position:s.sections.length,updated_at:now()});write(s);},
  async renameFolder(id,value){const s=read(),f=s.sections.find(f=>f.id===id);if(!f)throw Error('Folder not found.');f.title=title(value);f.updated_at=now();write(s);},
  async moveFolder(id,parent){const s=read(),f=s.sections.find(f=>f.id===id);if(!f)throw Error('Folder not found.');destination(s,parent);let cursor=parent;const seen=new Set<string>([id]);while(cursor){if(seen.has(cursor))throw Error('A folder cannot be moved inside itself.');seen.add(cursor);cursor=s.sections.find(x=>x.id===cursor)?.parent_id??null;}f.parent_id=parent;f.updated_at=now();write(s);},
  async deleteMaterial(id){const s=read();s.drafts=s.drafts.filter(r=>r.id!==id);s.versions=s.versions.filter(v=>v.plan_id!==id);write(s);},
  async moveMaterial(id,parent){const s=read();destination(s,parent);const r=s.drafts.find(r=>r.id===id);if(!r)throw Error('Material not found.');r.section_id=parent;r.updated_at=now();write(s);},
  async createDraft(value,parent){const s=read();destination(s,parent);const body=blankPlan();body.title=title(value);const row:LibraryPlan={id:crypto.randomUUID(),teacher_id:user,section_id:parent,body,revision:1,updated_at:now()};s.drafts.push(row);write(s);return copy(row);},
  async savePlan(id,body:Plan,revision){const save=()=>{if(!isPlan(body))throw Error('Invalid material.');const s=read();let r=s.drafts.find(r=>r.id===id);if(id&&!r)throw Error('Material not found.');if(r&&r.revision!==revision)throw Error('This local draft changed in another tab. Reopen it before saving.');if(!r){r={id:crypto.randomUUID(),teacher_id:user,section_id:null,body:copy(body),revision:0,updated_at:now()};s.drafts.push(r);}r.body=copy(body);r.revision++;r.updated_at=now();write(s);return copy(r);};return globalThis.navigator?.locks?globalThis.navigator.locks.request(key+':draft-write',save):save();}
 };
}
