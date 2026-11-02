ALTER TABLE public.advisor_firm_credentials ADD COLUMN licence_key text NOT NULL DEFAULT 'other';
ALTER TABLE public.advisor_firm_credentials ADD CONSTRAINT advisor_licence_key_valid CHECK (licence_key IN ('cpa','ca','ta','sec_auditor','bookkeeper','cfa','cfp','investment_consultant','investment_planner','investment_analyst','fund_manager','sec_financial_advisor','fa_supervisor','investment_advisory','lawyer','notarial_attorney','thai_barrister','patent_agent','sec_valuation_company','sec_chief_valuer','tgo_verifier','other'));
COMMENT ON COLUMN public.advisor_firm_credentials.licence_key IS 'Stable bilingual catalogue key; legacy free-text credentials remain other.';
CREATE OR REPLACE FUNCTION public.advisor_child_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE fid uuid; field text; changed boolean := false;
BEGIN
  IF auth.uid() IS NULL OR public.is_control(auth.uid()) THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  fid := CASE WHEN TG_OP = 'DELETE' THEN OLD.firm_id ELSE NEW.firm_id END;
  IF TG_TABLE_NAME = 'advisor_firm_credentials' THEN
    field := 'Licences and credentials';
    IF TG_OP = 'INSERT' THEN NEW.status := 'pending'; NEW.checked_at := NULL; NEW.checked_by := NULL; changed := true;
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.name IS DISTINCT FROM OLD.name OR NEW.note IS DISTINCT FROM OLD.note OR NEW.licence_key IS DISTINCT FROM OLD.licence_key THEN
        NEW.status := 'pending'; NEW.checked_at := NULL; NEW.checked_by := NULL; changed := true;
      ELSE NEW.status := OLD.status; NEW.checked_at := OLD.checked_at; NEW.checked_by := OLD.checked_by; END IF;
    ELSE changed := true; END IF;
  ELSE
    field := 'Documents';
    IF TG_OP = 'INSERT' THEN NEW.checked_at := NULL; NEW.checked_by := NULL; changed := true;
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.file_path IS DISTINCT FROM OLD.file_path THEN NEW.checked_at := NULL; NEW.checked_by := NULL; changed := true;
      ELSE NEW.checked_at := OLD.checked_at; NEW.checked_by := OLD.checked_by; END IF;
    ELSE changed := true; END IF;
  END IF;
  IF changed THEN PERFORM public.advisor_child_move(fid, field); END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $function$;