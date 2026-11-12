-- Telegram lesson reminder delivery log.
-- Run once in Supabase SQL Editor before deploying notify-lesson-reminders.

create table if not exists public.telegram_lesson_reminders (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  reminder_type text not null check (reminder_type in ('1h', '10m')),
  sent_at timestamptz not null default now(),
  unique (lesson_id, student_id, reminder_type)
);

create index if not exists telegram_lesson_reminders_teacher_idx
  on public.telegram_lesson_reminders(teacher_id, sent_at desc);

alter table public.telegram_lesson_reminders enable row level security;
revoke all on table public.telegram_lesson_reminders from public, anon, authenticated;

