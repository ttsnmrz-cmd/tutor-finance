-- PROPOSAL ONLY: requires reviewed 026 learning schema. Never touches finance records.
begin;
create or replace function public.learning_folder_action(
 p_action text,p_id uuid default null,p_title text default null,p_parent uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_teacher uuid := (select auth.uid()); v_id uuid; v_parent uuid;
begin
 if v_teacher is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_action not in ('create','rename','move') then
  raise exception 'Unsupported folder action';
 end if;
 if p_action in ('create','rename') and
  length(trim(coalesce(p_title,''))) not between 1 and 160 then
  raise exception 'Folder title must be 1–160 characters';
 end if;
 if p_parent is not null and not exists(
  select 1 from public.learning_folders
  where id=p_parent and teacher_id=v_teacher
 ) then raise exception 'Parent folder not found' using errcode='42501'; end if;
 if p_action='create' then
  insert into public.learning_folders(teacher_id,title,parent_id)
  values(v_teacher,trim(p_title),p_parent) returning id into v_id;
 elsif p_action='rename' then
  update public.learning_folders set title=trim(p_title)
  where id=p_id and teacher_id=v_teacher returning id into v_id;
 else
  if p_id=p_parent then raise exception 'Folder cannot contain itself'; end if;
  -- Prevent indirect cycles, even when the hierarchy is several levels deep.
  with recursive ancestors as (
   select id,parent_id from public.learning_folders
    where id=p_parent and teacher_id=v_teacher
   union all
   select f.id,f.parent_id from public.learning_folders f
    join ancestors a on f.id=a.parent_id
    where f.teacher_id=v_teacher
  )
  select id into v_parent from ancestors where id=p_id limit 1;
  if v_parent is not null then raise exception 'Cannot move folder into a descendant'; end if;
  update public.learning_folders set parent_id=p_parent
   where id=p_id and teacher_id=v_teacher returning id into v_id;
 end if;
 if v_id is null then raise exception 'Folder not found' using errcode='42501'; end if;
 return v_id;
end $$;

create or replace function public.learning_move_material(
 p_material uuid,p_folder uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_teacher uuid := (select auth.uid()); v_id uuid;
begin
 if v_teacher is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_folder is not null and not exists(
  select 1 from public.learning_folders where id=p_folder and teacher_id=v_teacher
 ) then raise exception 'Folder not found' using errcode='42501'; end if;
 update public.learning_materials
 set folder_id=p_folder,revision=revision+1,updated_at=now()
 where id=p_material and teacher_id=v_teacher returning id into v_id;
 if v_id is null then raise exception 'Material not found' using errcode='42501'; end if;
 return v_id;
end $$;
revoke all on function public.learning_folder_action(text,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.learning_move_material(uuid,uuid) from public,anon,authenticated;
grant execute on function public.learning_folder_action(text,uuid,text,uuid) to authenticated;
grant execute on function public.learning_move_material(uuid,uuid) to authenticated;
commit;
