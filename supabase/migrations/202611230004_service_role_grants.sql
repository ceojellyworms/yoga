grant usage on schema public to service_role;

grant all privileges on table public.studios to service_role;
grant all privileges on table public.trainers to service_role;
grant all privileges on table public.classes to service_role;
grant all privileges on table public.bookings to service_role;
grant all privileges on table public.profiles to service_role;
grant all privileges on table public.project_admins to service_role;

grant select, insert, update, delete on table public.studios to authenticated;
grant select, insert, update, delete on table public.trainers to authenticated;
grant select, insert, update, delete on table public.classes to authenticated;
grant select, insert, update, delete on table public.bookings to authenticated;
grant select on table public.profiles to authenticated;
grant select on table public.project_admins to authenticated;

grant select on table public.public_studios to anon, authenticated;
grant select on table public.public_trainers to anon, authenticated;
grant select on table public.public_classes to anon, authenticated;

grant insert on table public.bookings to anon, authenticated;
