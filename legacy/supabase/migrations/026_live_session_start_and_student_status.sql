-- Live session lifecycle and public student status (no material content exposed).
create or replace function public.start_calendar_live_session(p_session_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.live_sessions
     set status='active',
         started_at=coalesce(started_at,now()),
         updated_at=now()
   where id=p_session_id and teacher_id=auth.uid()
     and status in ('ready','active');
  if not found then raise exception 'Session not found, unauthorized, or completed'; end if;
end;
$$;
revoke all on function public.start_calendar_live_session(uuid) from public,anon;
grant execute on function public.start_calendar_live_session(uuid) to authenticated;

-- The public cabinet already uses a student UUID as its bearer link.
-- This endpoint exposes only lesson IDs and statuses, never private materials.
create or replace function public.get_public_student_live_status(p_student_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
 select coalesce(jsonb_agg(jsonb_build_object(
    'calendar_lesson_id',s.calendar_lesson_id,
    'status',s.status,
    'has_material',s.material_plan_id is not null,
    'started_at',s.started_at
  )), '[]'::jsonb)
 from public.live_sessions s
 join public.lessons l on l.id=s.calendar_lesson_id
 join public.students st on st.id=p_student_id and st.archived=false
 where (l.student_id=st.id or exists (
   select 1 from public.lesson_members lm
   where lm.lesson_id=l.id and lm.student_id=st.id
 ));
$$;
revoke all on function public.get_public_student_live_status(uuid) from public;
grant execute on function public.get_public_student_live_status(uuid) to anon,authenticated;
notify pgrst,'reload schema';
