ALTER TABLE public.startups ADD COLUMN IF NOT EXISTS registered_number text;
ALTER TABLE public.financial_statements ADD COLUMN IF NOT EXISTS retrieved_at timestamptz;
ALTER TABLE public.financial_statements ADD COLUMN IF NOT EXISTS matched_registered_number text;
ALTER TABLE public.financial_statements ADD COLUMN IF NOT EXISTS matched_registered_name text;