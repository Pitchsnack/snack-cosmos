ALTER TABLE public.hidden_profiles
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_by uuid,
  ADD COLUMN IF NOT EXISTS decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS decision_note text,
  ADD COLUMN IF NOT EXISTS decision_reasons text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS decision_fields text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS assignee_id uuid,
  ADD COLUMN IF NOT EXISTS live_snapshot jsonb;

UPDATE public.hidden_profiles SET approval_status = 'live' WHERE status = 'live';

CREATE TABLE public.listing_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hidden_profile_id uuid NOT NULL REFERENCES public.hidden_profiles(id) ON DELETE CASCADE,
  startup_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  submitted_by uuid NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hidden_profile_id, version)
);
GRANT SELECT, INSERT ON public.listing_submissions TO authenticated;
GRANT ALL ON public.listing_submissions TO service_role;
ALTER TABLE public.listing_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners and admins read submissions" ON public.listing_submissions FOR SELECT TO authenticated
  USING (public.can_access_startup(auth.uid(), startup_id) OR public.is_control(auth.uid()));
CREATE POLICY "Managers submit" ON public.listing_submissions FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_startup(auth.uid(), tenant_id) AND submitted_by = auth.uid());

CREATE TABLE public.approval_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type text NOT NULL,
  item_id uuid NOT NULL,
  startup_id uuid,
  subject_user_id uuid,
  version integer,
  action text NOT NULL,
  actor_id uuid NOT NULL,
  note text,
  reasons text[] NOT NULL DEFAULT '{}',
  fields text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.approval_events TO authenticated;
GRANT ALL ON public.approval_events TO service_role;
ALTER TABLE public.approval_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own or admin events" ON public.approval_events FOR SELECT TO authenticated
  USING (public.is_control(auth.uid()) OR subject_user_id = auth.uid() OR actor_id = auth.uid()
    OR (startup_id IS NOT NULL AND public.can_access_startup(auth.uid(), startup_id)));
CREATE POLICY "Actors log events" ON public.approval_events FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

CREATE TABLE public.buyer_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  company_name text NOT NULL,
  buyer_type text,
  registration_no text,
  work_email text NOT NULL,
  website text,
  linkedin text,
  documents text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  email_domain_match boolean,
  decision_note text,
  assignee_id uuid,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.buyer_verifications TO authenticated;
GRANT ALL ON public.buyer_verifications TO service_role;
ALTER TABLE public.buyer_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own or admin read" ON public.buyer_verifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_control(auth.uid()));
CREATE POLICY "Own insert" ON public.buyer_verifications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');
CREATE POLICY "Own resubmit or admin update" ON public.buyer_verifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_control(auth.uid()))
  WITH CHECK (public.is_control(auth.uid()) OR (user_id = auth.uid() AND status = 'pending'));