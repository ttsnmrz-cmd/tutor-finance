import {supabase} from '../supabase';
import type {Plan} from './model';
export type PlanRow={id:string;teacher_id:string;body:Plan;revision:number;updated_at:string};
export type VersionRow={id:string;plan_id:string;title:string;body:Plan;published_at:string};
const client=()=>{if(!supabase)throw Error('Sign in required');return supabase;};
export async function library(){const [a,b]=await Promise.all([client().from('teaching_lesson_plans').select('*').order('updated_at',{ascending:false}),client().from('teaching_lesson_versions').select('*').order('published_at',{ascending:false})]);if(a.error||b.error)throw Error('Lesson Studio needs its database update. Existing lessons still work.');return{drafts:a.data as PlanRow[],versions:b.data as VersionRow[]};}
export async function savePlan(id:string|null,body:Plan,revision:number){const {data,error}=await client().rpc('save_teaching_plan',{p_id:id,p_body:body,p_revision:revision});if(error)throw Error('Could not save. The connection or another editor may have changed. Keep your local draft.');return data as PlanRow;}
export async function publishPlan(id:string,revision:number){const {data,error}=await client().rpc('publish_teaching_plan',{p_id:id,p_revision:revision});if(error)throw Error(error.message);return data as VersionRow;}
export async function createSession(student:string,version:string){const {data,error}=await client().rpc('create_planned_live_session',{p_student:student,p_version:version});if(error)throw Error('Could not start this lesson. Check student access and the database update.');return data as string;}
