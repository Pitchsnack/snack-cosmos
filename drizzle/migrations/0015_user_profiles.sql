CREATE TABLE public.user_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  title text, organisation text, bio text, city text, country text,
  website text, linkedin text, phone text,
  industry_focus text, functional_expertise text, buyer_type text, experience text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO service_role;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY up_select ON public.user_profiles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_control(auth.uid()));
CREATE POLICY up_insert ON public.user_profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY up_update ON public.user_profiles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.user_verifications (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  verified_at timestamptz NOT NULL DEFAULT now(),
  verified_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_verifications TO authenticated;
GRANT ALL ON public.user_verifications TO service_role;
ALTER TABLE public.user_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY uv_select ON public.user_verifications FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_control(auth.uid()));
CREATE POLICY uv_manage ON public.user_verifications FOR ALL TO authenticated USING (public.is_control(auth.uid())) WITH CHECK (public.is_control(auth.uid()));