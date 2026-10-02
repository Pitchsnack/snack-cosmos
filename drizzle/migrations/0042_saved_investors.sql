CREATE TABLE public.saved_investors (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  investor_id uuid NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, investor_id)
);
GRANT SELECT, INSERT, DELETE ON public.saved_investors TO authenticated;
GRANT ALL ON public.saved_investors TO service_role;
ALTER TABLE public.saved_investors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own saved investors read" ON public.saved_investors FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own saved investors insert" ON public.saved_investors FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own saved investors delete" ON public.saved_investors FOR DELETE TO authenticated USING (auth.uid() = user_id);