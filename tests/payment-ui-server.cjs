// Isolated browser harness: real modal markup/handlers, synthetic students and
// delayed in-memory API. No production config, credentials, or Telegram calls.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const modal=html.slice(html.indexOf('<div id="student-payment-modal"'),html.indexOf('<div id="student-modal"'));
const page=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Payment local test</title>
<style>body{font:16px system-ui;margin:24px;background:#f6f2fc;color:#241b38}.hidden{display:none!important}button,input,select{font:inherit;padding:10px;border:1px solid #d5c9e7;border-radius:10px;max-width:100%;box-sizing:border-box}button{cursor:pointer;background:#7541b5;color:white}button:disabled{opacity:.6;cursor:wait}input,select{display:block;width:100%;background:white;color:#241b38}label{display:block;margin:16px 0}.modal-bg{position:fixed;inset:0;background:#241b3866;display:flex;align-items:center;justify-content:center;padding:16px}.app-card{background:white;padding:24px;border-radius:24px;width:min(360px,100%)}.flex{display:flex;justify-content:space-between}.w-full{width:100%}#add-form>*{display:grid;gap:12px}.inline-block{display:inline-block}.w-4{width:16px}.h-4{height:16px}.border-2{border:2px solid}.border-t-transparent{border-top-color:transparent}.rounded-full{border-radius:50%}.mr-2{margin-right:8px}.animate-spin{animation:spin .7s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}#status{white-space:pre-wrap}</style>
<h1>Local payment test — synthetic data</h1><p>No production connection. Requests delayed by 2 seconds.</p>
<button onclick="openStudentPayment('student-test')">Student payment</button> <button onclick="openAdd('payment')">Add payment</button>
<p><button onclick="language=language==='en'?'ru':'en'">RU / EN</button></p><pre id="status">Ready</pre>
${modal}<div id="add-modal" class="hidden modal-bg"><div class="app-card"><button onclick="closeModal('add-modal')">Close</button><div id="add-form"></div></div></div>
<script>
let language='en',students=[{id:'student-test',name:'Synthetic student'}],groups=[],headers={},creates=0,attempts=0,notifications=0;
const saved=new Map();
const getLanguage=()=>language,localISO=()=> '2026-11-27',esc=s=>s;
const showError=e=>document.getElementById('status').textContent=e.message;
const showModal=id=>document.getElementById(id).classList.remove('hidden');
const closeModal=id=>document.getElementById(id).classList.add('hidden');
const supabaseClient={auth:{getSession:async()=>({data:{session:{user:{id:'teacher-test'},access_token:'local-only'}}})},functions:{invoke:async()=>{notifications++;return {};}}};
async function db(url,opt){attempts++;await new Promise(r=>setTimeout(r,2000));const key=JSON.parse(opt.body).p_operation_id;if(!saved.has(key)){creates++;saved.set(key,{id:creates});}return saved.get(key);}
async function loadData(){document.getElementById('status').textContent=JSON.stringify({creates,attempts,notifications});}
function renderStudents(){}
function fillStudentSelects(){const p=document.getElementById('add-payment-student');if(p){p.innerHTML='<option value="">Select a student</option><option value="student-test">Synthetic student</option>';document.getElementById('add-payment-submit').disabled=true;}}
</script><script src="/legacy/js/payment-creation.js"></script><script src="/legacy/js/students.js"></script></html>`;
http.createServer((req,res)=>{
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'none'; img-src 'none'; form-action 'none'");
  if(req.url==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(page);}
  if(['/legacy/js/payment-creation.js','/legacy/js/students.js'].includes(req.url)){res.setHeader('Content-Type','text/javascript; charset=utf-8');return res.end(fs.readFileSync(path.join(root,req.url)));}
  res.writeHead(404);res.end();
}).listen(58889,'127.0.0.1',()=>console.log('Isolated payment UI: http://127.0.0.1:58889'));
