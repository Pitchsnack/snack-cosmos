CREATE OR REPLACE FUNCTION public.asking_price_band(_thb bigint)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _thb IS NULL OR _thb <= 0 THEN NULL
    WHEN _thb < 50000000 THEN 'under_50m'
    WHEN _thb < 100000000 THEN '50m_100m'
    WHEN _thb < 250000000 THEN '100m_250m'
    WHEN _thb < 500000000 THEN '250m_500m'
    WHEN _thb < 1000000000 THEN '500m_1b'
    ELSE 'over_1b' END
$$;

ALTER TABLE public.hidden_profiles ADD COLUMN IF NOT EXISTS asking_price_thb bigint;
ALTER TABLE public.hidden_profiles ADD COLUMN IF NOT EXISTS asking_price_band text GENERATED ALWAYS AS (public.asking_price_band(asking_price_thb)) STORED;
ALTER TABLE public.startups ADD COLUMN IF NOT EXISTS listing_autofill_at timestamptz;
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS setup_reached text;
ALTER TABLE public.advisor_firms ADD COLUMN IF NOT EXISTS setup_reached text;
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS address_line1 text;
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS address_line2 text;
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS address_city_district text;
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS address_province_state text;
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS postal_code text;

-- one-time fills (no status/version/snapshot changes)
UPDATE public.hidden_profiles SET asking_price_thb = round(asking_price * 1000000)::bigint
  WHERE asking_price IS NOT NULL AND asking_price > 0 AND asking_price_thb IS NULL;
UPDATE public.investors SET address_line1 = business_address
  WHERE address_line1 IS NULL AND coalesce(trim(business_address),'') <> '';
UPDATE public.startups SET setup_reached = 'licences'
  WHERE setup_done_at IS NULL AND setup_reached = 'review';