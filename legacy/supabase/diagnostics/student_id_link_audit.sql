-- Read-only audit for the student ID migration.
-- Run only after migration 015 has been applied.
-- These queries do not modify data.

-- 1) Individual lessons that still have no student_id.
-- matched_student_ids shows the possible owners by teacher + exact name.
select
  l.id as lesson_id,
  l.teacher_id,
  l.student as legacy_student_name,
  l.date,
  l.price,
  count(s.id) as matching_students,
  array_agg(s.id) filter (where s.id is not null) as matched_student_ids
from public.lessons l
left join public.students s
  on s.teacher_id = l.teacher_id
 and s.name = l.student
where l.group_id is null
  and l.student_id is null
group by l.id, l.teacher_id, l.student, l.date, l.price
order by l.date, l.id;

-- 2) Payments that still have no student_id.
select
  p.id as payment_id,
  p.teacher_id,
  p.student as legacy_student_name,
  p.date,
  p.amount,
  count(s.id) as matching_students,
  array_agg(s.id) filter (where s.id is not null) as matched_student_ids
from public.payments p
left join public.students s
  on s.teacher_id = p.teacher_id
 and s.name = p.student
where p.student_id is null
group by p.id, p.teacher_id, p.student, p.date, p.amount
order by p.date, p.id;

-- 3) Duplicate student names per teacher (the reason automatic matching is unsafe).
select
  teacher_id,
  name,
  count(*) as students_with_same_name,
  array_agg(id order by id) as student_ids
from public.students
group by teacher_id, name
having count(*) > 1
order by name;
