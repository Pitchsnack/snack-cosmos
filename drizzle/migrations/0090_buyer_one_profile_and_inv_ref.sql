CREATE OR REPLACE FUNCTION public.next_inv_ref() RETURNS text
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  SELECT 'INV-' || nextval('buyer_profile_ref_seq'::regclass)::text
$$;
REVOKE ALL ON FUNCTION public.next_inv_ref() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_inv_ref() TO service_role;

-- One investor profile per buyer account; Admin has no limit.
CREATE OR REPLACE FUNCTION public.tg_buyer_one_investor() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND public.account_role_of(auth.uid()) = 'buyer'
     AND EXISTS (SELECT 1 FROM public.buyer_profiles b WHERE b.user_id = auth.uid() AND b.investor_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Your account has one company. Ask PitchSnack if you need another.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS zz_buyer_one_investor ON public.investors;
CREATE TRIGGER zz_buyer_one_investor BEFORE INSERT ON public.investors FOR EACH ROW EXECUTE FUNCTION public.tg_buyer_one_investor();