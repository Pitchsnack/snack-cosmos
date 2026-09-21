ALTER TABLE public.listed_companies
  ADD COLUMN IF NOT EXISTS gross_margin_pct numeric,
  ADD COLUMN IF NOT EXISTS net_margin_pct numeric,
  ADD COLUMN IF NOT EXISTS roe_pct numeric,
  ADD COLUMN IF NOT EXISTS debt_equity numeric,
  ADD COLUMN IF NOT EXISTS revenue_growth_pct numeric;