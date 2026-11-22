-- READ-ONLY finance schema preflight for unified learning integration.
-- Run in ProfiProfit Supabase SQL Editor. No writes, no DDL, no private rows.
-- Share the result tables, NOT tokens, credentials or student/payment records.
select 'required_table' as check_type, t.name as object_name,
       (to_regclass('public.'||t.name) is not null) as present
from (values ('students'),('lessons'),('lesson_members'),('payments'),
 ('learning_folders'),('learning_materials'),('learning_material_versions'),
 ('learning_assignments'),('learning_notes'),('learning_attempts')) t(name)
order by t.name;

select 'column' as check_type, table_name, column_name, data_type, udt_name,
       is_nullable
from information_schema.columns
where table_schema='public'
  and table_name in ('students','lessons','lesson_members','payments')
  and column_name in ('id','teacher_id','student_id','group_id','lesson_id',
                      'start_time','date','status','price')
order by table_name,column_name;

select 'student_fk' as check_type,c.conrelid::regclass::text as source_table,
       c.conname as constraint_name,pg_get_constraintdef(c.oid) as definition
from pg_constraint c
where c.contype='f'
  and c.conrelid in ('public.lessons'::regclass,'public.payments'::regclass,
                     'public.lesson_members'::regclass)
order by source_table,constraint_name;

select 'existing_rpc' as check_type,p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
 and p.proname in ('get_public_student_cabinet','get_student_portal_by_token',
                   'issue_student_portal_token','learning_save_material',
                   'learning_publish_material','learning_save_note',
                   'learning_folder_action','learning_move_material')
order by p.proname;
