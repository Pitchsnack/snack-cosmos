ALTER TABLE public.hidden_profiles
  ADD COLUMN identity_review_original jsonb;

COMMENT ON COLUMN public.hidden_profiles.identity_review_original IS 'Server-only baseline of public listing fields for the current identity review; not a public or seller editing DTO.'