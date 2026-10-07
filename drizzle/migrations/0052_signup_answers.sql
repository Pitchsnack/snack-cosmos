CREATE TABLE public.signup_answers (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('seller','buyer','advisor')),
  first_answer text NOT NULL,
  first_name text, last_name text,
  provider text,
  terms_accepted_at timestamptz,
  news_opt_in boolean NOT NULL DEFAULT false,
  company jsonb,
  profile_id text,
  done_at timestamptz,
  welcome_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.signup_answers TO authenticated;
GRANT ALL ON public.signup_answers TO service_role;
ALTER TABLE public.signup_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own sign-up answers readable" ON public.signup_answers FOR SELECT TO authenticated USING (user_id = auth.uid());

ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS company_size_band text
  CHECK (company_size_band IS NULL OR company_size_band IN ('1-10','11-50','51-200','201-500','500+'));