
-- Add logo + media columns to investors (no new tables; stored inline as JSONB)
ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS media jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Extend storage RLS for the existing startup-media bucket so the same
-- bucket can also hold investor media. Path convention stays:
--   <tenantId>/<entityId>/<filename>   (entityId can be startup OR investor)
-- The startup policies remain; we add parallel ones for investor access.
-- folder[1] = tenantId, folder[2] = entityId (startup or investor UUID)

CREATE POLICY "investor_media_select" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'startup-media'
    AND public.can_access_investor(
      auth.uid(),
      (NULLIF((storage.foldername(name))[2], ''))::uuid
    )
  );

CREATE POLICY "investor_media_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'startup-media'
    AND public.can_manage_investor(
      auth.uid(),
      (NULLIF((storage.foldername(name))[1], ''))::uuid
    )
  );

CREATE POLICY "investor_media_update" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'startup-media'
    AND public.can_manage_investor(
      auth.uid(),
      (NULLIF((storage.foldername(name))[1], ''))::uuid
    )
  );

CREATE POLICY "investor_media_delete" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'startup-media'
    AND public.can_manage_investor(
      auth.uid(),
      (NULLIF((storage.foldername(name))[1], ''))::uuid
    )
  );
