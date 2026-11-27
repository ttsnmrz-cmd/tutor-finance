// Real PostgreSQL integration, isolated NEW database, synthetic rows only.
// Requires the stopped/isolated DR database container to be started with cron OFF.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync,spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const docker=process.env.PP_TEST_DOCKER||'C:/Users/ttsnm/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe';
const container=process.env.PP_TEST_CONTAINER||'supabase_db_ppdr-20261127-154920';
const database='pp_payment_test_'+Date.now();
const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002';
const S='20000000-0000-4000-8000-000000000001',OTHER='20000000-0000-4000-8000-000000000002';
const OP='30000000-0000-4000-8000-000000000001';
function args(db){return ['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d',db];}
function sql(query,db=database){
  const result=spawnSync(docker,args(db),{input:query,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);return result.stdout.trim();
}
function concurrent(query){return new Promise((resolve,reject)=>{
  const p=spawn(docker,args(database));let out='',err='';p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);
  p.on('error',reject);p.on('close',code=>code===0?resolve(out.trim()):reject(Error(err)));p.stdin.end(query);
});}
const auth=(teacher=A)=>`SET ROLE authenticated; SET request.jwt.claim.sub='${teacher}';`;
const call=(op=OP,student=S,amount='40')=>`public.create_payment_once('${op}','${student}',${amount},'2026-11-27')`;

test('PostgreSQL migration, isolation, concurrency and unchanged historical rows',async()=>{
  assert.equal(sql('SHOW cron.launch_active_jobs;','postgres'),'off');
  assert.equal(sql('SELECT count(*) FROM cron.job WHERE active;','postgres'),'0');
  const network=spawnSync(docker,['inspect',container,'--format','{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}'],{encoding:'utf8'});
  assert.equal(network.stdout.trim(),'ppdr-20261127-154920-internal');
  sql(`CREATE DATABASE ${database};`,'postgres');
  sql(`CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    GRANT USAGE ON SCHEMA auth,public TO authenticated;
    CREATE TABLE public.students(id uuid PRIMARY KEY,name text,teacher_id uuid NOT NULL);
    CREATE TABLE public.payments(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,student text,date date,amount numeric(10,2),teacher_id uuid,note text,student_id uuid REFERENCES public.students(id));
    INSERT INTO students VALUES('${S}','Synthetic A','${A}'),('${OTHER}','Synthetic B','${B}');
    INSERT INTO payments(student,date,amount,teacher_id,note,student_id) VALUES('Historical sentinel','2020-01-01',17.50,'${A}','Do not change','${S}');
    ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
    CREATE POLICY payments_teacher_all ON payments FOR ALL TO authenticated USING((SELECT auth.uid())=teacher_id) WITH CHECK((SELECT auth.uid())=teacher_id);
    ALTER TABLE students ENABLE ROW LEVEL SECURITY;
    CREATE POLICY students_teacher_all ON students FOR ALL TO authenticated USING((SELECT auth.uid())=teacher_id) WITH CHECK((SELECT auth.uid())=teacher_id);
    GRANT SELECT,INSERT,UPDATE,DELETE ON payments,students TO authenticated;
    GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
    ${fs.readFileSync(path.join(__dirname,'../legacy/supabase/migrations/021_telegram_payment_notifications.sql'),'utf8')}
    INSERT INTO telegram_payment_notifications(payment_id,student_id,teacher_id,recipient_type) VALUES('1','${S}','${A}','teacher');`);
  const history=sql("SELECT row_to_json(p)::text FROM payments p WHERE id=1;");
  const migration=fs.readFileSync(path.join(__dirname,'../legacy/supabase/migrations/20261127_payment_idempotency.sql'),'utf8');
  sql(migration);
  const historyAfter=JSON.parse(sql('SELECT row_to_json(p)::text FROM payments p WHERE id=1;'));
  assert.equal(historyAfter.operation_id,null);delete historyAfter.operation_id;
  assert.deepEqual(historyAfter,JSON.parse(history));
  assert.equal(sql("SELECT delivery_status FROM telegram_payment_notifications WHERE payment_id='1';"),'legacy_claimed');
  const results=await Promise.all(Array.from({length:12},()=>concurrent(`BEGIN;${auth()} SELECT (${call()}).id;SELECT pg_sleep(0.08);COMMIT;`)));
  const ids=results.map(r=>r.split('\n')[0]);assert.equal(new Set(ids).size,1);
  assert.equal(sql(`SELECT count(*) FROM payments WHERE operation_id='${OP}';`),'1');
  const retry=sql(`${auth()}SELECT (${call()}).id;`);assert.equal(retry,ids[0]);
  const second=sql(`${auth()}SELECT (${call('30000000-0000-4000-8000-000000000002')}).id;`);
  assert.notEqual(second,ids[0]);
  assert.equal(sql(`SELECT count(*) FROM payments WHERE amount=40 AND student_id='${S}';`),'2');
  sql(`${auth()}DO $$ BEGIN
    BEGIN PERFORM ${call(OP,S,'80')};RAISE EXCEPTION 'Expected changed-payload rejection';EXCEPTION WHEN invalid_parameter_value THEN NULL;END;
    BEGIN PERFORM ${call(OP,OTHER)};RAISE EXCEPTION 'Expected foreign student rejection';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
    BEGIN PERFORM public.create_payment_once(NULL,'${S}',40,'2026-11-27');RAISE EXCEPTION 'Expected missing key rejection';EXCEPTION WHEN invalid_parameter_value THEN NULL;END;
  END $$;`);
  sql(`${auth(B)}DO $$ BEGIN
    BEGIN PERFORM ${call(OP,OTHER)};RAISE EXCEPTION 'Expected foreign key rejection';EXCEPTION WHEN invalid_parameter_value THEN NULL;END;
  END $$;`);
  assert.equal(sql(`${auth(B)}SELECT count(*) FROM payments;`),'0');
  assert.equal(sql("SELECT has_function_privilege('anon','public.create_payment_once(uuid,uuid,numeric,date)','EXECUTE');"),'f');
  assert.equal(sql("SELECT has_function_privilege('authenticated','public.create_payment_once(uuid,uuid,numeric,date)','EXECUTE');"),'t');
  // Default supports old callers, with no new constraints on equal date/amount.
  sql(`${auth()}INSERT INTO payments(student,student_id,amount,date,teacher_id) VALUES('Synthetic A','${S}',40,'2026-11-27','${A}');`);
  assert.equal(sql('SELECT count(*) FROM payments WHERE operation_id IS NOT NULL;'),'3');
  // Persisted unique claim wins even across concurrent independent SQL sessions.
  const claims=await Promise.all(Array.from({length:12},()=>concurrent(`INSERT INTO telegram_payment_notifications(payment_id,student_id,teacher_id,recipient_type,delivery_status) VALUES('${ids[0]}','${S}','${A}','teacher','claimed') ON CONFLICT ON CONSTRAINT telegram_payment_notifications_once DO NOTHING RETURNING id;`)));
  assert.equal(claims.filter(Boolean).length,1);
  sql(`UPDATE telegram_payment_notifications SET delivery_status='unknown' WHERE payment_id='${ids[0]}';`);
  assert.equal(sql(`INSERT INTO telegram_payment_notifications(payment_id,student_id,teacher_id,recipient_type) VALUES('${ids[0]}','${S}','${A}','teacher') ON CONFLICT DO NOTHING RETURNING id;`),'');
  assert.deepEqual(JSON.parse(sql('SELECT row_to_json(p)::jsonb - \'operation_id\' FROM payments p WHERE id=1;')),JSON.parse(history));
  console.log('Isolated database:',database,'— 12 concurrent payments → 1 row; 12 notification claims → 1; historical sentinel unchanged.');
});
