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

-- Preserve notifications already sent by the first version: don't replay them
-- after the corrected function is deployed.
insert into public.telegram_balance_processed_events (lesson_id, student_id)
select distinct lesson_id, student_id
from public.telegram_balance_notifications
on conflict do nothing;

insert into public.telegram_student_balance_state
  (student_id, teacher_id, last_state, last_balance, updated_at)
select distinct on (student_id, teacher_id)
  student_id,
  teacher_id,
  notification_type || ':' || coalesce(remaining_lessons, 0)::text,
  balance,
  created_at
from public.telegram_balance_notifications
order by student_id, teacher_id, created_at desc
on conflict (student_id, teacher_id) do nothing;

notify pgrst, 'reload schema';
