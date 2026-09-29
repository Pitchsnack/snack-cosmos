ALTER TABLE public.deal_pipelines
  ADD COLUMN IF NOT EXISTS report_viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS report_allow_download boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nda_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS loi_stake_pct numeric,
  ADD COLUMN IF NOT EXISTS loi_accepted_by uuid,
  ADD COLUMN IF NOT EXISTS loi_consent_text text,
  ADD COLUMN IF NOT EXISTS loi_changes_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS exclusivity_until timestamptz;