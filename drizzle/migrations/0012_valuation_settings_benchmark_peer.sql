ALTER TABLE public.valuation_settings
  ADD COLUMN IF NOT EXISTS benchmark_peer_company_id uuid
  REFERENCES public.listed_companies(id) ON DELETE SET NULL;