create policy "superadmins manage all trainers"
on public.trainers
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where user_id = (select auth.uid())
      and role = 'superadmin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where user_id = (select auth.uid())
      and role = 'superadmin'
  )
);

create policy "superadmins manage all classes"
on public.classes
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where user_id = (select auth.uid())
      and role = 'superadmin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where user_id = (select auth.uid())
      and role = 'superadmin'
  )
);

create policy "superadmins manage all bookings"
on public.bookings
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where user_id = (select auth.uid())
      and role = 'superadmin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where user_id = (select auth.uid())
      and role = 'superadmin'
  )
);

create policy "superadmins manage trainer photos"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'trainer-photos'
  and exists (
    select 1
    from public.profiles
    where user_id = (select auth.uid())
      and role = 'superadmin'
  )
)
with check (
  bucket_id = 'trainer-photos'
  and exists (
    select 1
    from public.profiles
    where user_id = (select auth.uid())
      and role = 'superadmin'
  )
);
