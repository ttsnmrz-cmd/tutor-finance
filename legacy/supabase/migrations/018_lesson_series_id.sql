alter table public.lessons
  add column if not exists series_id uuid;

create index if not exists lessons_series_id_idx
  on public.lessons(series_id);

notify pgrst, 'reload schema';
