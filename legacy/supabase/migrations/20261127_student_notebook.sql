begin;
-- Cabinet UUID is a bearer capability, not independent student authentication.
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
comment on table public.student_notebook_entries is 'Daily notebook accessible to holders of the student cabinet UUID.';
create or replace function public.get_student_notebook(p_student_id uuid)
returns jsonb language sql stable security definer set search_path='' as $
 select coalesce(jsonb_agg(jsonb_build_object('entry_date',n.entry_date,'content_html',n.content_html,'revision',n.revision) order by n.entry_date desc),'[]'::jsonb)
 from public.student_notebook_entries n
 join public.students s on s.id=n.student_id
 where s.id=p_student_id and not s.archived;
$;
create or replace function public.save_student_notebook_entry(p_student_id uuid,p_entry_date date,p_content_html text,p_expected_revision bigint)
returns bigint language plpgsql security definer set search_path='' as $
declare v_today date; v_revision bigint;
begin
 select (now() at time zone coalesce((select name from pg_catalog.pg_timezone_names where name=s.timezone),'UTC'))::date
 into v_today from public.students s where s.id=p_student_id and not s.archived;
 if not found then raise exception 'Cabinet unavailable'; end if;
 if p_entry_date is null or p_entry_date>v_today or p_expected_revision is null or p_expected_revision<0 then raise exception 'Invalid entry'; end if;
 if p_expected_revision=0 then
   if p_entry_date<>v_today then raise exception 'New entries must use today'; end if;
   insert into public.student_notebook_entries(student_id,entry_date,content_html)
   values(p_student_id,p_entry_date,p_content_html)
   on conflict do nothing returning revision into v_revision;
 else
   update public.student_notebook_entries set content_html=p_content_html,revision=revision+1,updated_at=now()
   where student_id=p_student_id and entry_date=p_entry_date and revision=p_expected_revision
   returning revision into v_revision;
 end if;
 if v_revision is null then raise exception 'Notebook revision conflict' using errcode='40001'; end if;
 return v_revision;
end;
$;
revoke all on function public.get_student_notebook(uuid) from public,anon,authenticated;
revoke all on function public.save_student_notebook_entry(uuid,date,text,bigint) from public,anon,authenticated;
grant execute on function public.get_student_notebook(uuid) to anon,authenticated;
grant execute on function public.save_student_notebook_entry(uuid,date,text,bigint) to anon,authenticated;
notify pgrst,'reload schema';
commit;
