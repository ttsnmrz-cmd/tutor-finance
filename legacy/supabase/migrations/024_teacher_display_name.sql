-- Allow each teacher to choose the name shown in the dashboard greeting.
alter table public.profiles
  add column if not exists name text;
