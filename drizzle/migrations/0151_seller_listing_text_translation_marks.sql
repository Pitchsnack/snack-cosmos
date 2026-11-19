ALTER TABLE public.hidden_profiles
  ADD COLUMN IF NOT EXISTS listing_text_translations jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.hidden_profiles.listing_text_translations IS 'Automatic translation provenance for headline and description; edited target text removes its mark.';