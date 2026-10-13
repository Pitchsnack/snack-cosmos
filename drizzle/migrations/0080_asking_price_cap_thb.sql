CREATE OR REPLACE FUNCTION public.tg_asking_price_cap()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE cap numeric; pname text; amt_m numeric;
BEGIN
  amt_m := COALESCE(NEW.asking_price_thb / 1000000.0, NEW.asking_price);
  IF amt_m IS NULL OR auth.uid() IS NULL OR public.is_account_admin(auth.uid()) THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.asking_price IS NOT DISTINCT FROM OLD.asking_price AND NEW.asking_price_thb IS NOT DISTINCT FROM OLD.asking_price_thb THEN RETURN NEW; END IF;
  SELECT p.value_cap_thb_m, p.name INTO cap, pname FROM public.subscriptions s JOIN public.plans p ON p.id = s.plan_id WHERE s.user_id = auth.uid() AND p.role = 'seller';
  IF cap IS NOT NULL AND amt_m > cap THEN
    RAISE EXCEPTION 'Your % plan covers asking prices up to ฿%M. Upgrade to list at a higher price.', pname, cap USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $function$;

COMMENT ON COLUMN public.hidden_profiles.asking_price IS 'DEPRECATED: replaced by asking_price_thb (kept until owner OK)';