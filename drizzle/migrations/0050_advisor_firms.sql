CREATE SEQUENCE IF NOT EXISTS public.advisor_firm_ref_seq START 1001;

CREATE TABLE public.advisor_firms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_no text NOT NULL UNIQUE DEFAULT ('ADV-' || lpad(nextval('public.advisor_firm_ref_seq')::text, 4, '0')),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  firm_type text NOT NULL,
  logo_path text,
  description text,
  year_founded int,
  city text,
  country text,
  services text[] NOT NULL DEFAULT '{}',
  deal_min_usd_m numeric,
  deal_max_usd_m numeric,
  team_size int,
  languages text[] NOT NULL DEFAULT '{}',
  sectors text[] NOT NULL DEFAULT '{}',
  legal_name text,
  thai_name text,
  registration_no text,
  addr_street text,
  addr_unit text,
  addr_subdistrict text,
  addr_district text,
  addr_province text,
  addr_postal text,
  website text,
  email text,
  phone text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','live','paused')),
  live_since timestamptz,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.advisor_firms TO authenticated;
GRANT ALL ON public.advisor_firms TO service_role;
ALTER TABLE public.advisor_firms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "advisor firms owner or control read" ON public.advisor_firms FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.is_control(auth.uid()));
CREATE POLICY "advisor firms owner insert" ON public.advisor_firms FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "advisor firms owner or control update" ON public.advisor_firms FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid() OR public.is_control(auth.uid()));
CREATE POLICY "advisor firms owner delete" ON public.advisor_firms FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.advisor_firm_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF NOT public.is_control(auth.uid()) AND auth.uid() IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      NEW.verified_at := NULL;
    ELSE
      IF NEW.verified_at IS DISTINCT FROM OLD.verified_at THEN NEW.verified_at := OLD.verified_at; END IF;
      IF NEW.legal_name IS DISTINCT FROM OLD.legal_name OR NEW.registration_no IS DISTINCT FROM OLD.registration_no THEN
        NEW.verified_at := NULL;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER advisor_firm_guard BEFORE INSERT OR UPDATE ON public.advisor_firms FOR EACH ROW EXECUTE FUNCTION public.advisor_firm_guard();

CREATE OR REPLACE FUNCTION public.can_manage_advisor_firm(_firm uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.advisor_firms f WHERE f.id = _firm AND (f.owner_user_id = auth.uid() OR public.is_control(auth.uid())));
$$;

CREATE TABLE public.advisor_firm_fees (
  firm_id uuid NOT NULL REFERENCES public.advisor_firms(id) ON DELETE CASCADE,
  service text NOT NULL,
  fee text NOT NULL,
  PRIMARY KEY (firm_id, service)
);
CREATE TABLE public.advisor_firm_team (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.advisor_firms(id) ON DELETE CASCADE,
  name text NOT NULL, role text, email text, sort_order int NOT NULL DEFAULT 0
);
CREATE TABLE public.advisor_firm_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.advisor_firms(id) ON DELETE CASCADE,
  name text NOT NULL, note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified')),
  checked_at timestamptz, sort_order int NOT NULL DEFAULT 0
);
CREATE TABLE public.advisor_firm_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.advisor_firms(id) ON DELETE CASCADE,
  file_path text NOT NULL, name text NOT NULL, doc_type text,
  checked_at timestamptz, valid_until date, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.advisor_firm_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.advisor_firms(id) ON DELETE CASCADE,
  client_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  client_role text NOT NULL CHECK (client_role IN ('seller','buyer')),
  client_detail text, service text,
  stars int NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment text, created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.advisor_firm_fees, public.advisor_firm_team, public.advisor_firm_credentials, public.advisor_firm_documents TO authenticated;
GRANT SELECT ON public.advisor_firm_reviews TO authenticated;
GRANT ALL ON public.advisor_firm_fees, public.advisor_firm_team, public.advisor_firm_credentials, public.advisor_firm_documents, public.advisor_firm_reviews TO service_role;

ALTER TABLE public.advisor_firm_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisor_firm_team ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisor_firm_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisor_firm_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisor_firm_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fees manage" ON public.advisor_firm_fees FOR ALL TO authenticated USING (public.can_manage_advisor_firm(firm_id)) WITH CHECK (public.can_manage_advisor_firm(firm_id));
CREATE POLICY "team manage" ON public.advisor_firm_team FOR ALL TO authenticated USING (public.can_manage_advisor_firm(firm_id)) WITH CHECK (public.can_manage_advisor_firm(firm_id));
CREATE POLICY "creds manage" ON public.advisor_firm_credentials FOR ALL TO authenticated USING (public.can_manage_advisor_firm(firm_id)) WITH CHECK (public.can_manage_advisor_firm(firm_id));
CREATE POLICY "docs manage" ON public.advisor_firm_documents FOR ALL TO authenticated USING (public.can_manage_advisor_firm(firm_id)) WITH CHECK (public.can_manage_advisor_firm(firm_id));
CREATE POLICY "reviews read" ON public.advisor_firm_reviews FOR SELECT TO authenticated USING (public.can_manage_advisor_firm(firm_id));

CREATE OR REPLACE FUNCTION public.advisor_child_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_control(auth.uid()) THEN
    IF TG_TABLE_NAME = 'advisor_firm_credentials' THEN
      IF TG_OP = 'INSERT' OR NEW.name IS DISTINCT FROM OLD.name OR NEW.note IS DISTINCT FROM OLD.note
         OR NEW.status IS DISTINCT FROM OLD.status OR NEW.checked_at IS DISTINCT FROM OLD.checked_at THEN
        NEW.status := 'pending'; NEW.checked_at := NULL;
      END IF;
    ELSIF TG_TABLE_NAME = 'advisor_firm_documents' THEN
      IF TG_OP = 'INSERT' THEN NEW.checked_at := NULL;
      ELSIF NEW.file_path IS DISTINCT FROM OLD.file_path THEN NEW.checked_at := NULL;
      ELSE NEW.checked_at := OLD.checked_at; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER advisor_cred_guard BEFORE INSERT OR UPDATE ON public.advisor_firm_credentials FOR EACH ROW EXECUTE FUNCTION public.advisor_child_guard();
CREATE TRIGGER advisor_doc_guard BEFORE INSERT OR UPDATE ON public.advisor_firm_documents FOR EACH ROW EXECUTE FUNCTION public.advisor_child_guard();