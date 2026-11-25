begin;
-- Match the existing cabinet bearer-link authorization model.
create or replace function public.get_public_student_homework(p_student_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',h.id,'title',h.title,'status',h.status,'assigned_at',h.assigned_at,
 'due_date',h.due_date,'instructions',h.instructions
 ) order by h.assigned_at desc),'[]'::jsonb)
 from public.homework_assignments h
 join public.students s on s.id=h.student_id and s.teacher_id=h.teacher_id
 where s.id=p_student_id and not s.archived;
$$;

create or replace function public.get_public_student_homework_material(p_student_id uuid,p_assignment_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'id',h.id,'title',h.title,'status',h.status,'due_date',h.due_date,
 'instructions',h.instructions,'answers',h.answers,'teacher_feedback',h.teacher_feedback,
 'plan',jsonb_set(h.material_snapshot - 'teacherNote' - 'privateNotes','{blocks}',
 coalesce((select jsonb_agg(
 (b - 'teacherNote' - 'privateNotes' - 'expected' - 'answer' - 'correctAnswer')
 || case when jsonb_typeof(b->'items')='array' then jsonb_build_object('items',
 coalesce((select jsonb_agg(i - 'expected' - 'answer' - 'correctAnswer' - 'teacherNote' - 'privateNotes' order by io)
 from jsonb_array_elements(b->'items') with ordinality as y(i,io)),'[]'::jsonb))
 else '{}'::jsonb end order by bo)
 from jsonb_array_elements(h.material_snapshot->'blocks') with ordinality as x(b,bo)
 where coalesce(b->>'hiddenFromStudent','false')<>'true'),'[]'::jsonb))
 )
 from public.homework_assignments h
 join public.students s on s.id=h.student_id and s.teacher_id=h.teacher_id
 where s.id=p_student_id and not s.archived and h.id=p_assignment_id;
$$;
revoke all on function public.get_public_student_homework(uuid) from public;
revoke all on function public.get_public_student_homework_material(uuid,uuid) from public;
grant execute on function public.get_public_student_homework(uuid) to anon,authenticated;
grant execute on function public.get_public_student_homework_material(uuid,uuid) to anon,authenticated;
notify pgrst,'reload schema';
commit;
