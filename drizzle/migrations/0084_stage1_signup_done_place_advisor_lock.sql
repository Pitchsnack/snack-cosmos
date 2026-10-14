ALTER TABLE public.users ADD COLUMN IF NOT EXISTS signup_done_at timestamptz;
UPDATE public.users u SET signup_done_at = COALESCE(a.done_at, u.created_at, now())
FROM public.users u2 LEFT JOIN public.signup_answers a ON a.user_id = u2.id
WHERE u2.id = u.id AND u.signup_done_at IS NULL AND (a.user_id IS NULL OR a.profile_id IS NOT NULL);

ALTER TABLE public.hidden_profiles ALTER COLUMN code_name DROP NOT NULL;

-- A real sector answer: seller sector not blank; buyer/advisor a type other than the bare "other", a ticked Other sector, or Sector agnostic
CREATE OR REPLACE FUNCTION public.has_sector_answer(_picks jsonb, _agnostic boolean)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT COALESCE(_agnostic, false)
    OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(_picks->'types') = 'array' THEN _picks->'types' ELSE '[]'::jsonb END) t WHERE t <> 'other' AND btrim(t) <> '')
    OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(_picks->'other') = 'array' THEN _picks->'other' ELSE '[]'::jsonb END) s WHERE btrim(s) <> '')
$$;

CREATE OR REPLACE FUNCTION public.tg_mark_signup_done() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uids uuid[]; ok boolean;
BEGIN
  IF TG_TABLE_NAME = 'startups' THEN
    ok := NULLIF(btrim(COALESCE(NEW.sector, '')), '') IS NOT NULL OR NEW.setup_done_at IS NOT NULL;
    IF ok THEN SELECT array_agg(user_id) INTO uids FROM startup_users WHERE startup_id = NEW.id; END IF;
  ELSIF TG_TABLE_NAME = 'investors' THEN
    ok := public.has_sector_answer(NEW.sector_picks, 'Sector Agnostic' = ANY(COALESCE(NEW.preferred_industries, '{}'::text[]))) OR NEW.setup_done_at IS NOT NULL;
    IF ok THEN SELECT array_agg(user_id) INTO uids FROM buyer_profiles WHERE investor_id = NEW.id; END IF;
  ELSE
    ok := public.has_sector_answer(NEW.sector_picks, NEW.sector_agnostic) OR NEW.setup_done_at IS NOT NULL;
    IF ok THEN uids := ARRAY[NEW.owner_user_id]; END IF;
  END IF;
  IF ok AND uids IS NOT NULL THEN
    UPDATE users SET signup_done_at = now() WHERE id = ANY(uids) AND signup_done_at IS NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS mark_signup_done ON public.startups;
DROP TRIGGER IF EXISTS mark_signup_done ON public.investors;
DROP TRIGGER IF EXISTS mark_signup_done ON public.advisor_firms;
CREATE TRIGGER mark_signup_done AFTER INSERT OR UPDATE ON public.startups FOR EACH ROW EXECUTE FUNCTION public.tg_mark_signup_done();
CREATE TRIGGER mark_signup_done AFTER INSERT OR UPDATE ON public.investors FOR EACH ROW EXECUTE FUNCTION public.tg_mark_signup_done();
CREATE TRIGGER mark_signup_done AFTER INSERT OR UPDATE ON public.advisor_firms FOR EACH ROW EXECUTE FUNCTION public.tg_mark_signup_done();

CREATE OR REPLACE FUNCTION public.address_place(_country text, _province text, _district text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN COALESCE(_country,'Thailand') = 'Thailand' THEN NULLIF(btrim(_province),'')
              ELSE COALESCE(NULLIF(btrim(_province),''), NULLIF(btrim(_district),'')) END $$;

CREATE OR REPLACE FUNCTION public.tg_advisor_city_from_address()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE p text := public.address_place(NEW.country, NEW.addr_province, NEW.addr_district);
BEGIN
  IF p IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.addr_province IS DISTINCT FROM OLD.addr_province OR NEW.addr_district IS DISTINCT FROM OLD.addr_district OR NEW.country IS DISTINCT FROM OLD.country) THEN
    NEW.city := p;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS advisor_city_from_address ON public.advisor_firms;
CREATE TRIGGER advisor_city_from_address BEFORE INSERT OR UPDATE ON public.advisor_firms
FOR EACH ROW EXECUTE FUNCTION public.tg_advisor_city_from_address();

CREATE OR REPLACE FUNCTION public.tg_investor_city_from_address()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p text := public.address_place(NEW.country, NEW.address_province_state, NEW.address_city_district);
BEGIN
  IF p IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.address_province_state IS DISTINCT FROM OLD.address_province_state OR NEW.address_city_district IS DISTINCT FROM OLD.address_city_district OR NEW.country IS DISTINCT FROM OLD.country) THEN
    UPDATE public.buyer_profiles SET city = p WHERE investor_id = NEW.id AND city IS DISTINCT FROM p;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS investor_city_from_address ON public.investors;
CREATE TRIGGER investor_city_from_address AFTER INSERT OR UPDATE ON public.investors
FOR EACH ROW EXECUTE FUNCTION public.tg_investor_city_from_address();

REVOKE ALL ON public.advisor_firms FROM anon;

UPDATE public.startups SET setup_reached = 'price' WHERE setup_reached = 'lname';
UPDATE public.investors SET setup_reached = NULL WHERE setup_reached = 'loc';
UPDATE public.advisor_firms SET setup_reached = NULL WHERE setup_reached = 'loc';