-- Security hardening for the public student cabinet.
-- Run this migration once in Supabase SQL Editor.

create or replace function public.get_public_student_cabinet(p_student_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'student', to_jsonb(s) - 'email' - 'telegram' - 'teacher_id' - 'pin',
    'lessons', coalesce((
      select jsonb_agg(to_jsonb(l) - 'teacher_id' order by l.date, l.time)
      from public.lessons l
      where l.student = s.name
        and l.teacher_id = s.teacher_id
    ), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(to_jsonb(p) - 'teacher_id' order by p.date desc)
      from public.payments p
      where p.student = s.name
        and p.teacher_id = s.teacher_id
    ), '[]'::jsonb)
  )
  from public.students s
  where s.id = p_student_id
    and s.archived = false;
$$;

revoke all on function public.get_public_student_cabinet(uuid) from public;
grant execute on function public.get_public_student_cabinet(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
