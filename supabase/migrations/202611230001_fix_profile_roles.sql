drop policy if exists "profiles can read themselves" on public.profiles;

create policy "users read own profile"
on public.profiles
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "owners manage their studios" on public.studios;

create policy "owners manage their studios"
on public.studios
for all
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.profiles
    where user_id = (select auth.uid())
      and role = 'superadmin'
  )
)
with check (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.profiles
    where user_id = (select auth.uid())
      and role = 'superadmin'
  )
);
