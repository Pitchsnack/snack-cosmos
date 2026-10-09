ALTER TABLE public.startups
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS address_line2 text,
  ADD COLUMN IF NOT EXISTS address_city_district text,
  ADD COLUMN IF NOT EXISTS address_province_state text,
  ADD COLUMN IF NOT EXISTS postal_code text;
UPDATE public.startups SET address_line1 = business_address WHERE address_line1 IS NULL AND business_address IS NOT NULL AND btrim(business_address) <> '';