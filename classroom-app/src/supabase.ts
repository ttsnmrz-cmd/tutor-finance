import type {SupabaseClient} from '@supabase/supabase-js';

// The host ProfiProfit page owns authentication and refresh tokens.
// Never instantiate a second client against the legacy Classroom project.
declare global {interface Window {profiProfitMaterialsClient?:SupabaseClient}}
export const supabase=typeof window!=='undefined'?(window.profiProfitMaterialsClient??null):null;
export const callbackUrl=()=>new URL('./',location.origin).href;
export const localMaterialsPreview=false;
