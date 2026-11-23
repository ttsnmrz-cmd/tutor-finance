-- ProfiProfit Image Labeling: private teacher-owned image uploads.
-- Prerequisite: manually created PRIVATE Storage bucket 'classroom-images'.
-- Object key format: <auth.uid()>/<uuid>.<extension>.
-- IMPORTANT: This policy grants no student reads. Student delivery must use
-- short-lived signed URLs issued by a trusted, session-authorized backend.
-- Do not make the bucket public or grant anonymous SELECT.

do $$
begin
  if not exists (select 1 from storage.buckets where id = 'classroom-images') then
    raise exception 'Create the private classroom-images bucket first';
  end if;
  if exists (select 1 from storage.buckets where id = 'classroom-images' and public) then
    raise exception 'classroom-images must be private';
  end if;
end $$;

-- Only the authenticated user who owns the first path segment can upload.
-- UUID filename avoids collisions and path traversal. The teacher's ownership
-- is tied to the authenticated Supabase user, not to a client-supplied teacher ID.
drop policy if exists "classroom_images_teacher_insert" on storage.objects;
create policy "classroom_images_teacher_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'classroom-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and array_length(storage.foldername(name),1) = 1
);

drop policy if exists "classroom_images_teacher_select" on storage.objects;
create policy "classroom_images_teacher_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'classroom-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and array_length(storage.foldername(name),1) = 1
);

drop policy if exists "classroom_images_teacher_delete" on storage.objects;
create policy "classroom_images_teacher_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'classroom-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and array_length(storage.foldername(name),1) = 1
);

-- No UPDATE policy: replacement requires uploading a new unique object.
-- Existing unrelated storage policies are intentionally left unchanged.
