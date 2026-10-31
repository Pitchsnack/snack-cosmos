CREATE OR REPLACE FUNCTION public.keep_profile_setup_reached()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  keys text[];
  old_index integer;
  new_index integer;
BEGIN
  IF TG_TABLE_NAME = 'investors' THEN
    keys := ARRAY['role','type','name','web','aum','ticket','rev','deals','sectors','photos','desc','review'];
  ELSE
    keys := ARRAY['type','name','web','services','deal','team','sectors','contact','logo','desc','review'];
  END IF;
  old_index := coalesce(array_position(keys, OLD.setup_reached), 0);
  new_index := coalesce(array_position(keys, NEW.setup_reached), 0);
  IF NEW.setup_reached IS DISTINCT FROM OLD.setup_reached AND new_index = 0 THEN
    RAISE EXCEPTION 'Invalid setup step';
  END IF;
  IF new_index < old_index THEN NEW.setup_reached := OLD.setup_reached; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER investors_setup_reached_monotonic BEFORE UPDATE OF setup_reached ON public.investors FOR EACH ROW EXECUTE FUNCTION public.keep_profile_setup_reached();
CREATE TRIGGER advisor_setup_reached_monotonic BEFORE UPDATE OF setup_reached ON public.advisor_firms FOR EACH ROW EXECUTE FUNCTION public.keep_profile_setup_reached();
COMMENT ON COLUMN public.investors.setup_reached IS 'Furthest buyer setup question opened; monotonic; no historical backfill.';
COMMENT ON COLUMN public.advisor_firms.setup_reached IS 'Furthest advisor setup question opened; monotonic; no historical backfill.';