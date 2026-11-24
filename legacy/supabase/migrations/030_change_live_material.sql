create or replace function public.change_calendar_live_material(p_session_id uuid,p_material_plan_id uuid,p_material_version_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_material_plan_id is not null and not exists(select 1 from public.teaching_lesson_plans where id=p_material_plan_id and teacher_id=auth.uid()) then raise exception 'Material not found'; end if;
 if p_material_version_id is not null and not exists(select 1 from public.teaching_lesson_versions where id=p_material_version_id and plan_id=p_material_plan_id and teacher_id=auth.uid()) then raise exception 'Version not found'; end if;
 update public.live_sessions set material_plan_id=p_material_plan_id,material_version_id=p_material_version_id,updated_at=now()
 where id=p_session_id and teacher_id=auth.uid() and status in ('ready','active');
 if not found then raise exception 'Session not found or closed'; end if;
end;
$$;
revoke all on function public.change_calendar_live_material(uuid,uuid,uuid) from public,anon;
grant execute on function public.change_calendar_live_material(uuid,uuid,uuid) to authenticated;
notify pgrst,'reload schema';
