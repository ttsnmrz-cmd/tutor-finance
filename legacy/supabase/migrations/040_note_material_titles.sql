-- Teacher writes are authorized by session ownership; public reads by cabinet membership.
create or replace function public.save_calendar_session_notes(p_session_id uuid,p_plain text,p_html text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.live_sessions s where s.id=p_session_id and s.teacher_id=auth.uid() and s.calendar_lesson_id is not null and s.status='active') then
  raise exception 'Session unavailable';
 end if;
 insert into public.calendar_live_notes(teacher_id,lesson_id,title,plain,html,updated_at)
 select s.teacher_id,s.calendar_lesson_id,coalesce((select v.body->>'title' from public.teaching_lesson_versions v where v.id=s.material_version_id and v.teacher_id=s.teacher_id),(select p.body->>'title' from public.teaching_lesson_plans p where p.id=s.material_plan_id and p.teacher_id=s.teacher_id),'Live Notes'),p_plain,p_html,now()
 from public.live_sessions s where s.id=p_session_id and s.teacher_id=auth.uid()
 on conflict(teacher_id,lesson_id) do update set title=excluded.title,plain=excluded.plain,html=excluded.html,updated_at=excluded.updated_at;
end;
$$;
revoke all on function public.save_calendar_session_notes(uuid,text,text) from public;
grant execute on function public.save_calendar_session_notes(uuid,text,text) to authenticated;

create or replace function public.get_public_calendar_notes(p_student_id uuid,p_calendar_lesson_id bigint)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('plain',n.plain,'html',n.html,'title',n.title)
 from public.students st
 join public.lessons l on (l.student_id=st.id or exists(select 1 from public.lesson_members lm where lm.lesson_id=l.id and lm.student_id=st.id))
 join public.live_sessions s on s.calendar_lesson_id=l.id
 join public.calendar_live_notes n on n.lesson_id=l.id and n.teacher_id=s.teacher_id
 where st.id=p_student_id and not st.archived and l.id=p_calendar_lesson_id
 and s.status in ('active','completed')
 order by n.updated_at desc limit 1;
$$;
revoke all on function public.get_public_calendar_notes(uuid,bigint) from public;
grant execute on function public.get_public_calendar_notes(uuid,bigint) to anon,authenticated;
notify pgrst,'reload schema';

create or replace function public.get_teacher_calendar_session_notes(p_session_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('plain',n.plain,'html',n.html)
 from public.live_sessions s
 join public.calendar_live_notes n on n.teacher_id=s.teacher_id and n.lesson_id=s.calendar_lesson_id
 where s.id=p_session_id and s.teacher_id=auth.uid();
$$;
revoke all on function public.get_teacher_calendar_session_notes(uuid) from public;
grant execute on function public.get_teacher_calendar_session_notes(uuid) to authenticated;
notify pgrst,'reload schema';

-- Recover material titles for existing generic notes using the latest linked session.
update public.calendar_live_notes n set title=q.title
from (select distinct on (s.teacher_id,s.calendar_lesson_id) s.teacher_id,s.calendar_lesson_id,coalesce(v.body->>'title',p.body->>'title') as title from public.live_sessions s join public.teaching_lesson_plans p on p.id=s.material_plan_id and p.teacher_id=s.teacher_id left join public.teaching_lesson_versions v on v.id=s.material_version_id and v.teacher_id=s.teacher_id order by s.teacher_id,s.calendar_lesson_id,s.updated_at desc nulls last,s.id) q
where n.teacher_id=q.teacher_id and n.lesson_id=q.calendar_lesson_id and coalesce(n.title,'Live Notes')='Live Notes' and nullif(q.title,'') is not null;
