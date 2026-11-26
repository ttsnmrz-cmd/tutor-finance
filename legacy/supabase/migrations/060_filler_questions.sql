create table if not exists public.filler_question_banks (
 teacher_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 category text not null check (category in ('General English','Kids','Business English')),
 level text not null check (level in ('All','A1','A2','B1','B2','C1')),
 questions text[] not null default '{}',
 primary key (teacher_id,category,level)
);
alter table public.filler_question_banks enable row level security;
create policy filler_question_owner on public.filler_question_banks for all to authenticated using (teacher_id=auth.uid()) with check (teacher_id=auth.uid());
revoke all on public.filler_question_banks from anon;
grant select,insert,update,delete on public.filler_question_banks to authenticated;
