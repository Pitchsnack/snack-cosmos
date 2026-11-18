ALTER TABLE public.hidden_profiles
  ADD COLUMN identity_notice_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.buyer_profiles
  ADD COLUMN identity_review_original jsonb;

COMMENT ON COLUMN public.hidden_profiles.identity_notice_count IS 'Number of Admin identity-review changes resolved in the approved version; cleared by the next seller listing edit.';
COMMENT ON COLUMN public.buyer_profiles.identity_review_original IS 'Server-only baseline of public buyer description fields for the current identity review.';

CREATE TABLE public.identity_review_fixes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type text NOT NULL CHECK (item_type IN ('listing', 'buyer_profile')),
  item_id uuid NOT NULL,
  version integer NOT NULL DEFAULT 1,
  finding_id text NOT NULL,
  field text NOT NULL,
  reason text NOT NULL,
  old_value text,
  new_value text,
  admin_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.identity_review_fixes TO service_role;

ALTER TABLE public.identity_review_fixes ENABLE ROW LEVEL SECURITY;

CREATE INDEX identity_review_fixes_item_idx
  ON public.identity_review_fixes (item_type, item_id, version, created_at);

COMMENT ON TABLE public.identity_review_fixes IS 'Private server-only audit of Admin identity-review edits; no client read or write policies.'