ALTER TABLE public.startups
  ADD COLUMN IF NOT EXISTS registered_type text,
  ADD COLUMN IF NOT EXISTS registered_status text,
  ADD COLUMN IF NOT EXISTS registered_date text,
  ADD COLUMN IF NOT EXISTS registered_capital text,
  ADD COLUMN IF NOT EXISTS business_size text;