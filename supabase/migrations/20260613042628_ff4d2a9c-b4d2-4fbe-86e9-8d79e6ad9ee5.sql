
-- RLS policies on storage.objects for bucket 'startup-media'
-- Path layout: {tenant_id}/{startup_id}/{filename}

DROP POLICY IF EXISTS "startup_media_select" ON storage.objects;
CREATE POLICY "startup_media_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'startup-media'
    AND public.can_access_startup(
      auth.uid(),
      NULLIF((storage.foldername(name))[2], '')::uuid
    )
  );

DROP POLICY IF EXISTS "startup_media_insert" ON storage.objects;
CREATE POLICY "startup_media_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'startup-media'
    AND public.can_manage_startup(
      auth.uid(),
      NULLIF((storage.foldername(name))[1], '')::uuid
    )
  );

DROP POLICY IF EXISTS "startup_media_update" ON storage.objects;
CREATE POLICY "startup_media_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'startup-media'
    AND public.can_manage_startup(
      auth.uid(),
      NULLIF((storage.foldername(name))[1], '')::uuid
    )
  );

DROP POLICY IF EXISTS "startup_media_delete" ON storage.objects;
CREATE POLICY "startup_media_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'startup-media'
    AND public.can_manage_startup(
      auth.uid(),
      NULLIF((storage.foldername(name))[1], '')::uuid
    )
  );
