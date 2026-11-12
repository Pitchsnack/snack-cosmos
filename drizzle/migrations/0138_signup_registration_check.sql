ALTER TABLE public.signup_answers
  ADD COLUMN IF NOT EXISTS pending jsonb,
  ADD COLUMN IF NOT EXISTS reg_no text,
  ADD COLUMN IF NOT EXISTS reg_changes int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reg_tried text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS reg_reason text,
  ADD COLUMN IF NOT EXISTS reg_check jsonb,
  ADD COLUMN IF NOT EXISTS registered_at timestamptz;

ALTER TABLE public.contact_enquiries
  ADD COLUMN IF NOT EXISTS setup_reason text,
  ADD COLUMN IF NOT EXISTS reg_tried text[];

CREATE TABLE public.signup_reg_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text NOT NULL,
  device_hash text,
  ip_hash text,
  reg_no text NOT NULL,
  result text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.signup_reg_checks TO service_role;
ALTER TABLE public.signup_reg_checks ENABLE ROW LEVEL SECURITY;
CREATE INDEX signup_reg_checks_email_idx ON public.signup_reg_checks (email);
CREATE INDEX signup_reg_checks_device_idx ON public.signup_reg_checks (device_hash, created_at);

-- Sign-up "Yes": stores the one register fetch under the confirmed number. Server-only.
CREATE OR REPLACE FUNCTION public.dbd_store_save_signup(_user uuid, _reg text, _data jsonb, _raw jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF _reg !~ '^\d{13}$' THEN RAISE EXCEPTION 'A 13-digit registration number is required'; END IF;
  PERFORM set_config('app.dbd_write', 'on', true);
  IF EXISTS (SELECT 1 FROM dbd_company_records WHERE registration_number = _reg) THEN RETURN; END IF;
  INSERT INTO dbd_company_records (registration_number, source, source_note, data, raw_payload, retrieved_at, retrieved_by, entered_by_name, updated_at)
  VALUES (_reg, 'dbd', 'Sign-up check', _data, _raw, now(), _user, 'Sign-up check', now());
  INSERT INTO dbd_fetch_logs (registration_number, action, result, actor_id, source, new_retrieved_at, note)
  VALUES (_reg, 'extract', 'ok', _user, 'dbd', now(), 'Sign-up check');
END $$;
REVOKE ALL ON FUNCTION public.dbd_store_save_signup(uuid, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dbd_store_save_signup(uuid, text, jsonb, jsonb) TO service_role;