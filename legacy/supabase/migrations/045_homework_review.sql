begin;
create or replace function public.review_homework(p_assignment_id uuid,p_feedback text,p_return boolean default false)
returns void language plpgsql security definer set search_path='' as $$
begin
 update public.homework_assignments set
 status=case when p_return then 'returned' else 'reviewed' end,
 teacher_feedback=coalesce(p_feedback,''),reviewed_at=now(),updated_at=now()
 where id=p_assignment_id and teacher_id=auth.uid() and status='submitted';
 if not found then raise exception 'Submitted homework not found'; end if;
end;
$$;
revoke all on function public.review_homework(uuid,text,boolean) from public,anon;
grant execute on function public.review_homework(uuid,text,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
