-- Student material access is scoped to a lesson belonging to the bearer-link student.
-- The public student UUID is already the cabinet access credential; do not expose
-- this RPC as a way to enumerate materials by plan ID.
create or replace function public.get_public_student_lesson_material(
 p_student_id uuid, p_calendar_lesson_id bigint
) returns jsonb language sql stable security definer set search_path=''
as $$
 select jsonb_build_object(
  'session_id',s.id,'status',s.status,
  'title',coalesce(v.body->>'title',p.body->>'title','Lesson'),
  'plan',jsonb_set(
    coalesce(v.body,p.body) - 'teacherNote' - 'privateNotes',
    '{blocks}',
    coalesce((
      select jsonb_agg(
        (b - 'teacherNote' - 'expected' - 'answer' - 'correctAnswer')
        || jsonb_build_object('items',coalesce((
          select jsonb_agg(i - 'expected' - 'answer' - 'correctAnswer')
          from jsonb_array_elements(coalesce(b->'items','[]'::jsonb)) i
        ),'[]'::jsonb))
      )
      from jsonb_array_elements(coalesce(coalesce(v.body,p.body)->'blocks','[]'::jsonb)) b
      where coalesce((b->>'hiddenFromStudent')::boolean,false)=false
    ),'[]'::jsonb)
  )
 )
 from public.students st
 join public.lessons l on (l.student_id=st.id or exists (
   select 1 from public.lesson_members lm where lm.lesson_id=l.id and lm.student_id=st.id
 ))
 join public.live_sessions s on s.calendar_lesson_id=l.id
 join public.teaching_lesson_plans p on p.id=s.material_plan_id and p.teacher_id=s.teacher_id
 left join public.teaching_lesson_versions v on v.id=s.material_version_id and v.teacher_id=s.teacher_id
 where st.id=p_student_id and not st.archived
   and l.id=p_calendar_lesson_id and s.status='active';
$$;
revoke all on function public.get_public_student_lesson_material(uuid,bigint) from public;
grant execute on function public.get_public_student_lesson_material(uuid,bigint) to anon,authenticated;
notify pgrst,'reload schema';
