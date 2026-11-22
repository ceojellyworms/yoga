alter table public.studios
  add column if not exists admin_login text;

update public.studios
set admin_login = 'club-' || substr(replace(id::text, '-', ''), 1, 8)
where admin_login is null;

create unique index if not exists studios_admin_login_key
on public.studios(admin_login);
