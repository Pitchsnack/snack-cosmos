ALTER TABLE public.hidden_profiles ADD COLUMN IF NOT EXISTS owner_stays text CHECK (owner_stays IN ('yes','no')), ADD COLUMN IF NOT EXISTS handover_months integer CHECK (handover_months IN (1,3,6,9,12,18,24));
COMMENT ON COLUMN public.hidden_profiles.handover IS 'DEPRECATED: replaced by owner_stays + handover_months';
COMMENT ON COLUMN public.hidden_profiles.stake_pct IS 'DEPRECATED: deal_type replaces stake';
COMMENT ON COLUMN public.hidden_profiles.structure IS 'DEPRECATED';
COMMENT ON COLUMN public.hidden_profiles.process IS 'DEPRECATED';
COMMENT ON COLUMN public.hidden_profiles.open_to IS 'DEPRECATED';