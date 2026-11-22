-- PROPOSAL ONLY: student submissions using the opt-in capability token.
-- Depends on 018, 026, 029 and 030. No changes to finance records.
begin;
create or replace function public.learning_submit_answers(
 p_access_token uuid,
 p_assignment_id uuid,
 p_answers jsonb
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
 v_student uuid;
 v_teacher uuid;
 v_next integer;
 v_attempt uuid;
begin
 if p_answers is null
    or jsonb_typeof(p_answers)<>'object'
    or jsonb_typeof(p_answers->'text')<>'string'
    or length(btrim(p_answers->>'text'))=0
    or length(p_answers->>'text')>10000
    or octet_length(p_answers::text)>40000 then
  raise exception 'Invalid submission';
 end if;
 -- Only the free-text response shape is supported in this first version.
 -- Reject extra keys until structured exercises have a validated schema.
 if (select count(*) from jsonb_object_keys(p_answers))<>1 then
  raise exception 'Unsupported submission fields';
 end if;
 -- Resolve a valid, non-archived student from the secret token.
 select s.id,s.teacher_id into v_student,v_teacher
 from public.student_portal_access p
 join public.students s
   on s.id=p.student_id and s.teacher_id=p.teacher_id
 where p.access_token=p_access_token and s.archived=false;
 if v_student is null then
  raise exception 'Assignment unavailable' using errcode='42501';
 end if;
 -- Lock the assignment row to serialize concurrent attempt-number allocation.
 perform 1 from public.learning_assignments a
 where a.id=p_assignment_id and a.student_id=v_student
   and a.teacher_id=v_teacher and a.visible=true
 for update;
 if not found then
  raise exception 'Assignment unavailable' using errcode='42501';
 end if;
 select coalesce(max(t.attempt_number),0)+1 into v_next
 from public.learning_attempts t
 where t.assignment_id=p_assignment_id;
 if v_next>5 then
  raise exception 'Maximum number of submissions reached';
 end if;
 insert into public.learning_attempts
   (assignment_id,teacher_id,student_id,attempt_number,answers,grading_status)
 values (p_assignment_id,v_teacher,v_student,v_next,p_answers,'pending')
 returning id into v_attempt;
 return jsonb_build_object('attempt_id',v_attempt,'attempt_number',v_next,'status','pending');
end $$;

-- Read back ONLY the student's own attempts for currently visible assignments.
create or replace function public.learning_get_attempts_by_token(
 p_access_token uuid
) returns jsonb
language sql stable security definer set search_path=''
as $$
 select coalesce(jsonb_agg(
   jsonb_build_object(
     'id',t.id,'assignment_id',t.assignment_id,
     'attempt_number',t.attempt_number,'submitted_at',t.submitted_at,
     'grading_status',t.grading_status,'score',t.score,
     'answers',t.answers
   ) order by t.submitted_at desc,t.id
 ),'[]'::jsonb)
 from public.student_portal_access p
 join public.students s on s.id=p.student_id and s.teacher_id=p.teacher_id
 join public.learning_assignments a
   on a.student_id=s.id and a.teacher_id=s.teacher_id and a.visible=true
 join public.learning_attempts t
   on t.assignment_id=a.id and t.student_id=s.id and t.teacher_id=s.teacher_id
 where p.access_token=p_access_token and s.archived=false;
$$;

revoke all on function public.learning_submit_answers(uuid,uuid,jsonb)
 from public,anon,authenticated;
revoke all on function public.learning_get_attempts_by_token(uuid)
 from public,anon,authenticated;
grant execute on function public.learning_submit_answers(uuid,uuid,jsonb)
 to anon,authenticated;
grant execute on function public.learning_get_attempts_by_token(uuid)
 to anon,authenticated;
commit;
-- Security checks still required: bearer-token rotation, RLS isolation,
-- no answer keys in published student-facing snapshots, and rate limiting.
