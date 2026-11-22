-- PROPOSAL ONLY. NOT APPLIED. New educational data in the canonical finance project.
-- Does not alter students, lessons, payments, balances, Telegram or legacy portal RPCs.
-- Existing Classroom test content is intentionally NOT imported.
begin;
create table public.learning_folders (
 id uuid primary key default gen_random_uuid(),
 teacher_id uuid not null references auth.users(id),
 parent_id uuid,
 title text not null check(length(trim(title)) between 0 and 160 and length(trim(title))>0),
 position integer not null default 0,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(id,teacher_id),
 foreign key(parent_id,teacher_id) references public.learning_folders(id,teacher_id)
);
create table public.learning_materials (
 id uuid primary key default gen_random_uuid(),
 teacher_id uuid not null references auth.users(id),
 folder_id uuid,
 title text not null check(length(trim(title)) between 1 and 160),
 body jsonb not null default '{}'::jsonb,
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(id,teacher_id),
 foreign key(folder_id,teacher_id) references public.learning_folders(id,teacher_id)
);
-- Immutable snapshots: assigned exercises must not change when a teacher edits a draft.
create table public.learning_material_versions (
 id uuid primary key default gen_random_uuid(),
 material_id uuid not null,
 teacher_id uuid not null,
 version integer not null check(version>0),
 body jsonb not null,
 published_at timestamptz not null default now(),
 unique(material_id,version),
 unique(id,teacher_id),
 foreign key(material_id,teacher_id) references public.learning_materials(id,teacher_id)
);
create table public.learning_assignments (
 id uuid primary key default gen_random_uuid(),
 teacher_id uuid not null references auth.users(id),
 student_id uuid not null,
 material_version_id uuid not null,
 -- Existing finance lesson IDs are bigint; nullable for independent homework.
 finance_lesson_id bigint references public.lessons(id) on delete set null,
 assigned_at timestamptz not null default now(),
 visible boolean not null default true,
 unique(id,teacher_id,student_id),
 foreign key(material_version_id,teacher_id) references public.learning_material_versions(id,teacher_id)
);
create table public.learning_notes (
 id uuid primary key default gen_random_uuid(),
 teacher_id uuid not null references auth.users(id),
 student_id uuid not null,
 finance_lesson_id bigint references public.lessons(id) on delete set null,
 topic text not null default '',
 document jsonb not null default '[]'::jsonb,
 lesson_date date,
 updated_at timestamptz not null default now(),
 unique(id,teacher_id,student_id)
);
create table public.learning_attempts (
 id uuid primary key default gen_random_uuid(),
 assignment_id uuid not null,
 teacher_id uuid not null,
 student_id uuid not null,
 attempt_number integer not null check(attempt_number>0),
 answers jsonb not null,
 grading_status text not null default 'pending' check(grading_status in ('pending','auto_graded','reviewed')),
 score numeric,
 submitted_at timestamptz not null default now(),
 unique(assignment_id,attempt_number),
 foreign key(assignment_id,teacher_id,student_id)
  references public.learning_assignments(id,teacher_id,student_id) on delete cascade
);
-- Critical: finance student ownership is verified by DB, never by client-supplied teacher_id.
-- Student deletion must remain possible: learning records cascade; finance payment/lesson
-- deletion behavior is unchanged. Attempts cascade through assignments below.
alter table public.learning_assignments add constraint learning_assignment_student_owner
 foreign key(student_id) references public.students(id) on delete cascade;
alter table public.learning_notes add constraint learning_note_student_owner
 foreign key(student_id) references public.students(id) on delete cascade;
-- Prevent cross-teacher references even if IDs are supplied maliciously.
create or replace function public.learning_check_student_owner()
returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.students s
  where s.id=new.student_id and s.teacher_id=new.teacher_id) then
  raise exception 'Student does not belong to teacher' using errcode='42501';
 end if;
 return new;
end $$;
create trigger learning_assignments_owner before insert or update on public.learning_assignments
 for each row execute function public.learning_check_student_owner();
create trigger learning_notes_owner before insert or update on public.learning_notes
 for each row execute function public.learning_check_student_owner();
-- For a lesson reference, verify the lesson is genuinely linked to this student.
-- Group membership is checked through lesson_members, not group_id alone.
create or replace function public.learning_check_lesson_member()
returns trigger language plpgsql set search_path='' as $
begin
 if new.finance_lesson_id is null then return new; end if;
 if not exists(
  select 1 from public.lessons l
  where l.id=new.finance_lesson_id and l.teacher_id=new.teacher_id
   and (l.student_id=new.student_id or exists(
    select 1 from public.lesson_members lm
    where lm.lesson_id=l.id and lm.student_id=new.student_id
   ))
 ) then
  raise exception 'Lesson is not linked to this student and teacher'
   using errcode='42501';
 end if;
 return new;
end $;
create trigger learning_assignment_lesson_member before insert or update
 on public.learning_assignments for each row
 execute function public.learning_check_lesson_member();
create trigger learning_note_lesson_member before insert or update
 on public.learning_notes for each row
 execute function public.learning_check_lesson_member();

alter table public.learning_folders enable row level security;
alter table public.learning_materials enable row level security;
alter table public.learning_material_versions enable row level security;
alter table public.learning_assignments enable row level security;
alter table public.learning_notes enable row level security;
alter table public.learning_attempts enable row level security;
revoke all on public.learning_folders,public.learning_materials,public.learning_material_versions,
 public.learning_assignments,public.learning_notes,public.learning_attempts from public,anon,authenticated;
-- Teacher read access only. Writes will use validated RPCs in a subsequent migration.
grant select on public.learning_folders,public.learning_materials,public.learning_material_versions,
 public.learning_assignments,public.learning_notes,public.learning_attempts to authenticated;
create policy learning_folders_teacher on public.learning_folders for select to authenticated using(teacher_id=(select auth.uid()));
create policy learning_materials_teacher on public.learning_materials for select to authenticated using(teacher_id=(select auth.uid()));
create policy learning_versions_teacher on public.learning_material_versions for select to authenticated using(teacher_id=(select auth.uid()));
create policy learning_assignments_teacher on public.learning_assignments for select to authenticated using(teacher_id=(select auth.uid()));
create policy learning_notes_teacher on public.learning_notes for select to authenticated using(teacher_id=(select auth.uid()));
create policy learning_attempts_teacher on public.learning_attempts for select to authenticated using(teacher_id=(select auth.uid()));
create index learning_assignments_student_idx on public.learning_assignments(teacher_id,student_id,assigned_at desc);
create index learning_notes_student_idx on public.learning_notes(teacher_id,student_id,lesson_date desc);
create index learning_attempts_assignment_idx on public.learning_attempts(assignment_id,submitted_at desc);
commit;
-- STOP: do not apply until all migrations, permissions and token portal reads are reviewed.
