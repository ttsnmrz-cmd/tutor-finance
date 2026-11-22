-- Additive, opt-in student portal capability. Does NOT change existing links/RPC.
-- Review and test before executing in production.
create table if not exists public.student_portal_access (
 student_id uuid primary key references public.students(id) on delete cascade,
 teacher_id uuid not null references auth.users(id),
 access_token uuid not null unique default gen_random_uuid(),
 created_at timestamptz not null default now(),
 rotated_at timestamptz
);
alter table public.student_portal_access enable row level security;
revoke all on public.student_portal_access from public, anon, authenticated;

-- Teachers can create or retrieve a token only for their own student.
create or replace function public.issue_student_portal_token(p_student_id uuid, p_rotate boolean default false)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_teacher uuid; v_token uuid;
begin
 v_teacher := (select s.teacher_id from public.students s where s.id=p_student_id and s.archived=false);
 if v_teacher is null or v_teacher is distinct from (select auth.uid()) then
   raise exception 'Student not found or access denied' using errcode='42501';
 end if;
 insert into public.student_portal_access(student_id,teacher_id)
 values(p_student_id,v_teacher)
 on conflict(student_id) do nothing;
 if p_rotate then
   update public.student_portal_access
   set access_token=gen_random_uuid(), rotated_at=now()
   where student_id=p_student_id and teacher_id=v_teacher;
 end if;
 select a.access_token into v_token from public.student_portal_access a
 where a.student_id=p_student_id and a.teacher_id=v_teacher;
 return v_token;
end;
$$;

-- A capability is NOT a student UUID. An invalid token returns no data.
-- Preserve the existing response shape to simplify later frontend cutover.
create or replace function public.get_student_portal_by_token(p_access_token uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
 select jsonb_build_object(
   'student',jsonb_build_object('id',s.id,'name',s.name,'price',s.price,'timezone',s.timezone),
   'lessons',coalesce((
      select jsonb_agg(to_jsonb(l)-'teacher_id' order by l.date,l.time)
      from public.lessons l
      where l.teacher_id=s.teacher_id
        and (l.student_id=s.id or exists(
          select 1 from public.lesson_members lm
          where lm.lesson_id=l.id and lm.student_id=s.id and lm.teacher_id=s.teacher_id))
   ),'[]'::jsonb),
   'payments',coalesce((
      select jsonb_agg(to_jsonb(p)-'teacher_id' order by p.date desc)
      from public.payments p
      where p.student_id=s.id and p.teacher_id=s.teacher_id
   ),'[]'::jsonb)
 )
 from public.student_portal_access a
 join public.students s on s.id=a.student_id and s.teacher_id=a.teacher_id
 where a.access_token=p_access_token and s.archived=false;
$$;

revoke all on function public.issue_student_portal_token(uuid,boolean) from public, anon;
revoke all on function public.get_student_portal_by_token(uuid) from public, anon, authenticated;
grant execute on function public.issue_student_portal_token(uuid,boolean) to authenticated;
grant execute on function public.get_student_portal_by_token(uuid) to anon,authenticated;
notify pgrst,'reload schema';

-- IMPORTANT: old get_public_student_cabinet(uuid) is deliberately untouched.
-- This is a parallel, opt-in implementation, NOT a complete security fix.
-- After distributing tokenized links and confirming adoption, retire the
-- UUID-only anonymous RPC. Otherwise it remains a bypass.
