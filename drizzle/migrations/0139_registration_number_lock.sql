ALTER TABLE public.startups ADD COLUMN IF NOT EXISTS reg_locked_at timestamptz;
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS reg_locked_at timestamptz;
ALTER TABLE public.advisor_firms ADD COLUMN IF NOT EXISTS reg_locked_at timestamptz;

-- A registration number confirmed at sign-up can only be changed by Control Admin or the server.
CREATE OR REPLACE FUNCTION public.guard_locked_registration()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE o text; n text;
BEGIN
  IF TG_TABLE_NAME = 'startups' THEN o := OLD.registered_number; n := NEW.registered_number;
  ELSE o := OLD.registration_no; n := NEW.registration_no; END IF;
  IF OLD.reg_locked_at IS NOT NULL AND (o IS DISTINCT FROM n OR NEW.reg_locked_at IS DISTINCT FROM OLD.reg_locked_at)
     AND coalesce(auth.role(), '') <> 'service_role' AND NOT public.is_control(auth.uid()) THEN
    RAISE EXCEPTION 'The registration number is locked. Only PitchSnack can change it.';
  END IF;
  IF OLD.reg_locked_at IS NULL AND NEW.reg_locked_at IS NOT NULL
     AND coalesce(auth.role(), '') <> 'service_role' AND NOT public.is_control(auth.uid()) THEN
    NEW.reg_locked_at := NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS zz_guard_locked_registration ON public.startups;
CREATE TRIGGER zz_guard_locked_registration BEFORE UPDATE ON public.startups FOR EACH ROW EXECUTE FUNCTION public.guard_locked_registration();
DROP TRIGGER IF EXISTS zz_guard_locked_registration ON public.investors;
CREATE TRIGGER zz_guard_locked_registration BEFORE UPDATE ON public.investors FOR EACH ROW EXECUTE FUNCTION public.guard_locked_registration();
DROP TRIGGER IF EXISTS zz_guard_locked_registration ON public.advisor_firms;
CREATE TRIGGER zz_guard_locked_registration BEFORE UPDATE ON public.advisor_firms FOR EACH ROW EXECUTE FUNCTION public.guard_locked_registration();