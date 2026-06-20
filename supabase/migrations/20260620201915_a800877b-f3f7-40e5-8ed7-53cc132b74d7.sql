
ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS firm_name varchar(255),
  ADD COLUMN IF NOT EXISTS email varchar(255),
  ADD COLUMN IF NOT EXISTS business_address text,
  ADD COLUMN IF NOT EXISTS year_founded integer,
  ADD COLUMN IF NOT EXISTS min_ticket_size varchar(50),
  ADD COLUMN IF NOT EXISTS max_ticket_size varchar(50),
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS keywords text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS business_model text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS preferred_stages text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS preferred_industries text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS investment_focus text[] DEFAULT '{}'::text[];
