ALTER TABLE public.profile_invitations ADD COLUMN IF NOT EXISTS prepared_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz, ADD COLUMN IF NOT EXISTS closed_at timestamptz;