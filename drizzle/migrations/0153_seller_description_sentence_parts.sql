ALTER TABLE public.hidden_profiles
  ADD COLUMN IF NOT EXISTS description_story jsonb,
  ADD COLUMN IF NOT EXISTS description_story_th jsonb;

COMMENT ON COLUMN public.hidden_profiles.description_story IS 'English seller Description sentence mode, editable parts, answer provenance and per-part translation marks; buyer text remains in description.';
COMMENT ON COLUMN public.hidden_profiles.description_story_th IS 'Thai seller Description sentence mode, editable parts, answer provenance and per-part translation marks; buyer text remains in description_th.';