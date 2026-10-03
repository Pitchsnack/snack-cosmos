ALTER TABLE public.buyer_profiles
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS decided_by uuid,
  ADD COLUMN IF NOT EXISTS decision_note text;
UPDATE public.buyer_profiles SET approval_status = 'approved' WHERE status IN ('live','paused');
ALTER TABLE public.buyer_profiles ADD CONSTRAINT buyer_profiles_approval_status_check
  CHECK (approval_status IN ('draft','in_review','changes_requested','approved','declined'));