-- Final Data API hardening for the ProfiProfit tenant model.
-- Run this migration once in Supabase SQL Editor.
-- This intentionally removes direct anonymous table access. The public student
-- cabinet remains available only through get_public_student_cabinet().

do $$
declare
  t text;
begin
  foreach t in array array['students','lessons','payments','groups','lesson_members']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
  end loop;
end $$;

-- Recreate the tenant-scoped policies in one place so this migration is
-- self-contained even if the earlier migration was not applied.
drop policy if exists "students_teacher_all" on public.students;
create policy "students_teacher_all"
  on public.students for all to authenticated
  using ((select auth.uid()) = teacher_id)
  with check (
    (select auth.uid()) = teacher_id
    and (
      group_id is null
      or exists (
        select 1 from public.groups g
        where g.id = group_id
          and g.teacher_id = (select auth.uid())
      )
    )
  );

drop policy if exists "lessons_teacher_all" on public.lessons;
create policy "lessons_teacher_all"
  on public.lessons for all to authenticated
  using ((select auth.uid()) = teacher_id)
  with check (
    (select auth.uid()) = teacher_id
    and (
      group_id is null
      or exists (
        select 1 from public.groups g
        where g.id = group_id
          and g.teacher_id = (select auth.uid())
      )
    )
  );

drop policy if exists "payments_teacher_all" on public.payments;
create policy "payments_teacher_all"
  on public.payments for all to authenticated
  using ((select auth.uid()) = teacher_id)
  with check ((select auth.uid()) = teacher_id);

drop policy if exists "groups_teacher_all" on public.groups;
create policy "groups_teacher_all"
  on public.groups for all to authenticated
  using ((select auth.uid()) = teacher_id)
  with check ((select auth.uid()) = teacher_id);

drop policy if exists "lesson_members_teacher_all" on public.lesson_members;
create policy "lesson_members_teacher_all"
  on public.lesson_members for all to authenticated
  using ((select auth.uid()) = teacher_id)
  with check (
    (select auth.uid()) = teacher_id
    and exists (
      select 1 from public.lessons l
      where l.id = lesson_id
        and l.teacher_id = (select auth.uid())
    )
    and exists (
      select 1 from public.students s
      where s.id = student_id
        and s.teacher_id = (select auth.uid())
    )
  );

-- The function is the only anonymous entry point to student cabinet data.
revoke all on function public.get_public_student_cabinet(uuid) from public;
grant execute on function public.get_public_student_cabinet(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
