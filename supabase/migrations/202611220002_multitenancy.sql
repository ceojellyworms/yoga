alter table public.studios
  add column if not exists slug text,
  add column if not exists headline text,
  add column if not exists about_text text,
  add column if not exists admin_email text,
  add column if not exists admin_initial_password text;

update public.studios
set slug = 'flow-studio'
where slug is null;

alter table public.studios
  alter column slug set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'studios_slug_key'
  ) then
    alter table public.studios add constraint studios_slug_key unique (slug);
  end if;
end $$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('superadmin', 'studio_admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.project_admins (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  unique (studio_id, user_id)
);

alter table public.profiles enable row level security;
alter table public.project_admins enable row level security;

create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles(user_id, role)
  values (
    new.id,
    case
      when lower(new.email) = 'ceojellyworms@gmail.com' then 'superadmin'
      else 'studio_admin'
    end
  )
  on conflict (user_id) do update set role = excluded.role;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_profile();

insert into public.profiles(user_id, role)
select id, case when lower(email) = 'ceojellyworms@gmail.com' then 'superadmin' else 'studio_admin' end
from auth.users
on conflict (user_id) do update set role = excluded.role;

drop view if exists public.public_studios;

create view public.public_studios as
select id, slug, name, headline, about_text, trial_enabled, show_prices, created_at
from public.studios;

create policy "profiles can read themselves"
on public.profiles
for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid()) and p.role = 'superadmin'
  )
);

create policy "superadmins manage projects"
on public.studios
for all
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid()) and p.role = 'superadmin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid()) and p.role = 'superadmin'
  )
);

create policy "project admins read project admins"
on public.project_admins
for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid()) and p.role = 'superadmin'
  )
);

create policy "superadmins manage project admins"
on public.project_admins
for all
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid()) and p.role = 'superadmin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid()) and p.role = 'superadmin'
  )
);
