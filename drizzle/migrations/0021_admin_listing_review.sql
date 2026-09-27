ALTER TABLE public.hidden_profiles
  ADD COLUMN IF NOT EXISTS pending_cover text,
  ADD COLUMN IF NOT EXISTS directory_category text,
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS new_until timestamptz,
  ADD COLUMN IF NOT EXISTS notify_admin_edits boolean NOT NULL DEFAULT true;

CREATE TABLE public.listing_admin_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hidden_profile_id uuid NOT NULL REFERENCES public.hidden_profiles(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 0,
  field text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  admin_id uuid NOT NULL,
  undone_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.listing_admin_edits TO authenticated;
GRANT ALL ON public.listing_admin_edits TO service_role;
ALTER TABLE public.listing_admin_edits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read admin edits" ON public.listing_admin_edits FOR SELECT TO authenticated
  USING (public.is_control(auth.uid()));

CREATE TABLE public.listing_image_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL,
  label text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.listing_image_library TO authenticated;
GRANT ALL ON public.listing_image_library TO service_role;
ALTER TABLE public.listing_image_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read image library" ON public.listing_image_library FOR SELECT TO authenticated
  USING (public.is_control(auth.uid()));

CREATE OR REPLACE FUNCTION public.tg_guard_listing_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.is_control(auth.uid()) THEN RETURN NEW; END IF;
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
  IF NEW.cover_image_url IS DISTINCT FROM OLD.cover_image_url OR NEW.pending_cover IS DISTINCT FROM OLD.pending_cover
     OR NEW.featured IS DISTINCT FROM OLD.featured OR NEW.new_until IS DISTINCT FROM OLD.new_until
     OR NEW.directory_category IS DISTINCT FROM OLD.directory_category THEN
    RAISE EXCEPTION 'Only Admin can set the public image and directory placement';
  END IF;
  RETURN NEW;
END $function$;