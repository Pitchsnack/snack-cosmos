ALTER TABLE public.hidden_profiles ADD COLUMN IF NOT EXISTS published_headline_th text;
ALTER TABLE public.buyer_profiles ADD COLUMN IF NOT EXISTS suggested_headline_th text, ADD COLUMN IF NOT EXISTS published_headline_th text;
ALTER TABLE public.advisor_firms ADD COLUMN IF NOT EXISTS suggested_headline_th text, ADD COLUMN IF NOT EXISTS published_headline_th text, ADD COLUMN IF NOT EXISTS name_th text, ADD COLUMN IF NOT EXISTS address_th text;
ALTER TABLE public.startups ADD COLUMN IF NOT EXISTS startup_name_th text, ADD COLUMN IF NOT EXISTS business_address_th text;
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS investor_name_th text, ADD COLUMN IF NOT EXISTS address_th text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS full_name_th text, ADD COLUMN IF NOT EXISTS title_th text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS setup_language text;

ALTER TABLE public.hidden_profiles ADD CONSTRAINT hp_published_headline_th_len CHECK (published_headline_th IS NULL OR char_length(published_headline_th) <= 120);
ALTER TABLE public.buyer_profiles ADD CONSTRAINT bp_suggested_headline_th_len CHECK (suggested_headline_th IS NULL OR char_length(suggested_headline_th) <= 120);
ALTER TABLE public.buyer_profiles ADD CONSTRAINT bp_published_headline_th_len CHECK (published_headline_th IS NULL OR char_length(published_headline_th) <= 120);
ALTER TABLE public.advisor_firms ADD CONSTRAINT af_suggested_headline_th_len CHECK (suggested_headline_th IS NULL OR char_length(suggested_headline_th) <= 120);
ALTER TABLE public.advisor_firms ADD CONSTRAINT af_published_headline_th_len CHECK (published_headline_th IS NULL OR char_length(published_headline_th) <= 120);
ALTER TABLE public.advisor_firms ADD CONSTRAINT af_name_th_len CHECK (name_th IS NULL OR char_length(name_th) <= 200);
ALTER TABLE public.advisor_firms ADD CONSTRAINT af_address_th_len CHECK (address_th IS NULL OR char_length(address_th) <= 500);
ALTER TABLE public.startups ADD CONSTRAINT st_name_th_len CHECK (startup_name_th IS NULL OR char_length(startup_name_th) <= 200);
ALTER TABLE public.startups ADD CONSTRAINT st_address_th_len CHECK (business_address_th IS NULL OR char_length(business_address_th) <= 500);
ALTER TABLE public.investors ADD CONSTRAINT inv_name_th_len CHECK (investor_name_th IS NULL OR char_length(investor_name_th) <= 200);
ALTER TABLE public.investors ADD CONSTRAINT inv_address_th_len CHECK (address_th IS NULL OR char_length(address_th) <= 500);
ALTER TABLE public.user_profiles ADD CONSTRAINT up_full_name_th_len CHECK (full_name_th IS NULL OR char_length(full_name_th) <= 120);
ALTER TABLE public.user_profiles ADD CONSTRAINT up_title_th_len CHECK (title_th IS NULL OR char_length(title_th) <= 120);
ALTER TABLE public.users ADD CONSTRAINT users_setup_language_chk CHECK (setup_language IS NULL OR setup_language IN ('en','th'));

-- The setup language is set once and never changes afterwards.
CREATE OR REPLACE FUNCTION public.tg_setup_language_once() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.setup_language IS NOT NULL AND NEW.setup_language IS DISTINCT FROM OLD.setup_language THEN
    NEW.setup_language := OLD.setup_language;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS setup_language_once ON public.users;
CREATE TRIGGER setup_language_once BEFORE UPDATE OF setup_language ON public.users FOR EACH ROW EXECUTE FUNCTION public.tg_setup_language_once();