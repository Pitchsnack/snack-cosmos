ALTER TABLE public.advisor_firms ALTER COLUMN owner_user_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.tg_advisor_firm_owner_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.owner_user_id IS NULL THEN
    IF TG_OP = 'INSERT' AND coalesce(current_setting('app.ownerless_advisor_create', true), '') <> '1' THEN
      RAISE EXCEPTION 'An advisor firm needs an owner.';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.owner_user_id IS NOT NULL THEN
      RAISE EXCEPTION 'An advisor firm''s owner can''t be removed.';
    END IF;
    IF NEW.run_by IS DISTINCT FROM 'pitchsnack'::profile_run_by
       AND (NEW.status = 'live' OR NEW.advisor_verification = 'verified') THEN
      RAISE EXCEPTION 'A firm with no owner can''t be verified or go live unless it is Managed by PitchSnack.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS zzz_advisor_owner_guard ON public.advisor_firms;
CREATE TRIGGER zzz_advisor_owner_guard BEFORE INSERT OR UPDATE ON public.advisor_firms
FOR EACH ROW EXECUTE FUNCTION public.tg_advisor_firm_owner_guard();

CREATE OR REPLACE FUNCTION public.admin_create_ownerless_advisor_firm(_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _id uuid; _n text := btrim(coalesce(_name, ''));
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_control(auth.uid()) OR coalesce(public.account_role_of(auth.uid()), '') <> 'admin' THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  IF length(_n) < 2 OR length(_n) > 80 THEN RAISE EXCEPTION 'Enter the firm name (2–80 characters).'; END IF;
  PERFORM set_config('app.ownerless_advisor_create', '1', true);
  INSERT INTO public.advisor_firms (owner_user_id, status, name, firm_type, country)
  VALUES (NULL, 'draft', _n, '', 'Thailand') RETURNING id INTO _id;
  PERFORM set_config('app.ownerless_advisor_create', '', true);
  RETURN _id;
END $$;

REVOKE ALL ON FUNCTION public.admin_create_ownerless_advisor_firm(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_ownerless_advisor_firm(text) TO authenticated;