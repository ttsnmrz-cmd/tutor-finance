-- READ ONLY. Run in canonical finance Supabase SQL Editor.
-- Validates the actual lesson/student relationship used by learning triggers.
-- No changes to existing data.
select 'direct_student_lessons' as check_name,count(*) as rows
from public.lessons where student_id is not null;
select 'group_member_rows' as check_name,count(*) as rows
from public.lesson_members;
select 'lesson_members_missing_or_mismatched_teacher' as check_name,count(*) as rows
from public.lesson_members lm
left join public.lessons l on l.id=lm.lesson_id
left join public.students s on s.id=lm.student_id
where l.id is null or s.id is null or
      lm.teacher_id is distinct from l.teacher_id or
      lm.teacher_id is distinct from s.teacher_id;
select 'direct_student_mismatched_teacher' as check_name,count(*) as rows
from public.lessons l
join public.students s on s.id=l.student_id
where l.teacher_id is distinct from s.teacher_id;
select 'group_lesson_without_members' as check_name,count(*) as rows
from public.lessons l
where l.group_id is not null and l.student_id is null
  and not exists(select 1 from public.lesson_members lm where lm.lesson_id=l.id);
