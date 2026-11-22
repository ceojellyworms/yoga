insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'model-assets',
  'model-assets',
  true,
  157286400,
  array['model/gltf-binary', 'application/octet-stream']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 157286400,
  allowed_mime_types = array['model/gltf-binary', 'application/octet-stream'];

drop policy if exists "public reads model assets" on storage.objects;
create policy "public reads model assets"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'model-assets');
