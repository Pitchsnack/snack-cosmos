CREATE TABLE public.investor_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_key text NOT NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  width int NOT NULL,
  height int NOT NULL,
  size_bytes int NOT NULL,
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.investor_images TO authenticated;
GRANT ALL ON public.investor_images TO service_role;
ALTER TABLE public.investor_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read investor images" ON public.investor_images FOR SELECT TO authenticated USING (true);
CREATE INDEX investor_images_type_idx ON public.investor_images(type_key, uploaded_at);