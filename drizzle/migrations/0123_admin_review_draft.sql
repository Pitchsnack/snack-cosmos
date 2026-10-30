ALTER TABLE public.hidden_profiles ADD COLUMN IF NOT EXISTS review_draft jsonb, ADD COLUMN IF NOT EXISTS review_saved_at timestamptz;
ALTER TABLE public.buyer_profiles ADD COLUMN IF NOT EXISTS review_draft jsonb, ADD COLUMN IF NOT EXISTS review_saved_at timestamptz;
ALTER TABLE public.advisor_firms ADD COLUMN IF NOT EXISTS review_draft jsonb, ADD COLUMN IF NOT EXISTS review_saved_at timestamptz;
COMMENT ON COLUMN public.hidden_profiles.review_draft IS 'Admin approval review: published name/headline saved without verifying (server-only).';