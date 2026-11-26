import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = {"Access-Control-Allow-Origin":"https://profiprofit.com","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"};
const reply = (body: unknown, status=200) => new Response(JSON.stringify(body), {status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async req => {
  if(req.method==="OPTIONS") return new Response(null,{headers:cors});
  if(req.method!=="POST") return reply({error:"Method not allowed"},405);
  const auth=req.headers.get("Authorization");
  if(!auth) return reply({error:"Unauthorized"},401);
  const client=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:auth}}});
  const {data,error}=await client.auth.getUser();
  if(error||!data.user) return reply({error:"Unauthorized"},401);
  const key=Deno.env.get("GIPHY_API_KEY");
  if(!key) return reply({error:"GIPHY is not configured"},503);
  try {
    const body=await req.json();
    const q=typeof body.q==="string"?body.q.trim().slice(0,100):"";
    const offset=Math.max(0,Math.min(500,Math.floor(Number(body.offset)||0)));
    const url=new URL("https://api.giphy.com/v1/stickers/"+(q?"search":"trending"));
    url.search=new URLSearchParams({api_key:key,rating:"g",limit:"24",offset:String(offset),...(q?{q}:{})}).toString();
    const response=await fetch(url,{signal:AbortSignal.timeout(10000)});
    if(!response.ok) return reply({error:"GIPHY request failed"},response.status===429?429:502);
    const result=await response.json();
    return reply({data:result.data,pagination:result.pagination});
  } catch {return reply({error:"Sticker search failed"},502);}
});
