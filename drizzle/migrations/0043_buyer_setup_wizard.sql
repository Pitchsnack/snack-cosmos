ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS aum_band text,
  ADD COLUMN IF NOT EXISTS ticket_band text,
  ADD COLUMN IF NOT EXISTS revenue_min_band text,
  ADD COLUMN IF NOT EXISTS aum_exact_usd numeric,
  ADD COLUMN IF NOT EXISTS registration_no text,
  ADD COLUMN IF NOT EXISTS setup_done_at timestamptz,
  ADD COLUMN IF NOT EXISTS wizard jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.investors ADD CONSTRAINT investors_aum_band_chk CHECK (aum_band IS NULL OR aum_band IN ('aum_below_50','aum_50_100','aum_100_250','aum_250_500','aum_500_plus'));
ALTER TABLE public.investors ADD CONSTRAINT investors_ticket_band_chk CHECK (ticket_band IS NULL OR ticket_band IN ('tkt_below_5','tkt_5_10','tkt_10_25','tkt_25_50','tkt_50_plus'));
ALTER TABLE public.investors ADD CONSTRAINT investors_revenue_min_band_chk CHECK (revenue_min_band IS NULL OR revenue_min_band IN ('rev_below_3','rev_3_8','rev_8_15','rev_15_30','rev_30_plus'));

ALTER TABLE public.buyer_profiles
  ADD COLUMN IF NOT EXISTS buyer_relation text CHECK (buyer_relation IS NULL OR buyer_relation IN ('individual','corporate','agent'));

-- One-time move to US$ bands (฿32 = US$1). Beacon VC: public AUM ฿250M–500M → bottom ≈ US$7.8M.
UPDATE public.investors SET aum_band = 'aum_below_50' WHERE id = '4a0d7c8f-2a76-4090-8864-16f0e99df3f3' AND aum_band IS NULL;

-- Existing live profiles count as set up.
UPDATE public.investors i SET setup_done_at = now()
FROM public.buyer_profiles b WHERE b.investor_id = i.id AND b.status = 'live' AND i.setup_done_at IS NULL;