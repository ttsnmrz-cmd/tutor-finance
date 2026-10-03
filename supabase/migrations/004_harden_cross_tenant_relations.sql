-- Harden tenant isolation for cross-table relationships.
-- Run this migration once in Supabase SQL Editor.

-- A teacher may assign only their own group to their own student.
drop policy if exists "students_teacher_all" on public.students;

create policy "students_teacher_all"
  on public.students for all to authenticated
  using ((select auth.uid()) = teacher_id)
  with check (
    (select auth.uid()) = teacher_id
    and (
      group_id is null
      or exists (
        select 1
        from public.groups g
        where g.id = group_id
          and g.teacher_id = (select auth.uid())
      )
    )
  );

-- A lesson member must belong to the same teacher as both the lesson and student.
drop policy if exists "lesson_members_teacher_all" on public.lesson_members;

create policy "lesson_members_teacher_all"
  on public.lesson_members for all to authenticated
  using ((select auth.uid()) = teacher_id)
  with check (
    (select auth.uid()) = teacher_id
    and exists (
      select 1
      from public.lessons l
      where l.id = lesson_id
        and l.teacher_id = (select auth.uid())
    )
    and exists (
      select 1
      from public.students s
      where s.id = student_id
        and s.teacher_id = (select auth.uid())
    )
  );

-- A lesson's group, when present, must belong to the same teacher.
drop policy if exists "lessons_teacher_all" on public.lessons;

create policy "lessons_teacher_all"
  on public.lessons for all to authenticated
  using ((select auth.uid()) = teacher_id)
  with check (
    (select auth.uid()) = teacher_id
    and (
      group_id is null
      or exists (
        select 1
        from public.groups g
        where g.id = group_id
          and g.teacher_id = (select auth.uid())
      )
    )
  );

-- Groups themselves remain strictly teacher-owned.
drop policy if exists "groups_teacher_all" on public.groups;

create policy "groups_teacher_all"
  on public.groups for all to authenticated
  using ((select auth.uid()) = teacher_id)
  with check ((select auth.uid()) = teacher_id);

notify pgrst, 'reload schema';
