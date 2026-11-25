begin;
create table if not exists public.homework_assignments (
 id uuid primary key default gen_random_uuid(),
 teacher_id uuid not null references auth.users(id) on delete cascade,
 student_id uuid not null references public.students(id) on delete cascade,
 material_plan_id uuid not null,
 section_id text not null,
 title text not null,
 material_snapshot jsonb not null,
 instructions text not null default '',
 due_date date,
 status text not null default 'assigned' check(status in ('assigned','in_progress','submitted','reviewed','returned')),
 answers jsonb not null default '{}'::jsonb,
 teacher_feedback text not null default '',
 assigned_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 submitted_at timestamptz,
 reviewed_at timestamptz
);
create index if not exists homework_teacher_student_idx on public.homework_assignments(teacher_id,student_id,assigned_at desc);
alter table public.homework_assignments enable row level security;
revoke all on public.homework_assignments from public,anon,authenticated;
grant select on public.homework_assignments to authenticated;
drop policy if exists homework_teacher_read on public.homework_assignments;
create policy homework_teacher_read on public.homework_assignments for select to authenticated using(teacher_id=auth.uid());

create or replace function public.assign_homework(p_student_id uuid,p_plan_id uuid,p_section_id text,p_due_date date default null,p_instructions text default '')
returns uuid language plpgsql security definer set search_path='' as $$
declare body jsonb; section jsonb; exercises jsonb; assignment_id uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.students s where s.id=p_student_id and s.teacher_id=auth.uid() and not s.archived) then raise exception 'Student not found'; end if;
 select p.body into body from public.teaching_lesson_plans p where p.id=p_plan_id and p.teacher_id=auth.uid();
 if body is null then raise exception 'Material not found'; end if;
 select s into section from jsonb_array_elements(body->'stages') s where s->>'id'=p_section_id and s->>'homework'='true';
 if section is null then raise exception 'Homework section not found'; end if;
 select jsonb_agg(b order by ord) into exercises from jsonb_array_elements(body->'blocks') with ordinality as x(b,ord)
 where b->>'stage'=p_section_id and coalesce(b->>'hiddenFromStudent','false')<>'true';
 if exercises is null then raise exception 'Homework has no visible exercises'; end if;
 insert into public.homework_assignments(teacher_id,student_id,material_plan_id,section_id,title,material_snapshot,due_date,instructions)
 values(auth.uid(),p_student_id,p_plan_id,p_section_id,coalesce(body->>'title','Homework'),
 jsonb_build_object('schemaVersion',1,'title',coalesce(body->>'title','Homework'),'cefr',coalesce(body->>'cefr',''),'age',coalesce(body->>'age',''),'duration',0,'framework','Custom','vocabulary','','grammar','','outcomes','','objectives','[]'::jsonb,'stages',jsonb_build_array(section-'notes'-'purpose'),'blocks',exercises),p_due_date,coalesce(p_instructions,''))
 returning id into assignment_id;
 return assignment_id;
end;
$$;
revoke all on function public.assign_homework(uuid,uuid,text,date,text) from public,anon;
grant execute on function public.assign_homework(uuid,uuid,text,date,text) to authenticated;
notify pgrst,'reload schema';
commit;
