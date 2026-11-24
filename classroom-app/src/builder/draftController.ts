import {isPlan} from '../planning/model';
import type {Plan} from '../planning/model';
import type {PlanRow} from '../planning/api';
import type {StudioRepository} from '../materials/repository';

export type DraftState={body:Plan;revision:number;status:'saved'|'pending'|'saving'|'error';error:string;savedAt:string;recovered:boolean;conflict:boolean};
type Recovery={schema:1;id:string;baseRevision:number;body:Plan;at:string};
/** One writer queue per open draft; no network dependency. */
export class DraftController{
 readonly recoveryKey:string;
 private state:DraftState;
 private listeners=new Set<()=>void>();
 private sequence=0;private savedSequence=0;private timer:ReturnType<typeof setTimeout>|undefined;
 private flight:Promise<boolean>|null=null;private recoverySafe=true;
 constructor(readonly row:PlanRow,private repository:StudioRepository,private storage:Storage=localStorage,private delay=600){
  this.recoveryKey=repository.recoveryKey+':builder:'+row.id;
  this.state={body:structuredClone(row.body),revision:row.revision,status:'saved',error:'',savedAt:row.updated_at,recovered:false,conflict:false};
  try{const raw=this.storage.getItem(this.recoveryKey);if(raw){const r=JSON.parse(raw) as Recovery;if(r.schema!==1||r.id!==row.id||!isPlan(r.body))throw Error('Invalid recovery copy.');
   if(JSON.stringify(r.body)!==JSON.stringify(row.body)){this.state.body=r.body;this.state.revision=r.baseRevision;this.sequence=1;this.state.recovered=true;
    if(r.baseRevision!==row.revision){this.state.status='error';this.state.conflict=true;this.state.error='The saved revision has changed. Your recovery copy is kept.';}
    else this.state.status='pending';
   }
  }}catch{this.state.status='error';this.state.error='Recovery could not be read. The saved draft is unchanged.';}
 }
 snapshot=()=>this.state;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 private notify(patch:Partial<DraftState>={}){this.state={...this.state,...patch};for(const l of this.listeners)l();}
 private recover(){try{const r:Recovery={schema:1,id:this.row.id,baseRevision:this.state.revision,body:this.state.body,at:new Date().toISOString()};this.storage.setItem(this.recoveryKey,JSON.stringify(r));this.recoverySafe=true;return true;}catch{this.recoverySafe=false;return false;}}
 update(body:Plan){this.sequence++;this.state={...this.state,body:structuredClone(body)};const safe=this.recover();this.notify({status:this.state.conflict?'error':'pending',error:this.state.conflict?this.state.error:safe?'':'Recovery storage is unavailable. Keep this page open.'});
  clearTimeout(this.timer);
 }
 get dirty(){return this.sequence!==this.savedSequence;}
 get hasRecovery(){return this.recoverySafe;}
 checkpoint=()=>{if(this.dirty)this.recover();};
 async flush():Promise<boolean>{
  clearTimeout(this.timer);
  if(this.flight)return this.flight;
  if(this.state.conflict)return false;
  if(!this.dirty)return this.state.status!=='error';
  this.flight=this.drain();try{return await this.flight;}finally{this.flight=null;}
 }
 private async drain(){
  try{
   while(this.dirty){
    if(!this.state.body.title.trim())throw Error('Enter a material title before saving.');
    const sequence=this.sequence,body=structuredClone(this.state.body),revision=this.state.revision;
    this.notify({status:'saving',error:''});
    const saved=await this.repository.savePlan(this.row.id,body,revision);
    this.savedSequence=sequence;this.notify({revision:saved.revision,savedAt:saved.updated_at});
    // New typing during a save is rebased to the returned revision, never overwritten.
    if(this.dirty)this.recover();
    else{try{this.storage.removeItem(this.recoveryKey);}catch{}this.recoverySafe=true;}
   }
   this.notify({status:'saved',error:'',recovered:false});return true;
  }catch(e){let conflict=false;try{const rows=await this.repository.library();const current=rows.drafts.find(r=>r.id===this.row.id);conflict=!current||current.revision!==this.state.revision;}catch{}
   this.recover();this.notify({status:'error',error:conflict?'The saved revision has changed. Your recovery copy is kept.':(e as Error).message,conflict});return false;
  }
 }
 async refreshExternal(){
  try{const data=await this.repository.library(),r=data.drafts.find(r=>r.id===this.row.id);if(!r)throw Error('The saved draft is no longer available.');
   if(r.revision!==this.state.revision){if(this.dirty){this.recover();this.notify({status:'error',error:'The saved revision has changed. Your recovery copy is kept.',conflict:true});}
    else this.notify({body:structuredClone(r.body),revision:r.revision,savedAt:r.updated_at,status:'saved'});}
  }catch(e){this.notify({status:'error',error:(e as Error).message});}
 }
 async reloadSaved(){
  const data=await this.repository.library(),r=data.drafts.find(r=>r.id===this.row.id);if(!r)throw Error('The saved draft is no longer available.');
  // Keep the user's explicit discarded/replaced recovery as an exportable local archive.
  if(this.dirty){this.storage.setItem(this.recoveryKey+':previous:'+crypto.randomUUID(),JSON.stringify({body:this.state.body,baseRevision:this.state.revision}));}
  clearTimeout(this.timer);this.sequence=0;this.savedSequence=0;this.storage.removeItem(this.recoveryKey);
  this.notify({body:structuredClone(r.body),revision:r.revision,savedAt:r.updated_at,status:'saved',error:'',conflict:false,recovered:false});
 }
 dispose(){clearTimeout(this.timer);this.checkpoint();this.listeners.clear();}
}
