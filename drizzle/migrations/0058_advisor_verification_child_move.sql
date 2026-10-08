CREATE OR REPLACE FUNCTION public.advisor_child_move(_fid uuid, _field text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE f record;
BEGIN
  SELECT advisor_verification, verified_at, more_info_fields INTO f FROM public.advisor_firms WHERE id = _fid;
  IF f.advisor_verification = 'verified' OR (f.advisor_verification = 'more_info' AND _field = ANY(f.more_info_fields)) THEN
    PERFORM set_config('app.advisor_move', '1', true);
    UPDATE public.advisor_firms SET advisor_verification = 'pending', verification_requested_at = now(),
      verification_reason = CASE WHEN f.verified_at IS NOT NULL THEN 're_check' ELSE 'first_check' END
      WHERE id = _fid;
    PERFORM set_config('app.advisor_move', '', true);
  END IF;
END $function$;
REVOKE EXECUTE ON FUNCTION public.advisor_child_move(uuid, text) FROM PUBLIC, anon, authenticated;

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
  IF changed THEN PERFORM public.advisor_child_move(fid, field); END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $function$;

CREATE OR REPLACE FUNCTION public.advisor_firm_guard()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE asked text[];
BEGIN
  NEW.updated_at := now();
  IF auth.uid() IS NULL OR public.is_control(auth.uid()) OR current_setting('app.advisor_move', true) = '1' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.verified_at := NULL; NEW.verified_by := NULL; NEW.verified_snapshot := NULL;
    NEW.advisor_verification := 'unverified'; NEW.verification_reason := NULL; NEW.verification_requested_at := NULL;
    NEW.assigned_admin_id := NULL; NEW.more_info_note := NULL; NEW.more_info_fields := '{}'; NEW.more_info_at := NULL; NEW.more_info_by := NULL;
    NEW.decline_reason := NULL; NEW.decline_note := NULL; NEW.declined_at := NULL; NEW.declined_by := NULL; NEW.review_checklist := '{}';
    NEW.dbd_name := NULL; NEW.dbd_status := NULL; NEW.dbd_registered_on := NULL; NEW.dbd_capital := NULL; NEW.dbd_checked_at := NULL;
    RETURN NEW;
  END IF;
  NEW.verified_at := OLD.verified_at; NEW.verified_by := OLD.verified_by; NEW.verified_snapshot := OLD.verified_snapshot;
  NEW.advisor_verification := OLD.advisor_verification; NEW.verification_reason := OLD.verification_reason;
  NEW.verification_requested_at := OLD.verification_requested_at; NEW.assigned_admin_id := OLD.assigned_admin_id;
  NEW.more_info_note := OLD.more_info_note; NEW.more_info_fields := OLD.more_info_fields; NEW.more_info_at := OLD.more_info_at; NEW.more_info_by := OLD.more_info_by;
  NEW.decline_reason := OLD.decline_reason; NEW.decline_note := OLD.decline_note; NEW.declined_at := OLD.declined_at; NEW.declined_by := OLD.declined_by;
  NEW.review_checklist := OLD.review_checklist;
  NEW.dbd_name := OLD.dbd_name; NEW.dbd_status := OLD.dbd_status; NEW.dbd_registered_on := OLD.dbd_registered_on; NEW.dbd_capital := OLD.dbd_capital; NEW.dbd_checked_at := OLD.dbd_checked_at;
  IF OLD.advisor_verification = 'declined' AND NEW.status = 'live' AND OLD.status <> 'live' THEN
    RAISE EXCEPTION 'PitchSnack declined this firm. Write to support@pitchsnack.com.';
  END IF;
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