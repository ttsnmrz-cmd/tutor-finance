-- Read-only audit for the production ProfiProfit Classroom integration.
-- Run in Supabase SQL Editor. Does not modify any data.
WITH required(table_name,column_name) AS (
 VALUES
 ('material_sections','id'),('material_sections','teacher_id'),('material_sections','parent_id'),('material_sections','title'),('material_sections','position'),('material_sections','updated_at'),
 ('teaching_lesson_plans','id'),('teaching_lesson_plans','teacher_id'),('teaching_lesson_plans','section_id'),('teaching_lesson_plans','body'),('teaching_lesson_plans','revision'),('teaching_lesson_plans','updated_at'),
 ('teaching_lesson_versions','id'),('teaching_lesson_versions','teacher_id'),('teaching_lesson_versions','plan_id'),('teaching_lesson_versions','title'),('teaching_lesson_versions','body'),('teaching_lesson_versions','published_at')
)
SELECT r.table_name,r.column_name,
 CASE WHEN c.column_name IS NULL THEN 'MISSING' ELSE 'OK' END AS status,
 c.data_type,c.is_nullable,c.column_default
FROM required r LEFT JOIN information_schema.columns c
 ON c.table_schema='public' AND c.table_name=r.table_name AND c.column_name=r.column_name
ORDER BY r.table_name,r.column_name;

SELECT c.relname AS table_name,c.relrowsecurity AS rls_enabled,
 c.relforcerowsecurity AS force_rls
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('material_sections','teaching_lesson_plans','teaching_lesson_versions')
AND c.relkind IN ('r','p') ORDER BY c.relname;

SELECT tablename,policyname,roles,cmd,qual,with_check
FROM pg_policies WHERE schemaname='public'
AND tablename IN ('material_sections','teaching_lesson_plans','teaching_lesson_versions')
ORDER BY tablename,policyname;

SELECT table_name,grantee,privilege_type
FROM information_schema.role_table_grants
WHERE table_schema='public' AND table_name IN ('material_sections','teaching_lesson_plans','teaching_lesson_versions')
AND grantee IN ('anon','authenticated')
ORDER BY table_name,grantee,privilege_type;

SELECT p.proname AS function_name,pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('save_teaching_plan','publish_teaching_plan','create_planned_live_session')
ORDER BY p.proname;
