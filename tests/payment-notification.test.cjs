const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const original=fs.readFileSync(path.join(__dirname,'../legacy/supabase/functions/notify-payment/index.ts'),'utf8');
const code=stripTypeScriptTypes(original.replace(/^import .*createClient.*;\r?\n/m,''));
function setup({timeout=false,studentAlso=false,claims=new Map(),claimUnavailable=false}={}){
  let handler,sendCalls=0;
  const db={from(table){
    let payload,mode='select';
    const query={
      select(){return query;},eq(){return query;},
      insert(row){payload=row;mode='insert';return query;},
      update(row){payload=row;mode='update';return query;},
      delete(){throw Error('A delivery claim must never be released automatically');},
      async maybeSingle(){
        if(table==='payments')return {data:{id:42,student_id:'student-test',student:'Synthetic',amount:40,teacher_id:'teacher-test'}};
        if(table==='students')return {data:{id:'student-test',name:'Synthetic',price:40,telegram_chat_id:studentAlso?'student-chat':null,telegram_notify_payments:studentAlso}};
        if(table==='profiles')return {data:{telegram_chat_id:'teacher-chat'}};
        assert.equal(table,'telegram_payment_notifications');
        if(claimUnavailable)return {error:{code:'08006'}};
        const key=payload.payment_id+':'+payload.recipient_type;
        if(claims.has(key))return {error:{code:'23505'}};
        const row={id:key,...payload};claims.set(key,row);return {data:row};
      },
      then(resolve,reject){
        if(mode==='update'){
          // Delivery-status bookkeeping is not the lock; the existing unique
          // claim is retained even if this request fails.
          return Promise.resolve({error:{code:'test-unavailable'}}).then(resolve,reject);
        }
        return Promise.resolve({data:table==='payments'?[{amount:40}]:[]}).then(resolve,reject);
      }
    };return query;
  }};
  const ctx=vm.createContext({Request,Response,Map,Intl,Date,console:{error(){}},
    Deno:{env:{get:()=> 'local-test-only'},serve:fn=>handler=fn},
    createClient:(url,key,opts)=>opts.global?{auth:{getUser:async()=>({data:{user:{id:'teacher-test'}}})}}:db,
    fetch:async(url,opts)=>{
      assert.match(url,/^https:\/\/api\.telegram\.org\/botlocal-test-only\/sendMessage$/);
      sendCalls++;
      await new Promise(r=>setTimeout(r,10));
      if(timeout)throw Error('Response lost after provider accepted message');
      return Response.json({ok:true});
    }
  });
  vm.runInContext(code,ctx);
  return {claims,get sends(){return sendCalls;},async invoke(){return handler(new Request('http://local-test/functions/v1/notify-payment',{method:'POST',headers:{Authorization:'Bearer local-test','Content-Type':'application/json'},body:JSON.stringify({payment_id:'42'})}));}};
}
test('20 concurrent function calls send once to each intended recipient',async()=>{
  const t=setup({studentAlso:true});
  const responses=await Promise.all(Array.from({length:20},()=>t.invoke()));
  assert.ok(responses.every(r=>r.status===200));assert.equal(t.sends,2);assert.equal(t.claims.size,2);
  await t.invoke();assert.equal(t.sends,2);
});
test('ambiguous Telegram timeout retains claim across handler restart/retry',async()=>{
  const t=setup({timeout:true});const response=await t.invoke();
  assert.match(JSON.stringify(await response.json()),/delivery_unconfirmed:teacher/);
  assert.equal(t.sends,1);assert.equal(t.claims.size,1);
  const restarted=setup({claims:t.claims});await restarted.invoke();assert.equal(restarted.sends,0);
});
test('claim-store failure fails closed without sending',async()=>{
  const t=setup({claimUnavailable:true});const response=await t.invoke();
  assert.match(JSON.stringify(await response.json()),/claim:teacher/);assert.equal(t.sends,0);
});
test('historical notification claims prevent automatic replay',async()=>{
  const claims=new Map([['42:teacher',{id:'legacy',delivery_status:'legacy_claimed'}]]);
  const t=setup({claims});await t.invoke();assert.equal(t.sends,0);
});
