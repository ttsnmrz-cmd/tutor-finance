begin;
create or replace function public.save_public_student_homework(p_student_id uuid,p_assignment_id uuid,p_answers jsonb,p_submit boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if p_answers is null or jsonb_typeof(p_answers)<>'object' or octet_length(p_answers::text)>1000000 then raise exception 'Invalid answers'; end if;
 update public.homework_assignments h set answers=p_answers,
 status=case when p_submit then 'submitted' else 'in_progress' end,
 updated_at=now(),submitted_at=case when p_submit then now() else h.submitted_at end
 where h.id=p_assignment_id and h.student_id=p_student_id
 and h.status in ('assigned','in_progress','returned')
 and exists(select 1 from public.students s where s.id=h.student_id and s.teacher_id=h.teacher_id and not s.archived)
 returning jsonb_build_object('id',h.id,'status',h.status,'updated_at',h.updated_at) into result;
 if result is null then raise exception 'Homework unavailable or already submitted'; end if;
 return result;
end;
$$;
revoke all on function public.save_public_student_homework(uuid,uuid,jsonb,boolean) from public;
grant execute on function public.save_public_student_homework(uuid,uuid,jsonb,boolean) to anon,authenticated;
notify pgrst,'reload schema';
commit;
