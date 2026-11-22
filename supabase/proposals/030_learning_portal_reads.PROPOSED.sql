-- PROPOSAL ONLY. Apply after 026 and the already-installed 018 capability migration.
-- Adds opt-in learning reads to the tokenized student portal. Existing finance
-- portal RPCs, links, tables and balances are not modified.
begin;
create or replace function public.get_student_learning_by_token(p_access_token uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
 with portal_student as (
   select s.id as student_id, s.teacher_id
   from public.student_portal_access a
   join public.students s
     on s.id=a.student_id and s.teacher_id=a.teacher_id
   where a.access_token=p_access_token
     and s.archived=false
 ),
 visible_assignments as (
   select a.id, a.student_id, a.teacher_id, a.finance_lesson_id,
          a.assigned_at, v.id as version_id, v.version,
          v.body, m.title as material_title
   from public.learning_assignments a
   join portal_student ps
     on ps.student_id=a.student_id and ps.teacher_id=a.teacher_id
   join public.learning_material_versions v
     on v.id=a.material_version_id and v.teacher_id=a.teacher_id
   join public.learning_materials m
     on m.id=v.material_id and m.teacher_id=a.teacher_id
   where a.visible=true
 )
 select jsonb_build_object(
   'student_id',ps.student_id,
   'assignments',coalesce((
     select jsonb_agg(
       jsonb_build_object(
         'id',a.id,
         'finance_lesson_id',a.finance_lesson_id,
         'assigned_at',a.assigned_at,
         'material_title',a.material_title,
         'material_version_id',a.version_id,
         'version',a.version,
         'body',a.body
       ) order by a.assigned_at desc,a.id
     ) from visible_assignments a
   ),'[]'::jsonb),
   'notes',coalesce((
     select jsonb_agg(
       jsonb_build_object(
         'id',n.id,
         'finance_lesson_id',n.finance_lesson_id,
         'lesson_date',n.lesson_date,
         'topic',n.topic,
         'document',n.document,
         'updated_at',n.updated_at
       ) order by n.lesson_date desc nulls last,n.updated_at desc,n.id
     )
     from public.learning_notes n
     where n.student_id=ps.student_id and n.teacher_id=ps.teacher_id
   ),'[]'::jsonb)
 )
 from portal_student ps;
$$;
-- A token is a bearer credential. Do not expose drafts, other students' notes,
-- hidden assignments, teacher IDs or full teacher library through this RPC.
revoke all on function public.get_student_learning_by_token(uuid)
 from public,anon,authenticated;
grant execute on function public.get_student_learning_by_token(uuid)
 to anon,authenticated;
commit;
-- NULL for invalid/revoked tokens; no exception that reveals whether a student exists.
-- WARNING: legacy UUID-only portal RPC remains available until separately retired.
