-- PRD 8: Additive lineage columns. Audit-only. No sync. No FK to global.
ALTER TABLE public.startups
  ADD COLUMN IF NOT EXISTS source_global_id uuid,
  ADD COLUMN IF NOT EXISTS imported_at timestamptz;

ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS source_global_id uuid,
  ADD COLUMN IF NOT EXISTS imported_at timestamptz;

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS source_global_id uuid,
  ADD COLUMN IF NOT EXISTS imported_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_startups_source_global_id  ON public.startups  (source_global_id) WHERE source_global_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_investors_source_global_id ON public.investors (source_global_id) WHERE source_global_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_source_global_id     ON public.deals     (source_global_id) WHERE source_global_id IS NOT NULL;