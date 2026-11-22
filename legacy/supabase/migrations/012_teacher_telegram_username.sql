-- Store the teacher's public Telegram username for contact details and future notifications.
alter table public.profiles
  add column if not exists telegram_username text;
