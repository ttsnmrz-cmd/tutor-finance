# Finance schema and access audit (repository only, 2026-11-22)

Reviewed committed migrations 001, 002, 004, 005. This is NOT a live database inspection; applied migration state, current policies and current RPC definitions remain unverified.

## Canonical identity
Finance uses Supabase project dmasuczggcxzrxasgoov. Tenant ownership is auth.users.id stored in teacher_id on students, lessons, payments, groups and lesson_members. Classroom currently uses a DIFFERENT project (rrevjdlgwlqrtzayewng), so teacher UUIDs cannot be assumed equal.

## Committed RLS
- 001 contains permissive legacy anon policies; 002 replaces those with teacher-scoped policies.
- 004 enforces same-teacher ownership for groups and lesson_members.
- 005 revokes anonymous table access and recreates teacher-scoped authenticated policies.
- This sequence is safe ONLY IF the later migrations were applied successfully. Confirm actual policies and grants before integration.

## Public student portal: important validation gate
- 002 defines SECURITY DEFINER get_public_student_cabinet(p_student_id uuid), executable by anon. It selects by student UUID and, for lessons/payments, by student name.
- The function as COMMITTED in 002 does not demonstrate a separate bearer-token verification. It also does not scope lesson/payment name matches by teacher_id.
- This may have been replaced by a later live SQL change. DO NOT assume the committed 002 function is the currently deployed version.
- Before expanding the student portal, inspect pg_get_functiondef for the deployed RPC, its grants, and any token verification mechanism. Ensure a student's portal token only exposes their own teacher-scoped records.

## Non-destructive live verification (SQL Editor, read-only)
```sql
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('students','lessons','payments','groups','lesson_members')
order by tablename, policyname;

select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('students','lessons','payments','groups','lesson_members')
  and grantee in ('anon','authenticated')
order by table_name, grantee, privilege_type;

select p.proname, pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef as security_definer,
       pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'get_public_student_cabinet';
```

No migrations executed, no data exported, and no production app modified.
