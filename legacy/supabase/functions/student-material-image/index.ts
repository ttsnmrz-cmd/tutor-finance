import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
function containsPath(value:unknown,path:string):boolean{
 if(Array.isArray(value))return value.some(v=>containsPath(v,path));
 if(value&&typeof value==='object'){const obj=value as Record<string,unknown>;return obj.storagePath===path||Object.values(obj).some(v=>containsPath(v,path));}
 return false;
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
 const {studentId,lessonId,assignmentId,path}=await req.json();
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 if(typeof studentId!=='string'||!uuid.test(studentId)||typeof path!=='string'||!/^([0-9a-f-]{36})\/([0-9a-f-]{36})\.(png|jpg|webp|gif|avif)$/i.test(path))return json({error:'Invalid request'},400);
 const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 const homework=typeof assignmentId==='string'&&uuid.test(assignmentId);
 if(!homework&&(!Number.isSafeInteger(lessonId)||lessonId<=0))return json({error:'Invalid lesson'},400);
 const {data,error}=homework?await client.rpc('get_public_student_homework_material',{p_student_id:studentId,p_assignment_id:assignmentId}):await client.rpc('get_public_student_lesson_material',{p_student_id:studentId,p_calendar_lesson_id:lessonId});
 if(error||!data?.plan||!containsPath(data.plan.blocks,path))return json({error:'Image unavailable'},403);
 const signed=await client.storage.from('classroom-images').createSignedUrl(path,3600);
 if(signed.error||!signed.data?.signedUrl)return json({error:'Image unavailable'},404);
 return json({signedUrl:signed.data.signedUrl});
 }catch{return json({error:'Unable to open image'},500);}
});
