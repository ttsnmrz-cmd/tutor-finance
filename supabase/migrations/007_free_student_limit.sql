-- Enforce the free-plan limit of 10 active students per teacher.
-- Run this migration in Supabase SQL Editor once.
-- Archived students do not count toward the limit.

create or replace function public.enforce_teacher_student_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_count integer;
begin
  if new.teacher_id is null or new.archived is true then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.teacher_id is not distinct from old.teacher_id
     and old.archived is not true then
    return new;
  end if;

  -- Serialize concurrent inserts for the same teacher so two simultaneous
  -- requests cannot both pass the limit check.
  perform pg_advisory_xact_lock(
    hashtextextended(new.teacher_id::text, 0)
  );

  select count(*)
    into active_count
    from public.students s
   where s.teacher_id = new.teacher_id
     and s.archived is not true
     and (tg_op <> 'UPDATE' or s.id <> old.id);

  if active_count >= 10 then
    raise exception 'FREE_STUDENT_LIMIT_REACHED'
      using errcode = '23514',
            hint = 'The free plan allows up to 10 active students per teacher.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_teacher_student_limit on public.students;

create trigger enforce_teacher_student_limit
before insert or update of teacher_id, archived
on public.students
for each row
execute function public.enforce_teacher_student_limit();
