CREATE OR REPLACE FUNCTION public.tg_guard_listing_approval() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_control(auth.uid()) THEN RETURN NEW; END IF;
  -- Sellers cannot approve themselves or change the live copy.
  IF NEW.live IS DISTINCT FROM OLD.live AND NEW.live IS NOT NULL THEN
    RAISE EXCEPTION 'Only Admin can publish a listing';
  END IF;
  IF NEW.status = 'live' AND OLD.status <> 'live' THEN
    RAISE EXCEPTION 'Only Admin can publish a listing';
  END IF;
  IF NEW.approval_status IN ('live','changes_requested','rejected') AND NEW.approval_status IS DISTINCT FROM OLD.approval_status
     AND NOT (NEW.approval_status = 'live' AND OLD.approval_status = 'live_edits_pending') THEN
    RAISE EXCEPTION 'Only Admin can make this decision';
  END IF;
  IF NEW.decision_note IS DISTINCT FROM OLD.decision_note OR NEW.decided_at IS DISTINCT FROM OLD.decided_at
     OR NEW.live_snapshot IS DISTINCT FROM OLD.live_snapshot AND NEW.live_snapshot IS NOT NULL THEN
    RAISE EXCEPTION 'Only Admin can make this decision';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_listing_approval BEFORE UPDATE ON public.hidden_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_guard_listing_approval();