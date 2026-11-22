alter table public.studios
  add column if not exists tg_started_at timestamptz,
  add column if not exists tg_verified_chat_id text;

alter table public.studios
  drop constraint if exists studios_tg_chat_verified_check;
