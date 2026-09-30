CREATE TABLE public.sector_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_key text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  width int NOT NULL,
  height int NOT NULL,
  size_bytes int NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sector_images_sector_idx ON public.sector_images (sector_key, uploaded_at);
GRANT SELECT ON public.sector_images TO authenticated, anon;
GRANT INSERT, DELETE ON public.sector_images TO authenticated;
GRANT ALL ON public.sector_images TO service_role;
ALTER TABLE public.sector_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads sector images" ON public.sector_images FOR SELECT USING (true);
CREATE POLICY "Approvers add sector images" ON public.sector_images FOR INSERT TO authenticated WITH CHECK (public.is_control(auth.uid()));
CREATE POLICY "Approvers delete sector images" ON public.sector_images FOR DELETE TO authenticated USING (public.is_control(auth.uid()));

ALTER TABLE public.hidden_profiles ADD COLUMN public_image_id uuid REFERENCES public.sector_images(id) ON DELETE SET NULL;

-- Built-in covers ("art:<sector>") are cleared so listings follow the cover rule.
UPDATE public.hidden_profiles SET pending_cover = NULL WHERE pending_cover LIKE 'art:%';
UPDATE public.hidden_profiles SET cover_image_url = NULL WHERE cover_image_url LIKE 'art:%';

CREATE POLICY "Public images are readable" ON storage.objects FOR SELECT USING (bucket_id = 'public-images');
CREATE POLICY "Approvers upload public images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'public-images' AND public.is_control(auth.uid()));
CREATE POLICY "Approvers delete public images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'public-images' AND public.is_control(auth.uid()));