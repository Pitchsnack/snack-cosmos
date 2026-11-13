ALTER TABLE public.startup_founders ADD COLUMN IF NOT EXISTS contact_email text, ADD COLUMN IF NOT EXISTS contact_phone text;
COMMENT ON COLUMN public.startup_founders.contact_email IS 'Private setup contact email; never part of public founder projections.';
COMMENT ON COLUMN public.startup_founders.contact_phone IS 'Private setup contact phone; never part of public founder projections.';