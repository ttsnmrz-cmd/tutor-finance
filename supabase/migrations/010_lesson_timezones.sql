-- Store the timezone in which each lesson's date/time was entered.
-- Existing lessons are intentionally interpreted as Minsk local time.
alter table public.lessons
  add column if not exists timezone text not null default 'Europe/Minsk';

notify pgrst, 'reload schema';
