CREATE OR REPLACE FUNCTION public.claim_access_seat(_uid uuid, _code_id uuid, _role text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.access_codes%ROWTYPE; used int; today date := (now() AT TIME ZONE 'Asia/Bangkok')::date;
BEGIN
  SELECT * INTO c FROM public.access_codes WHERE id = _code_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'no_pass'; END IF;
  IF c.switched_off_at IS NOT NULL OR (c.ends_on IS NOT NULL AND c.ends_on < today) THEN RETURN 'inactive'; END IF;
  SELECT count(*) INTO used FROM public.users WHERE access_code_id = _code_id;
  IF used >= c.max_accounts THEN RETURN 'full'; END IF;
  UPDATE public.users SET access_code_id = _code_id,
    account_role = CASE WHEN account_role IS NULL AND _role IN ('seller','buyer','advisor') THEN _role ELSE account_role END
  WHERE id = _uid;
  IF NOT FOUND THEN RETURN 'no_pass'; END IF;
  RETURN 'ok';
END $$;
REVOKE ALL ON FUNCTION public.claim_access_seat(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_access_seat(uuid, uuid, text) TO service_role;