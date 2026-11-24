create table if not exists public.vocabulary_sets (
 id uuid primary key default gen_random_uuid(),
 teacher_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 name text not null check (char_length(trim(name)) between 1 and 120),
 pairs jsonb not null check (jsonb_typeof(pairs) = 'array' and jsonb_array_length(pairs) between 2 and 100),
 created_at timestamptz not null default now()
);
alter table public.vocabulary_sets enable row level security;
revoke all on public.vocabulary_sets from anon;
grant select, insert, update, delete on public.vocabulary_sets to authenticated;
drop policy if exists vocabulary_owner on public.vocabulary_sets;
create policy vocabulary_owner on public.vocabulary_sets for all to authenticated using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
