CREATE TABLE public.saved_listings (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hidden_profile_id uuid NOT NULL REFERENCES public.hidden_profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, hidden_profile_id)
);
GRANT SELECT, INSERT, DELETE ON public.saved_listings TO authenticated;
GRANT ALL ON public.saved_listings TO service_role;
ALTER TABLE public.saved_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own saved listings read" ON public.saved_listings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own saved listings insert" ON public.saved_listings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own saved listings delete" ON public.saved_listings FOR DELETE TO authenticated USING (auth.uid() = user_id);