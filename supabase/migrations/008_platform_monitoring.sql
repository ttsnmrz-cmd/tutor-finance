-- ProfiProfit platform monitoring: teacher registrations, activity, and admin-only overview.
-- Run once in Supabase SQL Editor. After creating your account, add its UUID to platform_admins.
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_teacher_activity (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

create table if not exists public.platform_registration_events (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  registered_at timestamptz not null default now(),
  telegram_notified_at timestamptz
);

alter table public.platform_admins enable row level security;
alter table public.platform_teacher_activity enable row level security;
alter table public.platform_registration_events enable row level security;

revoke all on public.platform_admins from anon, authenticated;
revoke all on public.platform_teacher_activity from anon, authenticated;
revoke all on public.platform_registration_events from anon, authenticated;

create or replace function public.capture_platform_registration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.platform_registration_events(user_id, email, registered_at)
  values (new.id, new.email, coalesce(new.created_at, now()))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_registered_platform_monitoring on auth.users;
create trigger on_auth_user_registered_platform_monitoring
after insert on auth.users
for each row execute function public.capture_platform_registration();

create or replace function public.record_teacher_activity()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  insert into public.platform_teacher_activity(user_id, last_seen_at)
  values (auth.uid(), now())
  on conflict (user_id) do update set last_seen_at = excluded.last_seen_at;
end;
$$;

revoke all on function public.record_teacher_activity() from public, anon;
grant execute on function public.record_teacher_activity() to authenticated;

create or replace function public.get_platform_admin_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.platform_admins a where a.user_id = auth.uid()
  ) then
    raise exception 'Not authorized';
  end if;

  select jsonb_build_object(
    'total_teachers', (select count(*) from auth.users u where not exists (select 1 from public.platform_admins a where a.user_id = u.id)),
    'new_last_7_days', (select count(*) from auth.users u where u.created_at >= now() - interval '7 days' and not exists (select 1 from public.platform_admins a where a.user_id = u.id)),
    'active_last_7_days', (select count(*) from public.platform_teacher_activity a where a.last_seen_at >= now() - interval '7 days' and not exists (select 1 from public.platform_admins p where p.user_id = a.user_id)),
    'teachers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', u.id,
        'email', u.email,
        'registered_at', u.created_at,
        'last_seen_at', a.last_seen_at,
        'students_count', (select count(*) from public.students s where s.teacher_id = u.id and s.archived is not true),
        'lessons_count', (select count(*) from public.lessons l where l.teacher_id = u.id)
      ) order by u.created_at desc)
      from auth.users u
      left join public.platform_teacher_activity a on a.user_id = u.id
      where not exists (select 1 from public.platform_admins p where p.user_id = u.id)
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.get_platform_admin_dashboard() from public, anon;
grant execute on function public.get_platform_admin_dashboard() to authenticated;

notify pgrst, 'reload schema';
