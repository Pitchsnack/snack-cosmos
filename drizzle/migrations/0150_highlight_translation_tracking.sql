ALTER TABLE public.hidden_profiles
  ADD COLUMN highlight_translations jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.hidden_profiles.highlight_translations IS 'Per-row automatic Highlight translation metadata: target language, source text and row position. Used to label translations and avoid overwriting user edits.';

ALTER TABLE public.hidden_profiles
  ADD CONSTRAINT hidden_profiles_highlight_translations_array
  CHECK (jsonb_typeof(highlight_translations) = 'array');