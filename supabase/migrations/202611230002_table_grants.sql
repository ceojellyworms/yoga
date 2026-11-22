grant usage on schema public to anon, authenticated;

grant select on public.profiles to authenticated;
grant select on public.project_admins to authenticated;

grant select, insert, update, delete on public.studios to authenticated;
grant select, insert, update, delete on public.trainers to authenticated;
grant select, insert, update, delete on public.classes to authenticated;
grant select, insert, update, delete on public.bookings to authenticated;

grant select on public.public_studios to anon, authenticated;
grant select on public.public_trainers to anon, authenticated;
grant select on public.public_classes to anon, authenticated;

grant insert on public.bookings to anon, authenticated;
