CREATE OR REPLACE FUNCTION public.tg_listing_name_admin_only()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.code_name := NULLIF(btrim(NEW.code_name), '');
  IF TG_OP = 'INSERT' THEN
    IF NEW.code_name IS NOT NULL AND auth.uid() IS NOT NULL AND NOT public.is_account_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Only PitchSnack names a listing';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.code_name IS DISTINCT FROM OLD.code_name THEN
    IF auth.uid() IS NOT NULL AND NOT public.is_account_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Only PitchSnack names a listing';
    END IF;
    -- A name set on a live listing reaches its approved version straight away; nothing else changes.
    IF NEW.live IS NOT NULL THEN
      NEW.live := jsonb_set(NEW.live, '{code_name}', COALESCE(to_jsonb(NEW.code_name), 'null'::jsonb), true);
    END IF;
    IF NEW.live_snapshot IS NOT NULL AND NEW.live_snapshot ? 'public' THEN
      NEW.live_snapshot := jsonb_set(NEW.live_snapshot, '{public,code_name}', COALESCE(to_jsonb(NEW.code_name), 'null'::jsonb), true);
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS zz_listing_name_admin_only ON public.hidden_profiles;
CREATE TRIGGER zz_listing_name_admin_only BEFORE INSERT OR UPDATE ON public.hidden_profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_listing_name_admin_only();

UPDATE public.startups SET setup_reached = 'price' WHERE setup_reached = 'lname';