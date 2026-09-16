-- CRM v1: additive migration only. Existing rows and existing columns are preserved.
-- Run this once in Supabase SQL Editor before using the new CRM fields.

alter table public.students
  add column if not exists price numeric(12,2) not null default 40;

alter table public.lessons
  add column if not exists time text;

alter table public.lessons
  add column if not exists note text;

alter table public.payments
  add column if not exists note text;

create index if not exists lessons_date_idx on public.lessons(date);
create index if not exists lessons_student_idx on public.lessons(student);
create index if not exists payments_date_idx on public.payments(date);
create index if not exists payments_student_idx on public.payments(student);

-- The current CRM uses the Supabase anon key for its REST requests.
-- Keep these policies permissive for the current v1 architecture.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'students' and policyname = 'students_all'
  ) then
    create policy "students_all"
      on public.students
      for all
      to anon, authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'lessons' and policyname = 'lessons_all'
  ) then
    create policy "lessons_all"
      on public.lessons
      for all
      to anon, authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'payments' and policyname = 'payments_all'
  ) then
    create policy "payments_all"
      on public.payments
      for all
      to anon, authenticated
      using (true)
      with check (true);
  end if;
end
$$;

NOTIFY pgrst, 'reload schema';
