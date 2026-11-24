-- Teacher writes are authorized by session ownership; public reads by cabinet membership.
create or replace function public.save_calendar_session_notes(p_session_id uuid,p_plain text,p_html text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.live_sessions s where s.id=p_session_id and s.teacher_id=auth.uid() and s.calendar_lesson_id is not null and s.status='active') then
  raise exception 'Session unavailable';
 end if;
 insert into public.calendar_live_notes(teacher_id,lesson_id,title,plain,html,updated_at)
 select s.teacher_id,s.calendar_lesson_id,'Live Notes',p_plain,p_html,now()
 from public.live_sessions s where s.id=p_session_id and s.teacher_id=auth.uid()
 on conflict(teacher_id,lesson_id) do update set plain=excluded.plain,html=excluded.html,updated_at=excluded.updated_at;
end;
$$;
revoke all on function public.save_calendar_session_notes(uuid,text,text) from public;
grant execute on function public.save_calendar_session_notes(uuid,text,text) to authenticated;

create or replace function public.get_public_calendar_notes(p_student_id uuid,p_calendar_lesson_id bigint)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('plain',n.plain,'html',n.html)
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
