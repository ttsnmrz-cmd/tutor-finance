import {supabase} from '../supabase';
import {blankPlan,isPlan} from '../planning/model';
import type {Plan} from '../planning/model';
import type {MaterialsRepository,MaterialSection,LibraryPlan} from './repository';
import type {VersionRow} from '../planning/api';

export function createProductionRepository(user:string):MaterialsRepository {
 const client=()=>{if(!supabase)throw Error('Supabase is not configured.');return supabase;};
 const check=async()=>{const {data,error}=await client().auth.getUser();if(error||data.user?.id!==user)throw Error('Please sign in to ProfiProfit.');};
 const fail=(error:{message:string}|null)=>{if(error)throw Error(error.message);};
 const destination=async(parent:string|null)=>{if(!parent)return;const {data,error}=await client().from('material_sections').select('id').eq('teacher_id',user).eq('id',parent).maybeSingle();fail(error);if(!data)throw Error('Folder not found.');};
 return {
  recoveryKey:'profiprofit:builder:recovery:'+user,
  async sections(){await check();const {data,error}=await client().from('material_sections').select('id,teacher_id,parent_id,title,position,updated_at').eq('teacher_id',user).order('position');fail(error);return (data||[]) as MaterialSection[];},
  async library(){await check();const [a,b]=await Promise.all([client().from('teaching_lesson_plans').select('id,teacher_id,section_id,body,revision,updated_at').eq('teacher_id',user).order('updated_at',{ascending:false}),client().from('teaching_lesson_versions').select('id,plan_id,title,body,published_at').eq('teacher_id',user).order('published_at',{ascending:false})]);fail(a.error);fail(b.error);return {drafts:(a.data||[]) as LibraryPlan[],versions:(b.data||[]) as VersionRow[]};},
  async createFolder(title,parent){await check();await destination(parent);const {error}=await client().from('material_sections').insert({teacher_id:user,title:title.trim(),parent_id:parent,position:0});fail(error);},
  async renameFolder(id,title){await check();const {data,error}=await client().from('material_sections').update({title:title.trim()}).eq('teacher_id',user).eq('id',id).select('id').maybeSingle();fail(error);if(!data)throw Error('Folder not found.');},
  async moveFolder(id,parent){await check();await destination(parent);const {data:sectionRows,error:sectionError}=await client().from('material_sections').select('id,parent_id').eq('teacher_id',user);fail(sectionError);const sections=sectionRows||[];let cursor=parent;const seen=new Set([id]);while(cursor){if(seen.has(cursor))throw Error('Cannot move folder inside itself.');seen.add(cursor);cursor=sections.find(x=>x.id===cursor)?.parent_id||null;}const {data,error}=await client().from('material_sections').update({parent_id:parent}).eq('teacher_id',user).eq('id',id).select('id').maybeSingle();fail(error);if(!data)throw Error('Folder not found.');},
  async moveMaterial(id,parent){await check();await destination(parent);const {data,error}=await client().from('teaching_lesson_plans').update({section_id:parent}).eq('teacher_id',user).eq('id',id).select('id').maybeSingle();fail(error);if(!data)throw Error('Material not found.');},
  async createDraft(title,parent){await check();await destination(parent);const body=blankPlan();body.title=title.trim();const {data,error}=await client().from('teaching_lesson_plans').insert({teacher_id:user,section_id:parent,body,revision:1}).select('id,teacher_id,section_id,body,revision,updated_at').single();fail(error);return data as LibraryPlan;},
  async publishPlan(id,revision){await check();const {data:plan,error:planError}=await client().from('teaching_lesson_plans').select('id,body,revision').eq('teacher_id',user).eq('id',id).single();fail(planError);if(plan.revision!==revision)throw Error('The lesson has changed; refresh before publishing.');const {data,error}=await client().from('teaching_lesson_versions').insert({teacher_id:user,plan_id:id,title:plan.body.title,body:plan.body}).select('id,plan_id,title,body,published_at').single();fail(error);return data as VersionRow;},
  async savePlan(id,body:Plan,revision){await check();if(!isPlan(body))throw Error('Invalid lesson structure.');if(!id)throw Error('Create a material first.');const {data,error}=await client().from('teaching_lesson_plans').update({body,revision:revision+1,updated_at:new Date().toISOString()}).eq('teacher_id',user).eq('id',id).eq('revision',revision).select('id,teacher_id,body,revision,updated_at').maybeSingle();fail(error);if(!data)throw Error('This material was changed in another tab. Your local draft is preserved.');return data;},
 };
}
