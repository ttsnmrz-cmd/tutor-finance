create table if not exists public.telegram_payment_notifications (
  id uuid primary key default gen_random_uuid(),
  payment_id text not null,
  student_id uuid not null references public.students(id) on delete cascade,
  teacher_id uuid not null,
  recipient_type text not null check (recipient_type in ('student','teacher')),
  created_at timestamptz not null default now(),
  constraint telegram_payment_notifications_once unique (payment_id, recipient_type)
);

create index if not exists telegram_payment_notifications_created_at_idx
  on public.telegram_payment_notifications(created_at desc);

alter table public.telegram_payment_notifications enable row level security;
