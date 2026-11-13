ALTER TABLE public.startups ADD COLUMN IF NOT EXISTS website_enrichment jsonb;
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS website_enrichment jsonb;
ALTER TABLE public.advisor_firms ADD COLUMN IF NOT EXISTS website_enrichment jsonb;

COMMENT ON COLUMN public.startups.website_enrichment IS 'Server-owned status and suggestions for the one website read per website.';
COMMENT ON COLUMN public.investors.website_enrichment IS 'Server-owned status and suggestions for the one website read per website.';
COMMENT ON COLUMN public.advisor_firms.website_enrichment IS 'Server-owned status and suggestions for the one website read per website.';