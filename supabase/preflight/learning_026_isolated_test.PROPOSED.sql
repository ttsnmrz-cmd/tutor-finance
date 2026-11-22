-- ISOLATED TEST HARNESS FOR 026. Run ONLY in the Classroom TEST Supabase project.
-- Creates objects in learning_test, never modifies existing public tables or data.
-- This is NOT the production migration; it tests schema constraints and ownership triggers.
-- Review before executing. Run the checks below after the transaction commits.
begin;
create schema if not exists learning_test;
create table learning_test.students (
 id uuid primary key default gen_random_uuid(),
 teacher_id uuid not null,
 display_name text not null
);
create table learning_test.lessons (
 id bigint generated always as identity primary key,
 teacher_id uuid not null,
 student_id uuid references learning_test.students(id),
 group_id uuid
);
create table learning_test.lesson_members (
 id bigint generated always as identity primary key,
 lesson_id bigint not null references learning_test.lessons(id) on delete cascade,
 student_id uuid not null references learning_test.students(id) on delete cascade,
 teacher_id uuid not null
);
create table learning_test.learning_folders (
 id uuid primary key default gen_random_uuid(),
 teacher_id uuid not null,
 parent_id uuid,
 title text not null check(length(trim(title)) between 1 and 160),
 position integer not null default 0,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(id,teacher_id),
 foreign key(parent_id,teacher_id) references learning_test.learning_folders(id,teacher_id)
);
create table learning_test.learning_materials (
 id uuid primary key default gen_random_uuid(),
 teacher_id uuid not null,
 folder_id uuid,
 title text not null check(length(trim(title)) between 1 and 160),
 body jsonb not null default '{}'::jsonb,
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(id,teacher_id),
 foreign key(folder_id,teacher_id) references learning_test.learning_folders(id,teacher_id)
);
create table learning_test.learning_material_versions (
 id uuid primary key default gen_random_uuid(),
 material_id uuid not null,
 teacher_id uuid not null,
 version integer not null check(version>0),
 body jsonb not null,
 published_at timestamptz not null default now(),
 unique(material_id,version),
 unique(id,teacher_id),
 foreign key(material_id,teacher_id) references learning_test.learning_materials(id,teacher_id)
);
create table learning_test.learning_assignments (
 id uuid primary key default gen_random_uuid(),
 teacher_id uuid not null,
 student_id uuid not null references learning_test.students(id) on delete cascade,
 material_version_id uuid not null,
 finance_lesson_id bigint references learning_test.lessons(id) on delete set null,
 assigned_at timestamptz not null default now(),
 visible boolean not null default true,
 unique(id,teacher_id,student_id),
 foreign key(material_version_id,teacher_id) references learning_test.learning_material_versions(id,teacher_id)
);
create table learning_test.learning_notes (
 id uuid primary key default gen_random_uuid(),
 teacher_id uuid not null,
 student_id uuid not null references learning_test.students(id) on delete cascade,
 finance_lesson_id bigint references learning_test.lessons(id) on delete set null,
 topic text not null default '',
 document jsonb not null default '[]'::jsonb,
 lesson_date date,
 updated_at timestamptz not null default now(),
 unique(id,teacher_id,student_id)
);
create table learning_test.learning_attempts (
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
  references learning_test.learning_assignments(id,teacher_id,student_id) on delete cascade
);
create function learning_test.check_student_owner()
returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from learning_test.students s
   where s.id=new.student_id and s.teacher_id=new.teacher_id) then
  raise exception 'Student does not belong to teacher' using errcode='42501';
 end if;
 return new;
end $$;
create function learning_test.check_lesson_member()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.finance_lesson_id is null then return new; end if;
 if not exists(select 1 from learning_test.lessons l
  where l.id=new.finance_lesson_id and l.teacher_id=new.teacher_id
   and (l.student_id=new.student_id or exists(
    select 1 from learning_test.lesson_members lm
    where lm.lesson_id=l.id and lm.student_id=new.student_id
      and lm.teacher_id=new.teacher_id
   ))) then
  raise exception 'Lesson is not linked to this student and teacher' using errcode='42501';
 end if;
 return new;
end $$;
create trigger assignments_owner before insert or update on learning_test.learning_assignments
 for each row execute function learning_test.check_student_owner();
create trigger notes_owner before insert or update on learning_test.learning_notes
 for each row execute function learning_test.check_student_owner();
create trigger assignments_lesson before insert or update on learning_test.learning_assignments
 for each row execute function learning_test.check_lesson_member();
create trigger notes_lesson before insert or update on learning_test.learning_notes
 for each row execute function learning_test.check_lesson_member();
alter table learning_test.learning_folders enable row level security;
alter table learning_test.learning_materials enable row level security;
alter table learning_test.learning_material_versions enable row level security;
alter table learning_test.learning_assignments enable row level security;
alter table learning_test.learning_notes enable row level security;
alter table learning_test.learning_attempts enable row level security;
revoke all on schema learning_test from public,anon,authenticated;
revoke all on all tables in schema learning_test from public,anon,authenticated;
revoke all on all functions in schema learning_test from public,anon,authenticated;
create policy folders_teacher on learning_test.learning_folders for select to authenticated using(teacher_id=(select auth.uid()));
create policy materials_teacher on learning_test.learning_materials for select to authenticated using(teacher_id=(select auth.uid()));
create policy versions_teacher on learning_test.learning_material_versions for select to authenticated using(teacher_id=(select auth.uid()));
create policy assignments_teacher on learning_test.learning_assignments for select to authenticated using(teacher_id=(select auth.uid()));
create policy notes_teacher on learning_test.learning_notes for select to authenticated using(teacher_id=(select auth.uid()));
create policy attempts_teacher on learning_test.learning_attempts for select to authenticated using(teacher_id=(select auth.uid()));
commit;
-- Intentionally no seed rows and no grants: the next phase will add isolated test
-- fixtures and role-based assertions, without touching public Classroom records.
-- Cleanup (ONLY if explicitly requested): DROP SCHEMA learning_test CASCADE;
