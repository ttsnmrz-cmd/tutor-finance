begin;
-- Storage only. No public RPC until notebook authorization is established.
create table if not exists public.student_notebook_entries (
 student_id uuid not null references public.students(id) on delete cascade,
 entry_date date not null,
 content_html text not null default '',
 revision bigint not null default 1 check (revision > 0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key (student_id, entry_date),
 check (octet_length(content_html) <= 262144)
);
alter table public.student_notebook_entries enable row level security;
revoke all on public.student_notebook_entries from public, anon, authenticated;
comment on table public.student_notebook_entries is 'Private daily notebook; access must use independently authorized student identity, not a teacher-visible cabinet UUID alone.';
commit;
