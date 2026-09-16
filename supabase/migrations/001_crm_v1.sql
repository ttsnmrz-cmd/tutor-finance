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
create policy if not exists "payments_all"
on public.payments
for all
to anon, authenticated
using (true)
with check (true);

NOTIFY pgrst, 'reload schema';
