create extension if not exists "pgcrypto";

create table if not exists public.studios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  tg_bot_token text,
  tg_chat_id text,
  trial_enabled boolean not null default true,
  show_prices boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.trainers (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  name text not null,
  photo_url text,
  bio text
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  trainer_id uuid references public.trainers(id) on delete set null,
  title text not null,
  day_of_week integer not null check (day_of_week between 1 and 7),
  time_start time not null,
  duration_minutes integer not null check (duration_minutes > 0),
  max_capacity integer not null check (max_capacity >= 0),
  current_bookings integer not null default 0 check (current_bookings >= 0),
  model_url text,
  color_theme text
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  client_name text not null,
  client_phone text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create or replace view public.public_studios as
select id, name, trial_enabled, show_prices, created_at
from public.studios;

create or replace view public.public_trainers as
select id, studio_id, name, photo_url, bio
from public.trainers;

create or replace view public.public_classes as
select id, studio_id, trainer_id, title, day_of_week, time_start,
       duration_minutes, max_capacity, current_bookings, model_url, color_theme
from public.classes;

alter table public.studios enable row level security;
alter table public.trainers enable row level security;
alter table public.classes enable row level security;
alter table public.bookings enable row level security;

insert into storage.buckets (id, name, public)
values ('trainer-photos', 'trainer-photos', true)
on conflict (id) do update set public = excluded.public;

create policy "owners upload trainer photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'trainer-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "owners update trainer photos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'trainer-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'trainer-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "owners delete trainer photos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'trainer-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "public reads trainer photos"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'trainer-photos');

create policy "owners manage their studios"
on public.studios
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "owners manage their trainers"
on public.trainers
for all
to authenticated
using (
  exists (
    select 1 from public.studios s
    where s.id = trainers.studio_id
      and s.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.studios s
    where s.id = trainers.studio_id
      and s.user_id = (select auth.uid())
  )
);

create policy "owners manage their classes"
on public.classes
for all
to authenticated
using (
  exists (
    select 1 from public.studios s
    where s.id = classes.studio_id
      and s.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.studios s
    where s.id = classes.studio_id
      and s.user_id = (select auth.uid())
  )
);

create policy "public can read trainers"
on public.trainers
for select
to anon, authenticated
using (true);

create policy "public can read classes"
on public.classes
for select
to anon, authenticated
using (true);

create policy "public can create bookings"
on public.bookings
for insert
to anon, authenticated
with check (
  exists (
    select 1
    from public.classes c
    where c.id = bookings.class_id
  )
);

create policy "owners read their bookings"
on public.bookings
for select
to authenticated
using (
  exists (
    select 1
    from public.classes c
    join public.studios s on s.id = c.studio_id
    where c.id = bookings.class_id
      and s.user_id = (select auth.uid())
  )
);

create policy "owners update their bookings"
on public.bookings
for update
to authenticated
using (
  exists (
    select 1
    from public.classes c
    join public.studios s on s.id = c.studio_id
    where c.id = bookings.class_id
      and s.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.classes c
    join public.studios s on s.id = c.studio_id
    where c.id = bookings.class_id
      and s.user_id = (select auth.uid())
  )
);

create policy "owners delete their bookings"
on public.bookings
for delete
to authenticated
using (
  exists (
    select 1
    from public.classes c
    join public.studios s on s.id = c.studio_id
    where c.id = bookings.class_id
      and s.user_id = (select auth.uid())
  )
);

grant select on public.public_studios to anon, authenticated;
grant select on public.public_trainers to anon, authenticated;
grant select on public.public_classes to anon, authenticated;
