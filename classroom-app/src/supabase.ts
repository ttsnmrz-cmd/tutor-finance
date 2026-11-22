import type {SupabaseClient} from '@supabase/supabase-js';
let sharedClient:SupabaseClient|null=null;
export function setProfiProfitSupabase(client:SupabaseClient){sharedClient=client;}
export const supabase=new Proxy({} as SupabaseClient,{get(_target,key){if(!sharedClient)throw Error('ProfiProfit session is not connected');const value=Reflect.get(sharedClient,key);return typeof value==='function'?value.bind(sharedClient):value;}});
export const callbackUrl=()=>new URL('./',location.origin).href;
export const localMaterialsPreview=false;
