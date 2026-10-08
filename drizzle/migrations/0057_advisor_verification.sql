ALTER TABLE public.advisor_firms
  ADD COLUMN IF NOT EXISTS advisor_verification text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verification_reason text,
  ADD COLUMN IF NOT EXISTS verification_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_admin_id uuid,
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS verified_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS more_info_note text,
  ADD COLUMN IF NOT EXISTS more_info_fields text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS more_info_at timestamptz,
  ADD COLUMN IF NOT EXISTS more_info_by uuid,
  ADD COLUMN IF NOT EXISTS decline_reason text,
  ADD COLUMN IF NOT EXISTS decline_note text,
  ADD COLUMN IF NOT EXISTS declined_at timestamptz,
  ADD COLUMN IF NOT EXISTS declined_by uuid,
  ADD COLUMN IF NOT EXISTS review_checklist text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dbd_name text,
  ADD COLUMN IF NOT EXISTS dbd_status text,
  ADD COLUMN IF NOT EXISTS dbd_registered_on date,
  ADD COLUMN IF NOT EXISTS dbd_capital numeric,
  ADD COLUMN IF NOT EXISTS dbd_checked_at timestamptz;

ALTER TABLE public.advisor_firms ADD CONSTRAINT advisor_firms_verification_check
  CHECK (advisor_verification IN ('unverified','pending','verified','more_info','declined'));
ALTER TABLE public.advisor_firms ADD CONSTRAINT advisor_firms_verification_reason_check
  CHECK (verification_reason IS NULL OR verification_reason IN ('first_check','re_check'));

ALTER TABLE public.advisor_firm_credentials DROP CONSTRAINT advisor_firm_credentials_status_check;
ALTER TABLE public.advisor_firm_credentials ADD CONSTRAINT advisor_firm_credentials_status_check CHECK (status IN ('pending','verified','rejected'));
ALTER TABLE public.advisor_firm_credentials ADD COLUMN IF NOT EXISTS checked_by uuid;
ALTER TABLE public.advisor_firm_documents ADD COLUMN IF NOT EXISTS checked_by uuid;

-- Backfill existing firms.
UPDATE public.advisor_firms f SET advisor_verification = 'verified',
  verified_snapshot = jsonb_build_object('legal_name', f.legal_name, 'registration_no', f.registration_no,
    'credentials', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'note', c.note)) FROM public.advisor_firm_credentials c WHERE c.firm_id = f.id), '[]'::jsonb),
    'documents', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'file_path', d.file_path)) FROM public.advisor_firm_documents d WHERE d.firm_id = f.id), '[]'::jsonb))
  WHERE f.verified_at IS NOT NULL;
UPDATE public.advisor_firms SET advisor_verification = 'pending', verification_reason = 'first_check', verification_requested_at = now()
  WHERE verified_at IS NULL AND setup_done_at IS NOT NULL;

-- Firm saves move verification only as the rules say; only Admin writes the verification fields.
CREATE OR REPLACE FUNCTION public.advisor_firm_guard()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE asked text[];
BEGIN
  NEW.updated_at := now();
  IF auth.uid() IS NULL OR public.is_control(auth.uid()) THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.verified_at := NULL; NEW.verified_by := NULL; NEW.verified_snapshot := NULL;
    NEW.advisor_verification := 'unverified'; NEW.verification_reason := NULL; NEW.verification_requested_at := NULL;
    NEW.assigned_admin_id := NULL; NEW.more_info_note := NULL; NEW.more_info_fields := '{}'; NEW.more_info_at := NULL; NEW.more_info_by := NULL;
    NEW.decline_reason := NULL; NEW.decline_note := NULL; NEW.declined_at := NULL; NEW.declined_by := NULL; NEW.review_checklist := '{}';
    NEW.dbd_name := NULL; NEW.dbd_status := NULL; NEW.dbd_registered_on := NULL; NEW.dbd_capital := NULL; NEW.dbd_checked_at := NULL;
    RETURN NEW;
  END IF;
  -- Keep every Admin-only field as it was.
  NEW.verified_at := OLD.verified_at; NEW.verified_by := OLD.verified_by; NEW.verified_snapshot := OLD.verified_snapshot;
  NEW.advisor_verification := OLD.advisor_verification; NEW.verification_reason := OLD.verification_reason;
  NEW.verification_requested_at := OLD.verification_requested_at; NEW.assigned_admin_id := OLD.assigned_admin_id;
  NEW.more_info_note := OLD.more_info_note; NEW.more_info_fields := OLD.more_info_fields; NEW.more_info_at := OLD.more_info_at; NEW.more_info_by := OLD.more_info_by;
  NEW.decline_reason := OLD.decline_reason; NEW.decline_note := OLD.decline_note; NEW.declined_at := OLD.declined_at; NEW.declined_by := OLD.declined_by;
  NEW.review_checklist := OLD.review_checklist;
  NEW.dbd_name := OLD.dbd_name; NEW.dbd_status := OLD.dbd_status; NEW.dbd_registered_on := OLD.dbd_registered_on; NEW.dbd_capital := OLD.dbd_capital; NEW.dbd_checked_at := OLD.dbd_checked_at;
  -- A declined firm can't publish.
  IF OLD.advisor_verification = 'declined' AND NEW.status = 'live' AND OLD.status <> 'live' THEN
    RAISE EXCEPTION 'PitchSnack declined this firm. Write to support@pitchsnack.com.';
  END IF;
  -- The moves.
  IF OLD.advisor_verification = 'unverified' AND OLD.setup_done_at IS NULL AND NEW.setup_done_at IS NOT NULL THEN
    NEW.advisor_verification := 'pending'; NEW.verification_reason := 'first_check'; NEW.verification_requested_at := now();
  ELSIF OLD.advisor_verification = 'verified'
    AND (NEW.legal_name IS DISTINCT FROM OLD.legal_name OR NEW.registration_no IS DISTINCT FROM OLD.registration_no) THEN
    NEW.advisor_verification := 'pending'; NEW.verification_reason := 're_check'; NEW.verification_requested_at := now();
  ELSIF OLD.advisor_verification = 'more_info' THEN
    asked := OLD.more_info_fields;
    IF ('Legal name' = ANY(asked) AND NEW.legal_name IS DISTINCT FROM OLD.legal_name)
      OR ('Registration number' = ANY(asked) AND NEW.registration_no IS DISTINCT FROM OLD.registration_no)
      OR ('Business address' = ANY(asked) AND (NEW.addr_street, NEW.addr_unit, NEW.addr_subdistrict, NEW.addr_district, NEW.addr_province, NEW.addr_postal) IS DISTINCT FROM (OLD.addr_street, OLD.addr_unit, OLD.addr_subdistrict, OLD.addr_district, OLD.addr_province, OLD.addr_postal))
      OR ('Website' = ANY(asked) AND NEW.website IS DISTINCT FROM OLD.website)
      OR ('Email and phone' = ANY(asked) AND (NEW.email, NEW.phone) IS DISTINCT FROM (OLD.email, OLD.phone))
      OR ('Services and fees' = ANY(asked) AND NEW.services IS DISTINCT FROM OLD.services) THEN
      NEW.advisor_verification := 'pending'; NEW.verification_requested_at := now();
      NEW.verification_reason := CASE WHEN OLD.verified_at IS NOT NULL THEN 're_check' ELSE 'first_check' END;
    END IF;
  END IF;
  RETURN NEW;
END $function$;

-- Licence/document changes by the firm: reset their marks, and move the firm (re-check or more info answered).
CREATE OR REPLACE FUNCTION public.advisor_child_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE fid uuid; f record; field text; changed boolean := false;
BEGIN
  IF auth.uid() IS NULL OR public.is_control(auth.uid()) THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  fid := CASE WHEN TG_OP = 'DELETE' THEN OLD.firm_id ELSE NEW.firm_id END;
  IF TG_TABLE_NAME = 'advisor_firm_credentials' THEN
    field := 'Licences and credentials';
    IF TG_OP = 'INSERT' THEN NEW.status := 'pending'; NEW.checked_at := NULL; NEW.checked_by := NULL; changed := true;
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.name IS DISTINCT FROM OLD.name OR NEW.note IS DISTINCT FROM OLD.note THEN
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
  IF changed THEN
    SELECT advisor_verification, verified_at, more_info_fields INTO f FROM public.advisor_firms WHERE id = fid;
    IF f.advisor_verification = 'verified' OR (f.advisor_verification = 'more_info' AND field = ANY(f.more_info_fields)) THEN
      UPDATE public.advisor_firms SET advisor_verification = 'pending', verification_requested_at = now(),
        verification_reason = CASE WHEN f.verified_at IS NOT NULL THEN 're_check' ELSE 'first_check' END
        WHERE id = fid;
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $function$;

CREATE TRIGGER advisor_cred_guard_del BEFORE DELETE ON public.advisor_firm_credentials FOR EACH ROW EXECUTE FUNCTION public.advisor_child_guard();
CREATE TRIGGER advisor_doc_guard_del BEFORE DELETE ON public.advisor_firm_documents FOR EACH ROW EXECUTE FUNCTION public.advisor_child_guard();