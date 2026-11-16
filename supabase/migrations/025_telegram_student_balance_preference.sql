-- Allow each student to opt in or out of low-balance Telegram alerts.
-- Existing students keep the current behavior (enabled) by default.
alter table public.students
  add column if not exists telegram_notify_balance boolean not null default true;

notify pgrst, 'reload schema';
