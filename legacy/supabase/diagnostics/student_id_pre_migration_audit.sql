-- PRE-MIGRATION READ-ONLY AUDIT
-- Run this BEFORE migration 015 in Supabase SQL Editor.
-- This script does not alter data or schema.
-- It uses only the existing name-based columns.

-- 1) Duplicate student names within each teacher account.
-- These names cannot be safely auto-linked without manual review.
select
  teacher_id,
  name,
  count(*) as students_with_same_name,
  array_agg(id order by id) as student_ids
from public.students
group by teacher_id, name
having count(*) > 1
order by teacher_id, name;

-- 2) Individual lessons grouped by legacy name, with the number of possible
-- student matches. A count of 1 is unambiguous; 0 or >1 needs investigation.
select
  l.teacher_id,
  l.student as legacy_student_name,
  count(*) as lesson_count,
  count(distinct s.id) as matching_students,
  array_agg(distinct s.id order by s.id)
    filter (where s.id is not null) as matched_student_ids,
  min(l.date) as first_lesson_date,
  max(l.date) as last_lesson_date
from public.lessons l
left join public.students s
  on s.teacher_id = l.teacher_id
 and s.name = l.student
where l.group_id is null
group by l.teacher_id, l.student
order by l.teacher_id, l.student;

-- 3) Payments grouped by legacy name, with the number of possible
-- student matches.
select
  p.teacher_id,
  p.student as legacy_student_name,
  count(*) as payment_count,
  count(distinct s.id) as matching_students,
  array_agg(distinct s.id order by s.id)
    filter (where s.id is not null) as matched_student_ids,
  min(p.date) as first_payment_date,
  max(p.date) as last_payment_date,
  sum(p.amount) as total_amount
from public.payments p
left join public.students s
  on s.teacher_id = p.teacher_id
 and s.name = p.student
group by p.teacher_id, p.student
order by p.teacher_id, p.student;

-- 4) Overall counts, to record a baseline before the migration.
select
  (select count(*) from public.students) as students_total,
  (select count(*) from public.lessons where group_id is null) as individual_lessons_total,
  (select count(*) from public.lessons where group_id is not null) as group_lessons_total,
  (select count(*) from public.payments) as payments_total;
