-- Approval is the only source of truth for buyer visibility. The legacy status
-- column is derived from approval_status so no code path can set it on its own.
CREATE OR REPLACE FUNCTION public.tg_derive_listing_status() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.status := CASE
    WHEN COALESCE(NEW.approval_status, 'draft') IN ('live', 'live_edits_pending') THEN 'live'
    WHEN COALESCE(NEW.approval_status, 'draft') = 'in_review' AND NEW.live IS NOT NULL THEN 'live'
    ELSE 'draft'
  END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS derive_listing_status ON public.hidden_profiles;
CREATE TRIGGER derive_listing_status BEFORE INSERT OR UPDATE ON public.hidden_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_derive_listing_status();

-- Only Admin can approve: a seller can never move a listing into a live state.
CREATE OR REPLACE FUNCTION public.tg_guard_listing_approval() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_control(auth.uid()) THEN RETURN NEW; END IF;
  IF NEW.live IS DISTINCT FROM OLD.live AND NEW.live IS NOT NULL THEN
    RAISE EXCEPTION 'Only Admin can publish a listing';
  END IF;
  IF NEW.approval_status IN ('live','live_edits_pending','changes_requested','rejected')
     AND NEW.approval_status IS DISTINCT FROM OLD.approval_status
     AND NOT (NEW.approval_status = 'live_edits_pending' AND OLD.approval_status IN ('live','in_review')) THEN
    RAISE EXCEPTION 'Only Admin can make this decision';
  END IF;
  IF NEW.decision_note IS DISTINCT FROM OLD.decision_note OR NEW.decided_at IS DISTINCT FROM OLD.decided_at
     OR NEW.live_snapshot IS DISTINCT FROM OLD.live_snapshot AND NEW.live_snapshot IS NOT NULL THEN
    RAISE EXCEPTION 'Only Admin can make this decision';
  END IF;
  RETURN NEW;
END $$;