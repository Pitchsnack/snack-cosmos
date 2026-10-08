CREATE OR REPLACE FUNCTION public.account_role_of(_uid uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT account_role FROM public.users WHERE id = _uid
$$;

CREATE OR REPLACE FUNCTION public.is_account_admin(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_control(_uid) OR COALESCE((SELECT account_role = 'admin' FROM public.users WHERE id = _uid), false)
$$;

-- True when the caller has this role, or is an admin.
CREATE OR REPLACE FUNCTION public.role_is(_uid uuid, _role text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_account_admin(_uid) OR COALESCE((SELECT account_role = _role FROM public.users WHERE id = _uid), false)
$$;

GRANT EXECUTE ON FUNCTION public.account_role_of(uuid), public.is_account_admin(uuid), public.role_is(uuid, text) TO authenticated, service_role;

-- Buyer-only data
CREATE POLICY "buyer role only" ON public.buyer_profiles AS RESTRICTIVE FOR ALL TO authenticated USING (public.role_is(auth.uid(), 'buyer')) WITH CHECK (public.role_is(auth.uid(), 'buyer'));
CREATE POLICY "buyer role only" ON public.buyer_verifications AS RESTRICTIVE FOR ALL TO authenticated USING (public.role_is(auth.uid(), 'buyer')) WITH CHECK (public.role_is(auth.uid(), 'buyer'));
CREATE POLICY "buyer role only" ON public.saved_listings AS RESTRICTIVE FOR ALL TO authenticated USING (public.role_is(auth.uid(), 'buyer')) WITH CHECK (public.role_is(auth.uid(), 'buyer'));
-- Seller-only data
CREATE POLICY "seller role only" ON public.saved_investors AS RESTRICTIVE FOR ALL TO authenticated USING (public.role_is(auth.uid(), 'seller')) WITH CHECK (public.role_is(auth.uid(), 'seller'));
CREATE POLICY "seller role only" ON public.seller_report_prefs AS RESTRICTIVE FOR ALL TO authenticated USING (public.role_is(auth.uid(), 'seller')) WITH CHECK (public.role_is(auth.uid(), 'seller'));
-- Advisor-only data
CREATE POLICY "advisor role only" ON public.advisor_firms AS RESTRICTIVE FOR ALL TO authenticated USING (public.role_is(auth.uid(), 'advisor')) WITH CHECK (public.role_is(auth.uid(), 'advisor'));
CREATE POLICY "advisor role only" ON public.advisor_favourites AS RESTRICTIVE FOR ALL TO authenticated USING (public.role_is(auth.uid(), 'advisor')) WITH CHECK (public.role_is(auth.uid(), 'advisor'));
-- Accounts: sellers, buyers and advisors read only their own row; admins and tenant staff (no marketplace role) keep their access.
CREATE POLICY "marketplace roles read own account" ON public.users AS RESTRICTIVE FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_account_admin(auth.uid()) OR public.account_role_of(auth.uid()) IS NULL);
-- Admin-only: plan usage of others, subscriptions of others already limited; approvals history of others limited by existing policies.

-- Plan counters
CREATE OR REPLACE FUNCTION public.current_term_start(_uid uuid) RETURNS timestamptz
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT term_start FROM public.subscriptions WHERE user_id = _uid
$$;

-- Buyer report opens. Opening the same report again in a term is free.
CREATE OR REPLACE FUNCTION public.can_open_report(_uid uuid, _report_key text, _ref text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s record; m text; n int; used int;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> _uid AND NOT public.is_account_admin(auth.uid()) THEN RETURN false; END IF;
  IF public.is_account_admin(_uid) THEN RETURN true; END IF;
  SELECT sb.*, p.role AS prole INTO s FROM public.subscriptions sb JOIN public.plans p ON p.id = sb.plan_id WHERE sb.user_id = _uid;
  IF s IS NULL OR s.status = 'ended' OR (s.term_end IS NOT NULL AND s.term_end < now()) THEN RETURN false; END IF;
  SELECT mode, per_term INTO m, n FROM public.plan_reports WHERE plan_id = s.plan_id AND report_key = _report_key;
  IF m IS NULL OR m = 'none' THEN RETURN false; END IF;
  IF m IN ('unlimited','contract') THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM public.plan_usage WHERE user_id=_uid AND kind='report:'||_report_key AND ref=_ref AND term_start=s.term_start) THEN RETURN true; END IF;
  SELECT count(*) INTO used FROM public.plan_usage WHERE user_id=_uid AND kind='report:'||_report_key AND term_start=s.term_start;
  RETURN used < COALESCE(n, 0);
END $$;

CREATE OR REPLACE FUNCTION public.record_report_open(_uid uuid, _report_key text, _ref text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE ts timestamptz;
BEGIN
  IF NOT public.can_open_report(_uid, _report_key, _ref) THEN RETURN false; END IF;
  ts := public.current_term_start(_uid);
  IF ts IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.plan_usage WHERE user_id=_uid AND kind='report:'||_report_key AND ref=_ref AND term_start=ts) THEN
    INSERT INTO public.plan_usage (user_id, kind, ref, term_start) VALUES (_uid, 'report:'||_report_key, _ref, ts);
  END IF;
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.record_report_open(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_report_open(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_open_report(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_term_start(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.current_term_start(uuid) FROM PUBLIC, anon, authenticated;

-- Seller asking price above the plan's cap is refused on save.
CREATE OR REPLACE FUNCTION public.tg_asking_price_cap() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE cap numeric; pname text;
BEGIN
  IF NEW.asking_price IS NULL OR auth.uid() IS NULL OR public.is_account_admin(auth.uid()) THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.asking_price IS NOT DISTINCT FROM OLD.asking_price THEN RETURN NEW; END IF;
  SELECT p.value_cap_thb_m, p.name INTO cap, pname FROM public.subscriptions s JOIN public.plans p ON p.id = s.plan_id WHERE s.user_id = auth.uid() AND p.role = 'seller';
  IF cap IS NOT NULL AND NEW.asking_price > cap THEN
    RAISE EXCEPTION 'Your % plan covers asking prices up to ฿%M. Upgrade to list at a higher price.', pname, cap USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER asking_price_cap BEFORE INSERT OR UPDATE OF asking_price ON public.hidden_profiles FOR EACH ROW EXECUTE FUNCTION public.tg_asking_price_cap();