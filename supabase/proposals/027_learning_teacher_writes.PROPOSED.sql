-- PROPOSED follow-up to 026_learning_module.PROPOSED.sql; NOT APPLIED.
-- Teacher-scoped writes for new learning content only. No finance table updates.
begin;
create or replace function public.learning_save_material(
 p_id uuid, p_title text, p_body jsonb, p_revision integer default null, p_folder_id uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_teacher uuid := (select auth.uid()); v_row public.learning_materials;
begin
 if v_teacher is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if length(trim(coalesce(p_title,''))) not between 1 and 160
    or p_body is null or jsonb_typeof(p_body)<>'object'
    or octet_length(p_body::text)>1000000 then
   raise exception 'Invalid material';
 end if;
 if p_folder_id is not null and not exists(
   select 1 from public.learning_folders where id=p_folder_id and teacher_id=v_teacher
 ) then raise exception 'Folder not found' using errcode='42501'; end if;
 if p_id is null then
   insert into public.learning_materials(teacher_id,folder_id,title,body)
   values(v_teacher,p_folder_id,trim(p_title),p_body) returning * into v_row;
 else
   if p_revision is null or p_revision<1 then raise exception 'Revision required'; end if;
   update public.learning_materials set title=trim(p_title),body=p_body,
     folder_id=p_folder_id,revision=revision+1,updated_at=now()
   where id=p_id and teacher_id=v_teacher and revision=p_revision
   returning * into v_row;
   if not found then raise exception 'Material missing or revision conflict' using errcode='40001'; end if;
 end if;
 return jsonb_build_object('id',v_row.id,'revision',v_row.revision,'title',v_row.title);
end $$;

create or replace function public.learning_publish_material(p_material_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_teacher uuid := (select auth.uid()); v_material public.learning_materials;
 v_version public.learning_material_versions;
begin
 if v_teacher is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select * into v_material from public.learning_materials
 where id=p_material_id and teacher_id=v_teacher for update;
 if not found then raise exception 'Material not found' using errcode='42501'; end if;
 insert into public.learning_material_versions(material_id,teacher_id,version,body)
 values(v_material.id,v_teacher,
   coalesce((select max(version)+1 from public.learning_material_versions
     where material_id=v_material.id),1),v_material.body)
 returning * into v_version;
 return jsonb_build_object('id',v_version.id,'version',v_version.version);
end $$;

create or replace function public.learning_save_note(
 p_id uuid, p_student_id uuid, p_topic text, p_document jsonb,
 p_lesson_date date default null, p_finance_lesson_ref text default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_teacher uuid := (select auth.uid()); v_id uuid;
begin
 if v_teacher is null or not exists(
   select 1 from public.students s where s.id=p_student_id and s.teacher_id=v_teacher
 ) then raise exception 'Student not found' using errcode='42501'; end if;
 if length(coalesce(p_topic,''))>200 or p_document is null
   or jsonb_typeof(p_document) not in ('array','object')
   or octet_length(p_document::text)>1000000
   or length(coalesce(p_finance_lesson_ref,''))>100 then
   raise exception 'Invalid note';
 end if;
 if p_finance_lesson_ref is not null and
    p_finance_lesson_ref !~ '^[0-9]{1,18}$' then
   raise exception 'Invalid finance lesson ID';
 end if;
 if p_id is null then
   insert into public.learning_notes(teacher_id,student_id,topic,document,lesson_date,finance_lesson_id)
   values(v_teacher,p_student_id,coalesce(p_topic,''),p_document,p_lesson_date,
    p_finance_lesson_ref::bigint)
   returning id into v_id;
 else
   update public.learning_notes set topic=coalesce(p_topic,''),document=p_document,
     lesson_date=p_lesson_date,finance_lesson_id=p_finance_lesson_ref::bigint,updated_at=now()
   where id=p_id and student_id=p_student_id and teacher_id=v_teacher
   returning id into v_id;
   if not found then raise exception 'Note not found' using errcode='42501'; end if;
 end if;
 return v_id;
end $$;

revoke all on function public.learning_save_material(uuid,text,jsonb,integer,uuid) from public,anon,authenticated;
revoke all on function public.learning_publish_material(uuid) from public,anon,authenticated;
revoke all on function public.learning_save_note(uuid,uuid,text,jsonb,date,text) from public,anon,authenticated;
grant execute on function public.learning_save_material(uuid,text,jsonb,integer,uuid) to authenticated;
grant execute on function public.learning_publish_material(uuid) to authenticated;
grant execute on function public.learning_save_note(uuid,uuid,text,jsonb,date,text) to authenticated;
commit;
-- Do not apply until reviewed and tested with separate teacher accounts.
