ALTER TABLE public.startups
  ADD COLUMN IF NOT EXISTS regulatory_licenses jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS iso_standards text[] NOT NULL DEFAULT '{}'::text[];