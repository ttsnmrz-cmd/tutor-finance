create table if not exists public.telegram_balance_notifications (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  teacher_id uuid not null,
  recipient_type text not null check (recipient_type in ('student','teacher')),
  notification_type text not null check (notification_type in ('low','empty','debt','less_than_one')),
  balance numeric not null,
  remaining_lessons integer,
  created_at timestamptz not null default now(),
  constraint telegram_balance_notifications_once
    unique (lesson_id, student_id, recipient_type)
);

create index if not exists telegram_balance_notifications_created_at_idx
  on public.telegram_balance_notifications(created_at desc);

alter table public.telegram_balance_notifications enable row level security;

notify pgrst, 'reload schema';
