-- 015: add stable student IDs to individual lessons and payments.
-- Additive migration: legacy name columns remain in place for compatibility.
-- Ambiguous legacy rows are intentionally left with student_id = NULL.

alter table public.lessons
  add column if not exists student_id uuid;

alter table public.payments
  add column if not exists student_id uuid;

-- Backfill individual lessons only when exactly one student with this name
-- exists for the same teacher. Group lessons continue to use lesson_members.
with unique_students as (
  select teacher_id, name, min(id) as student_id
  from public.students
  where teacher_id is not null
  group by teacher_id, name
  having count(*) = 1
)
update public.lessons l
set student_id = s.student_id
from unique_students s
where l.student_id is null
  and l.group_id is null
  and l.teacher_id = s.teacher_id
  and l.student = s.name;

-- Backfill payments only when exactly one student with this name
-- exists for the same teacher.
with unique_students as (
  select teacher_id, name, min(id) as student_id
  from public.students
  where teacher_id is not null
  group by teacher_id, name
  having count(*) = 1
)
update public.payments p
set student_id = s.student_id
from unique_students s
where p.student_id is null
  and p.teacher_id = s.teacher_id
  and p.student = s.name;

-- Keep links valid if a student is deleted; existing application deletion
-- flow removes the student's related records before deleting the student.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'lessons_student_id_fkey'
      and conrelid = 'public.lessons'::regclass
  ) then
    alter table public.lessons
      add constraint lessons_student_id_fkey
      foreign key (student_id) references public.students(id)
      on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'payments_student_id_fkey'
      and conrelid = 'public.payments'::regclass
  ) then
    alter table public.payments
      add constraint payments_student_id_fkey
      foreign key (student_id) references public.students(id)
      on delete set null;
  end if;
end $$;

create index if not exists lessons_student_id_idx
  on public.lessons(student_id);

create index if not exists payments_student_id_idx
  on public.payments(student_id);

notify pgrst, 'reload schema';

-- Verification queries (run separately after the migration):
-- select count(*) as lessons_without_student_id
-- from public.lessons where group_id is null and student_id is null;
--
-- select count(*) as payments_without_student_id
-- from public.payments where student_id is null;
