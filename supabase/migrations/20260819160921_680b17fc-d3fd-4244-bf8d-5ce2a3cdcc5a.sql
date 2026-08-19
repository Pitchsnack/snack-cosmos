ALTER TABLE public.startups
  ADD COLUMN IF NOT EXISTS registered_name character varying,
  ADD COLUMN IF NOT EXISTS company_size character varying,
  ADD COLUMN IF NOT EXISTS last_year_revenue character varying;