-- Remove inherited PUBLIC/anonymous Data API table privileges.
-- RLS still protects rows, but direct table access should not be available to anon.
-- The public student cabinet remains exposed only through the dedicated RPC.

do $$
declare
  t text;
begin
  foreach t in array array[
    'students',
    'lessons',
    'payments',
    'groups',
    'lesson_members',
    'profiles',
    'transactions'
  ]
  loop
    execute format('revoke all on table public.%I from public, anon', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
