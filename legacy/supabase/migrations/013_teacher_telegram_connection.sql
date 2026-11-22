-- Store the teacher's Telegram destination and one-time setup token.
alter table public.profiles
  add column if not exists telegram_chat_id bigint,
  add column if not exists telegram_link_token text,
  add column if not exists telegram_connected_at timestamptz;

create unique index if not exists profiles_telegram_link_token_uidx
  on public.profiles (telegram_link_token)
  where telegram_link_token is not null;
