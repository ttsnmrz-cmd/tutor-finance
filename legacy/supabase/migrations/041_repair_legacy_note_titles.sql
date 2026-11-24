-- Recover material titles for existing generic notes using the latest linked session.
update public.calendar_live_notes n set title=q.title
from (select distinct on (s.teacher_id,s.calendar_lesson_id) s.teacher_id,s.calendar_lesson_id,coalesce(v.body->>'title',p.body->>'title') as title from public.live_sessions s join public.teaching_lesson_plans p on p.id=s.material_plan_id and p.teacher_id=s.teacher_id left join public.teaching_lesson_versions v on v.id=s.material_version_id and v.teacher_id=s.teacher_id order by s.teacher_id,s.calendar_lesson_id,s.updated_at desc nulls last,s.id) q
where n.teacher_id=q.teacher_id and n.lesson_id=q.calendar_lesson_id and (coalesce(n.title,'Live Notes')='Live Notes' or n.title ~ ' · [0-9]{4}-[0-9]{2}-[0-9]{2}$') and nullif(q.title,'') is not null;
