-- Teacher ownership + safe public student cabinet.
-- Run this migration in Supabase SQL Editor once.

-- 1) Add ownership to all teacher-owned data.
alter table public.students add column if not exists teacher_id uuid references auth.users(id);
alter table public.lessons add column if not exists teacher_id uuid references auth.users(id);
alter table public.payments add column if not exists teacher_id uuid references auth.users(id);
alter table public.groups add column if not exists teacher_id uuid references auth.users(id);
alter table public.lesson_members add column if not exists teacher_id uuid references auth.users(id);

-- 2) Backfill ownership from the already-owned students.
update public.lessons l
set teacher_id = s.teacher_id
from public.students s
where l.teacher_id is null
  and s.teacher_id is not null
  and s.name = l.student;

update public.payments p
set teacher_id = s.teacher_id
from public.students s
where p.teacher_id is null
  and s.teacher_id is not null
  and s.name = p.student;

update public.lesson_members lm
set teacher_id = s.teacher_id
from public.students s
where lm.teacher_id is null
  and s.teacher_id is not null
  and s.id = lm.student_id;

update public.groups g
set teacher_id = x.teacher_id
from (
  select group_id, min(teacher_id::text)::uuid as teacher_id
  from public.students
  where group_id is not null and teacher_id is not null
  group by group_id
  having count(distinct teacher_id) = 1
) x
where g.teacher_id is null
  and g.id = x.group_id;

create index if not exists students_teacher_id_idx on public.students(teacher_id);
create index if not exists lessons_teacher_id_idx on public.lessons(teacher_id);
create index if not exists payments_teacher_id_idx on public.payments(teacher_id);
create index if not exists groups_teacher_id_idx on public.groups(teacher_id);
create index if not exists lesson_members_teacher_id_idx on public.lesson_members(teacher_id);

-- 3) Teacher-only RLS for the private application data.
alter table public.students enable row level security;
alter table public.lessons enable row level security;
alter table public.payments enable row level security;
alter table public.groups enable row level security;
alter table public.lesson_members enable row level security;

drop policy if exists "students_all" on public.students;
drop policy if exists "lessons_all" on public.lessons;
drop policy if exists "payments_all" on public.payments;
drop policy if exists "groups_all" on public.groups;
drop policy if exists "lesson_members_all" on public.lesson_members;

create policy "students_teacher_all"
  on public.students for all to authenticated
  using ((select auth.uid()) = teacher_id)
  with check ((select auth.uid()) = teacher_id);

create policy "lessons_teacher_all"
  on public.lessons for all to authenticated
  using ((select auth.uid()) = teacher_id)
  with check ((select auth.uid()) = teacher_id);

create policy "payments_teacher_all"
  on public.payments for all to authenticated
  using ((select auth.uid()) = teacher_id)
  with check ((select auth.uid()) = teacher_id);

create policy "groups_teacher_all"
  on public.groups for all to authenticated
  using ((select auth.uid()) = teacher_id)
  with check ((select auth.uid()) = teacher_id);

create policy "lesson_members_teacher_all"
  on public.lesson_members for all to authenticated
  using ((select auth.uid()) = teacher_id)
  with check ((select auth.uid()) = teacher_id);

-- 4) Public student cabinet is intentionally exposed only through this
-- read-only function. The normal tables remain inaccessible to anon.
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
    ), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(to_jsonb(p) - 'teacher_id' order by p.date desc)
      from public.payments p
      where p.student = s.name
    ), '[]'::jsonb)
  )
  from public.students s
  where s.id = p_student_id
    and s.archived = false;
$$;

revoke all on function public.get_public_student_cabinet(uuid) from public;
grant execute on function public.get_public_student_cabinet(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
