-- PROPOSAL ONLY. Apply after 026. Does not modify existing finance tables.
-- Assign only immutable published versions owned by the signed-in teacher.
begin;
create or replace function public.learning_assign_material(
 p_student_id uuid,
 p_material_version_id uuid,
 p_finance_lesson_id bigint default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare
 v_teacher uuid := (select auth.uid());
 v_assignment uuid;
begin
 if v_teacher is null then
  raise exception 'Sign in required' using errcode='42501';
 end if;
 if not exists (
  select 1 from public.students s
  where s.id=p_student_id and s.teacher_id=v_teacher
 ) then
  raise exception 'Student not found' using errcode='42501';
 end if;
 if not exists (
  select 1 from public.learning_material_versions v
  where v.id=p_material_version_id and v.teacher_id=v_teacher
 ) then
  raise exception 'Published material not found' using errcode='42501';
 end if;
 insert into public.learning_assignments
  (teacher_id,student_id,material_version_id,finance_lesson_id)
 values (v_teacher,p_student_id,p_material_version_id,p_finance_lesson_id)
 returning id into v_assignment;
 -- 026 triggers independently verify student ownership and lesson membership.
 return v_assignment;
end $$;

create or replace function public.learning_set_assignment_visibility(
 p_assignment_id uuid,p_visible boolean
) returns boolean language plpgsql security definer set search_path='' as $$
declare v_teacher uuid := (select auth.uid());
begin
 if v_teacher is null then
  raise exception 'Sign in required' using errcode='42501';
 end if;
 if p_visible is null then
  raise exception 'Visibility must be true or false';
 end if;
 update public.learning_assignments
 set visible=p_visible
 where id=p_assignment_id and teacher_id=v_teacher;
 if not found then
  raise exception 'Assignment not found' using errcode='42501';
 end if;
 return true;
end $$;

revoke all on function public.learning_assign_material(uuid,uuid,bigint) from public,anon,authenticated;
revoke all on function public.learning_set_assignment_visibility(uuid,boolean) from public,anon,authenticated;
grant execute on function public.learning_assign_material(uuid,uuid,bigint) to authenticated;
grant execute on function public.learning_set_assignment_visibility(uuid,boolean) to authenticated;
commit;
-- No student/anonymous read access is added here. Portal reads require separate
-- capability-token validation and must never expose other students' content.
