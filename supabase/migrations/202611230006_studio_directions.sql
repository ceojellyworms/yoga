alter table public.studios
  add column if not exists direction_mode text not null default 'both'
  check (direction_mode in ('yoga', 'dance', 'both'));

create or replace view public.public_studios as
select id, slug, name, headline, about_text, direction_mode,
       trial_enabled, show_prices, created_at
from public.studios;

grant select on public.public_studios to anon, authenticated;
