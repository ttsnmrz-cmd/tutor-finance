const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const root=path.join(__dirname,'..');
const studentSource=fs.readFileSync(path.join(root,'legacy/js/students.js'),'utf8');
const source=fs.readFileSync(path.join(root,'legacy/js/payment-creation.js'),'utf8');
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function setup(options={}){
  const storage=options.storage||new Map(), server=options.server||new Map();
  const errors=[], requests=[], notifications=[];
  const elements=new Map();
  function el(id){
    if(!elements.has(id))elements.set(id,{value:'',textContent:'',innerHTML:'Save',disabled:false,dataset:{},attrs:{},
      setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},classList:{remove(){}}});
    return elements.get(id);
  }
  for(const prefix of ['add-payment','student-payment']){
    el(prefix+'-amount').value='40';el(prefix+'-date').value='2026-11-27';
  }
  el('student-payment-id').value='student-1';el('add-payment-student').value='student-1';
  const ctx=vm.createContext({console:{warn(){}},crypto:{randomUUID},getLanguage:()=>options.language||'en',
    students:[{id:'student-1',name:'Test student'}],headers:{},
    document:{getElementById:el,querySelector:()=>el('student-save')},
    sessionStorage:{getItem:k=>storage.get(k)||null,setItem(k,v){if(options.storageFails)throw Error('blocked');storage.set(k,v);},removeItem:k=>storage.delete(k)},
    supabaseClient:{auth:{async getSession(){if(options.authGate)await options.authGate.promise;return {data:{session:{user:{id:'teacher-1'},access_token:'LOCAL_TEST_TOKEN'}}};}},functions:{async invoke(name,body){notifications.push(body);if(options.notificationFails)throw Error('unavailable');return {};}}},
    async db(url,opt){
      assert.equal(url,'/rpc/create_payment_once');requests.push(JSON.parse(opt.body));
      if(options.networkGate)await options.networkGate.promise;
      if(options.databaseError)throw new Error(JSON.stringify({code:options.databaseError}));
      const payload=requests.at(-1);
      if(!server.has(payload.p_operation_id))server.set(payload.p_operation_id,{id:server.size+1});
      if(options.loseFirstResponse&&requests.length===1)throw Error('connection reset after commit');
      return server.get(payload.p_operation_id);
    },
    closeModal(){if(options.closeFails)throw Error('UI close failed');},
    async loadData(){if(options.refreshFails)throw Error('UI refresh failed');},renderStudents(){},
    showError:e=>errors.push(e.message)
  });
  vm.runInContext(source,ctx);
  // Execute the real entry points, not a copy of their implementation.
  vm.runInContext(studentSource.slice(studentSource.indexOf('async function saveStudentPayment(){'),studentSource.indexOf('function switchStudentSettingsTab')),ctx);
  return {ctx,el,errors,requests,notifications,server,storage};
}
for(const [kind,handler] of [['student','saveStudentPayment'],['add','addPayment']]){
  test(kind+': rapid clicks/Enter are guarded before awaiting Auth',async()=>{
    const authGate=deferred(),t=setup({authGate});
    const first=t.ctx[handler]();
    const button=t.el(kind==='add'?'add-payment-submit':'student-save');
    assert.equal(button.disabled,true);assert.equal(button.attrs['aria-busy'],'true');assert.match(button.innerHTML,/Saving/);
    await Promise.all(Array.from({length:30},()=>t.ctx[handler]()));
    assert.equal(t.requests.length,0);authGate.resolve();await first;
    assert.equal(t.requests.length,1);assert.equal(t.server.size,1);assert.equal(t.notifications.length,1);
  });
  test(kind+': slow connection keeps button busy and ignores repeated activation',async()=>{
    const networkGate=deferred(),t=setup({networkGate});const first=t.ctx[handler]();
    await new Promise(r=>setImmediate(r));
    await t.ctx[handler]();assert.equal(t.requests.length,1);
    assert.equal(t.el(kind==='add'?'add-payment-submit':'student-save').disabled,true);
    networkGate.resolve();await first;assert.equal(t.server.size,1);
  });
  test(kind+': lost response and reload reuse the persisted UUID',async()=>{
    const first=setup({loseFirstResponse:true});await first.ctx[handler]();
    assert.equal(first.server.size,1);assert.equal(first.storage.size,1);
    const second=setup({storage:first.storage,server:first.server});await second.ctx[handler]();
    assert.equal(second.requests[0].p_operation_id,first.requests[0].p_operation_id);
    assert.equal(second.server.size,1);assert.equal(second.storage.size,0);
  });
  test(kind+': rendering failure after commit cannot save again',async()=>{
    const t=setup({refreshFails:true});await t.ctx[handler]();await t.ctx[handler]();
    assert.equal(t.requests.length,1);assert.match(t.errors[0],/Payment saved/);
  });
  test(kind+': new explicit form permits an identical intentional payment',async()=>{
    const t=setup();await t.ctx[handler]();t.ctx.beginPaymentForm(kind);await t.ctx[handler]();
    assert.equal(t.server.size,2);assert.notEqual(t.requests[0].p_operation_id,t.requests[1].p_operation_id);
  });
  test(kind+': edited unresolved details restore the original operation',async()=>{
    const t=setup({loseFirstResponse:true});await t.ctx[handler]();
    t.el((kind==='add'?'add':'student')+'-payment-amount').value='80';
    await t.ctx[handler]();assert.equal(t.requests.length,1);
    assert.equal(t.el((kind==='add'?'add':'student')+'-payment-amount').value,'40');
    await t.ctx[handler]();assert.equal(t.requests.length,2);assert.equal(t.server.size,1);
  });
}
test('storage unavailable fails closed without a POST',async()=>{
  const t=setup({storageFails:true});await t.ctx.saveStudentPayment();assert.equal(t.requests.length,0);
});
test('both entry points share an in-flight guard',async()=>{
  const authGate=deferred(),t=setup({authGate});const first=t.ctx.saveStudentPayment();
  await t.ctx.addPayment();assert.equal(t.ctx.beginPaymentForm('add'),false);
  authGate.resolve();await first;assert.equal(t.requests.length,1);
});
test('a field change during saving keeps spinner, disabled state and original label',async()=>{
  const authGate=deferred(),t=setup({authGate});const first=t.ctx.addPayment();
  t.ctx.paymentBusy('add',false);assert.equal(t.el('add-payment-submit').attrs['aria-busy'],'true');
  authGate.resolve();await first;assert.equal(t.el('add-payment-submit').innerHTML,'Save');
});
test('definitive SQL rejection releases key for correction; key conflict does not',async()=>{
  const rejected=setup({databaseError:'22003'});await rejected.ctx.addPayment();assert.equal(rejected.storage.size,0);
  const conflict=setup({databaseError:'22023'});await conflict.ctx.addPayment();assert.equal(conflict.storage.size,1);
});
test('notification and modal failures cannot change a committed payment',async()=>{
  const t=setup({notificationFails:true,closeFails:true});await t.ctx.saveStudentPayment();await t.ctx.saveStudentPayment();
  assert.equal(t.server.size,1);assert.equal(t.requests.length,1);assert.match(t.errors[0],/Payment saved/);
});
test('RU pending label and invalid input release the form without POST',async()=>{
  const t=setup({language:'ru'});t.el('student-payment-amount').value='Infinity';await t.ctx.saveStudentPayment();
  assert.equal(t.requests.length,0);assert.equal(t.el('student-save').disabled,false);assert.match(t.errors[0],/сумму/);
});
test('all HTML entry points load helper before students/app, with updated cache URLs',()=>{
  for(const name of ['index.html','404.html','legacy/index.html','legacy/404.html','legacy/classroom.html']){
    const html=fs.readFileSync(path.join(root,name),'utf8');
    assert.ok(html.indexOf('js/payment-creation.js?')<html.indexOf('js/students.js?'));
    assert.match(html,/js\/app\.js\?v=20261127-payment-idempotency/);
  }
  assert.ok(!studentSource.includes("const createdPayments=await db("));
});
