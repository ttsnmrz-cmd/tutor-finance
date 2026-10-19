-- Add explicit IANA time zones for teachers and students.
-- Existing lesson date/time values are deliberately left unchanged.
alter table public.students
  add column if not exists timezone text not null default 'Europe/Minsk';

alter table public.profiles
  add column if not exists timezone text not null default 'Europe/Minsk';

notify pgrst, 'reload schema';
