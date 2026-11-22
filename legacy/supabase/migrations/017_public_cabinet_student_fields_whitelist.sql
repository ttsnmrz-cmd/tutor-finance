-- 017: expose only the fields required by the public student cabinet.
-- The previous function serialized the entire students row and removed only
-- a small blacklist. New Telegram credentials/settings must never be public.

create or replace function public.get_public_student_cabinet(p_student_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'student', jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'price', s.price,
      'timezone', s.timezone
    ),
    'lessons', coalesce((
      select jsonb_agg(to_jsonb(l) - 'teacher_id' order by l.date, l.time)
      from public.lessons l
      where l.student_id = s.id
         or exists (
           select 1
           from public.lesson_members lm
           where lm.lesson_id = l.id
             and lm.student_id = s.id
         )
    ), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(to_jsonb(p) - 'teacher_id' order by p.date desc)
      from public.payments p
      where p.student_id = s.id
    ), '[]'::jsonb)
  )
  from public.students s
  where s.id = p_student_id
    and s.archived = false;
$$;

revoke all on function public.get_public_student_cabinet(uuid) from public;
grant execute on function public.get_public_student_cabinet(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
