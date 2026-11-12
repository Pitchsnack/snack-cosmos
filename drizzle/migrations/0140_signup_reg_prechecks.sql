CREATE TABLE public.signup_reg_prechecks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  reg_no text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  result jsonb,
  check_row_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  done_at timestamptz
);
COMMENT ON TABLE public.signup_reg_prechecks IS 'Server-only: sign-up company check started before Create account; held until the email is confirmed, purged after 2 hours.';
GRANT ALL ON public.signup_reg_prechecks TO service_role;
ALTER TABLE public.signup_reg_prechecks ENABLE ROW LEVEL SECURITY;
CREATE INDEX signup_reg_prechecks_created_idx ON public.signup_reg_prechecks (created_at);
ALTER TABLE public.signup_reg_checks ALTER COLUMN email SET DEFAULT '';