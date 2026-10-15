ALTER TABLE public.startups ALTER COLUMN startup_name DROP NOT NULL;
ALTER TABLE public.advisor_firms ADD COLUMN IF NOT EXISTS media jsonb NOT NULL DEFAULT '[]'::jsonb;
COMMENT ON COLUMN public.advisor_firms.media IS 'Up to 3 firm photos: [{slot:1..3, image_path}] in startup-media storage';