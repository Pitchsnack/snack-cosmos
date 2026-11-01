ALTER TABLE public.startups ADD COLUMN IF NOT EXISTS thai_name text, ADD COLUMN IF NOT EXISTS english_name text;
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS thai_name text, ADD COLUMN IF NOT EXISTS english_name text;
ALTER TABLE public.advisor_firms ADD COLUMN IF NOT EXISTS english_name text;
CREATE OR REPLACE FUNCTION public.validate_optional_company_names() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.thai_name IS DISTINCT FROM OLD.thai_name THEN
    NEW.thai_name := nullif(btrim(NEW.thai_name), '');
    IF char_length(NEW.thai_name) > 200 THEN RAISE EXCEPTION 'Thai Name must be 200 characters or fewer'; END IF;
  END IF;
  IF TG_OP = 'INSERT' OR NEW.english_name IS DISTINCT FROM OLD.english_name THEN
    NEW.english_name := nullif(btrim(NEW.english_name), '');
    IF char_length(NEW.english_name) > 200 THEN RAISE EXCEPTION 'English Name must be 200 characters or fewer'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validate_optional_company_names BEFORE INSERT OR UPDATE ON public.startups FOR EACH ROW EXECUTE FUNCTION public.validate_optional_company_names();
CREATE TRIGGER validate_optional_company_names BEFORE INSERT OR UPDATE ON public.investors FOR EACH ROW EXECUTE FUNCTION public.validate_optional_company_names();
CREATE TRIGGER validate_optional_company_names BEFORE INSERT OR UPDATE ON public.advisor_firms FOR EACH ROW EXECUTE FUNCTION public.validate_optional_company_names();