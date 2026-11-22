-- Deduplication log for teacher lesson reminders.
-- Apply after migration 011 and before enabling the reminder function.
create table if not exists public.telegram_teacher_lesson_reminders (
  id uuid primary key default gen_random_uuid(),
  lesson_id bigint not null references public.lessons(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  reminder_type text not null check (reminder_type in ('1h', '10m')),
  sent_at timestamptz not null default now(),
  unique (lesson_id, reminder_type)
);

create index if not exists telegram_teacher_lesson_reminders_teacher_idx
  on public.telegram_teacher_lesson_reminders(teacher_id, sent_at desc);

alter table public.telegram_teacher_lesson_reminders enable row level security;
revoke all on table public.telegram_teacher_lesson_reminders from public, anon, authenticated;
