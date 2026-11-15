create table if not exists public.telegram_teacher_lesson_debt_reminders (
  id uuid primary key default gen_random_uuid(),
  lesson_id bigint not null references public.lessons(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  sent_at timestamptz not null default now(),
  unique (lesson_id, student_id)
);

create index if not exists telegram_teacher_lesson_debt_reminders_teacher_idx
  on public.telegram_teacher_lesson_debt_reminders(teacher_id, sent_at desc);

alter table public.telegram_teacher_lesson_debt_reminders enable row level security;
revoke all on table public.telegram_teacher_lesson_debt_reminders from public, anon, authenticated;

notify pgrst, 'reload schema';
