create table if not exists public.telegram_support_messages (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  student_chat_id bigint not null,
  teacher_chat_id bigint not null,
  support_message_id bigint not null,
  created_at timestamptz not null default now(),
  unique (teacher_chat_id, support_message_id)
);

create index if not exists telegram_support_messages_student_idx
  on public.telegram_support_messages(student_id, created_at desc);

alter table public.telegram_support_messages enable row level security;
revoke all on table public.telegram_support_messages from public, anon, authenticated;

notify pgrst, 'reload schema';
