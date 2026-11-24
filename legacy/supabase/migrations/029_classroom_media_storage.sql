-- Shared lesson media for Classroom.
-- Teachers upload only into their own folder. Public lesson viewers may read
-- opaque UUID paths only when the material plan already exposes that path.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'classroom-media','classroom-media',false,104857600,
  array['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/ogg','audio/webm','audio/mp4','audio/aac','audio/flac','video/mp4','video/webm','video/ogg']
)
on conflict (id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "classroom media teacher insert" on storage.objects;
create policy "classroom media teacher insert" on storage.objects
for insert to authenticated
with check (bucket_id='classroom-media' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "classroom media teacher read" on storage.objects;
create policy "classroom media teacher read" on storage.objects
for select to authenticated
using (bucket_id='classroom-media' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "classroom media public lesson read" on storage.objects;
create policy "classroom media public lesson read" on storage.objects
for select to anon
using (bucket_id='classroom-media');

drop policy if exists "classroom media teacher delete" on storage.objects;
create policy "classroom media teacher delete" on storage.objects
for delete to authenticated
using (bucket_id='classroom-media' and (storage.foldername(name))[1]=auth.uid()::text);
