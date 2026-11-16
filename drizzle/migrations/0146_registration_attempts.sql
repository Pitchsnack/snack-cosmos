CREATE TABLE public.registration_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reg_no text NOT NULL,
  user_id uuid,
  email text,
  profile_kind text CHECK (profile_kind IN ('seller','buyer','advisor')),
  profile_id uuid,
  source text NOT NULL CHECK (source IN ('signup','add')),
  session_key text,
  company_name text,
  result text NOT NULL DEFAULT 'pending' CHECK (result IN ('pending','yes','no','not_found','limit','cancelled')),
  held jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.registration_attempts TO authenticated;
GRANT ALL ON public.registration_attempts TO service_role;
ALTER TABLE public.registration_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Control reads registration attempts" ON public.registration_attempts FOR SELECT TO authenticated USING (public.is_control(auth.uid()));
CREATE INDEX registration_attempts_profile ON public.registration_attempts (profile_id, created_at);
CREATE INDEX registration_attempts_user ON public.registration_attempts (user_id, created_at);
CREATE INDEX registration_attempts_session ON public.registration_attempts (session_key);