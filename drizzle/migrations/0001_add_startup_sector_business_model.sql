ALTER TABLE public.startups
  ADD COLUMN IF NOT EXISTS sector text,
  ADD COLUMN IF NOT EXISTS business_model text;