CREATE TABLE public.seller_report_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_company_id uuid REFERENCES public.startups(id) ON DELETE SET NULL,
  share_panel_hidden boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.seller_report_prefs TO authenticated;
GRANT ALL ON public.seller_report_prefs TO service_role;
ALTER TABLE public.seller_report_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prefs read" ON public.seller_report_prefs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own prefs insert" ON public.seller_report_prefs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own prefs update" ON public.seller_report_prefs FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());