ALTER TABLE public.peer_sets ADD COLUMN IF NOT EXISTS sector text;
ALTER TABLE public.peer_sets ADD COLUMN IF NOT EXISTS business_model text;

CREATE UNIQUE INDEX IF NOT EXISTS peer_sets_sector_model_key
  ON public.peer_sets (sector, COALESCE(business_model, ''));