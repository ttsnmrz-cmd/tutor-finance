-- SAFE READ-ONLY PRECHECK: run in canonical ProfiProfit Supabase SQL Editor.
-- No CREATE, ALTER, UPDATE, DELETE, DROP or GRANT statements.
-- Expected before deployment: six learning tables absent; student_portal_access present.
select 'required_tables' as check_name, t.table_name,
       (to_regclass('public.'||t.table_name) is not null) as exists_now
from (values ('students'),('lessons'),('lesson_members'),('student_portal_access'),
 ('learning_folders'),('learning_materials'),('learning_material_versions'),
 ('learning_assignments'),('learning_notes'),('learning_attempts')) as t(table_name)
order by t.table_name;

select 'required_columns' as check_name, c.table_name,c.column_name,c.data_type,c.is_nullable
from information_schema.columns c
where c.table_schema='public'
  and (c.table_name='students' and c.column_name in ('id','teacher_id','archived')
   or c.table_name='lessons' and c.column_name in ('id','teacher_id','student_id','group_id')
   or c.table_name='lesson_members' and c.column_name in ('lesson_id','student_id','teacher_id')
   or c.table_name='student_portal_access' and c.column_name in ('student_id','teacher_id','access_token'))
order by c.table_name,c.column_name;

select 'portal_rpc' as check_name,p.proname,
       pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
 and p.proname in ('get_student_portal_by_token','issue_student_portal_token','get_public_student_cabinet')
order by p.proname;

-- WARNING: if students.teacher_id or lessons.teacher_id is NULL on existing
-- rows, note binding may reject those rows; investigate without changing data.
select 'student_null_teacher_id' as check_name,count(*) as rows
from public.students where teacher_id is null;
select 'lesson_null_teacher_id' as check_name,count(*) as rows
from public.lessons where teacher_id is null;
