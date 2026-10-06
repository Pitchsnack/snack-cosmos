ALTER TABLE public.advisor_firms ALTER COLUMN name SET DEFAULT '';
ALTER TABLE public.advisor_firms ALTER COLUMN firm_type SET DEFAULT '';
ALTER TABLE public.advisor_firms ADD COLUMN IF NOT EXISTS deal_size_band text CHECK (deal_size_band IS NULL OR deal_size_band IN ('deal_below_1','deal_1_5','deal_5_25','deal_25_50','deal_50_plus'));
ALTER TABLE public.advisor_firms ADD COLUMN IF NOT EXISTS logo_source text CHECK (logo_source IS NULL OR logo_source IN ('upload','enrich'));
ALTER TABLE public.advisor_firms ADD COLUMN IF NOT EXISTS setup_answered text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.advisor_firms ADD COLUMN IF NOT EXISTS setup_done_at timestamptz;
ALTER TABLE public.advisor_firms ADD COLUMN IF NOT EXISTS wizard_state jsonb NOT NULL DEFAULT '{}'::jsonb;
UPDATE public.advisor_firms SET setup_done_at = now() WHERE setup_done_at IS NULL;
UPDATE public.advisor_firms SET deal_size_band = CASE
  WHEN deal_min_usd_m IS NULL AND deal_max_usd_m IS NULL THEN NULL
  WHEN coalesce((coalesce(deal_min_usd_m,deal_max_usd_m)+coalesce(deal_max_usd_m,deal_min_usd_m))/2,0) < 1 THEN 'deal_below_1'
  WHEN (coalesce(deal_min_usd_m,deal_max_usd_m)+coalesce(deal_max_usd_m,deal_min_usd_m))/2 < 5 THEN 'deal_1_5'
  WHEN (coalesce(deal_min_usd_m,deal_max_usd_m)+coalesce(deal_max_usd_m,deal_min_usd_m))/2 < 25 THEN 'deal_5_25'
  WHEN (coalesce(deal_min_usd_m,deal_max_usd_m)+coalesce(deal_max_usd_m,deal_min_usd_m))/2 < 50 THEN 'deal_25_50'
  ELSE 'deal_50_plus' END
WHERE deal_size_band IS NULL;
COMMENT ON COLUMN public.advisor_firms.deal_min_usd_m IS 'DEPRECATED: replaced by deal_size_band';
COMMENT ON COLUMN public.advisor_firms.deal_max_usd_m IS 'DEPRECATED: replaced by deal_size_band';
COMMENT ON COLUMN public.advisor_firms.addr_subdistrict IS 'DEPRECATED: no longer shown';

ALTER TABLE public.advisor_firm_fees ADD COLUMN IF NOT EXISTS fee_type text NOT NULL DEFAULT 'other' CHECK (fee_type IN ('fixed','hourly','retainer','success','retainer_success','quote','other'));
ALTER TABLE public.advisor_firm_fees ADD COLUMN IF NOT EXISTS amount_thb bigint;
ALTER TABLE public.advisor_firm_fees ADD COLUMN IF NOT EXISTS pct_min numeric(5,2);
ALTER TABLE public.advisor_firm_fees ADD COLUMN IF NOT EXISTS pct_max numeric(5,2);
ALTER TABLE public.advisor_firm_fees ADD COLUMN IF NOT EXISTS own_words text;
UPDATE public.advisor_firm_fees SET own_words = fee WHERE fee_type = 'other' AND own_words IS NULL;
COMMENT ON COLUMN public.advisor_firm_fees.fee IS 'Display text built from fee_type and its fields';