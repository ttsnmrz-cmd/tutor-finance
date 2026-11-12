create table if not exists public.telegram_balance_processed_events (
  lesson_id bigint not null references public.lessons(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  processed_at timestamptz not null default now(),
  primary key (lesson_id, student_id)
);

create table if not exists public.telegram_student_balance_state (
  student_id uuid not null references public.students(id) on delete cascade,
  teacher_id uuid not null,
  last_state text not null default 'ok',
  last_balance numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (student_id, teacher_id)
);

alter table public.telegram_balance_processed_events enable row level security;
alter table public.telegram_student_balance_state enable row level security;

notify pgrst, 'reload schema';
