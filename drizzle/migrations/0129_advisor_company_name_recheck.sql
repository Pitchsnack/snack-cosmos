CREATE OR REPLACE FUNCTION public.advisor_company_name_recheck() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_control(auth.uid()) OR current_setting('app.advisor_move', true) = '1' THEN RETURN NEW; END IF;
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    IF OLD.advisor_verification = 'verified' THEN
      NEW.advisor_verification := 'pending';
      NEW.verification_reason := 're_check';
      NEW.verification_requested_at := now();
    ELSIF OLD.advisor_verification = 'more_info' AND 'Legal name' = ANY(OLD.more_info_fields) THEN
      NEW.advisor_verification := 'pending';
      NEW.verification_reason := CASE WHEN OLD.verified_at IS NOT NULL THEN 're_check' ELSE 'first_check' END;
      NEW.verification_requested_at := now();
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER zz_advisor_company_name_recheck BEFORE UPDATE ON public.advisor_firms FOR EACH ROW EXECUTE FUNCTION public.advisor_company_name_recheck();