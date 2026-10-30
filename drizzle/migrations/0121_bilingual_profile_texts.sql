ALTER TABLE public.startups ADD COLUMN IF NOT EXISTS short_description_th text, ADD COLUMN IF NOT EXISTS long_description_th text, ADD COLUMN IF NOT EXISTS product_tags_th text[], ADD COLUMN IF NOT EXISTS market_tags_th text[];
ALTER TABLE public.hidden_profiles ADD COLUMN IF NOT EXISTS headline_th text, ADD COLUMN IF NOT EXISTS description_th text, ADD COLUMN IF NOT EXISTS highlights_th text[], ADD COLUMN IF NOT EXISTS customers_summary_th text, ADD COLUMN IF NOT EXISTS reason_th text;
ALTER TABLE public.startup_founders ADD COLUMN IF NOT EXISTS bio_th text, ADD COLUMN IF NOT EXISTS bio_story_th jsonb;
ALTER TABLE public.buyer_profiles ADD COLUMN IF NOT EXISTS description_th text;
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS long_description_th text, ADD COLUMN IF NOT EXISTS short_description_th text, ADD COLUMN IF NOT EXISTS keywords_th text[];
ALTER TABLE public.advisor_firms ADD COLUMN IF NOT EXISTS description_th text;
ALTER TABLE public.advisor_firm_fees ADD COLUMN IF NOT EXISTS own_words_th text;
ALTER TABLE public.advisor_firm_team ADD COLUMN IF NOT EXISTS role_th text;
ALTER TABLE public.advisor_firm_credentials ADD COLUMN IF NOT EXISTS name_th text, ADD COLUMN IF NOT EXISTS note_th text;