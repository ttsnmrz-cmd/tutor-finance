-- CRM v1: additive migration only. Existing rows and existing columns are preserved.
-- Run this once in Supabase SQL Editor before using the CRM.

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

-- The current v1 CRM sends REST requests with the public anon key.
-- Replace any older/restrictive policies with deterministic permissive policies.
-- This preserves existing data and fixes INSERT/UPDATE/DELETE for the current app.
alter table public.students enable row level security;
alter table public.lessons enable row level security;
alter table public.payments enable row level security;

drop policy if exists "students_all" on public.students;
drop policy if exists "lessons_all" on public.lessons;
drop policy if exists "payments_all" on public.payments;

create policy "students_all"
  on public.students
  for all
  to anon, authenticated
  using (true)
  with check (true);

create policy "lessons_all"
  on public.lessons
  for all
  to anon, authenticated
  using (true)
  with check (true);

create policy "payments_all"
  on public.payments
  for all
  to anon, authenticated
  using (true)
  with check (true);

NOTIFY pgrst, 'reload schema';
