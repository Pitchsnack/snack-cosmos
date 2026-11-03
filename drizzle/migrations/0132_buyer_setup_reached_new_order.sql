CREATE OR REPLACE FUNCTION public.keep_profile_setup_reached()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  keys text[];
  old_index integer;
  new_index integer;
BEGIN
  IF TG_TABLE_NAME = 'investors' THEN
    keys := ARRAY['role','type','name','sectors','web','aum','ticket','rev','deals','photos','desc','team','review'];
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
ALTER TABLE public.investors DISABLE TRIGGER investors_setup_reached_monotonic;
UPDATE public.investors SET setup_reached = 'deals' WHERE setup_reached = 'sectors';
UPDATE public.investors i SET setup_reached = 'photos'
 WHERE i.setup_reached = 'desc'
   AND NOT EXISTS (SELECT 1 FROM public.buyer_profiles b WHERE b.investor_id = i.id AND b.buyer_relation = 'individual');
ALTER TABLE public.investors ENABLE TRIGGER investors_setup_reached_monotonic;