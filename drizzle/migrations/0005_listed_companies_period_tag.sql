ALTER TABLE public.listed_companies
  ADD COLUMN IF NOT EXISTS statement_period text,
  ADD COLUMN IF NOT EXISTS tag text;