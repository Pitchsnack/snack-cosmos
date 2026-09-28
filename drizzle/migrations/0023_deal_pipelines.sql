CREATE TABLE public.deal_pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hidden_profile_id uuid NOT NULL REFERENCES public.hidden_profiles(id) ON DELETE CASCADE,
  startup_id uuid NOT NULL,
  buyer_user_id uuid NOT NULL,
  buyer_message text,
  status text NOT NULL DEFAULT 'active',
  nda_requested_at timestamptz NOT NULL DEFAULT now(),
  nda_approved_at timestamptz,
  report_requested_at timestamptz,
  report_shared_at timestamptz,
  loi_amount numeric,
  loi_exclusivity_days int,
  loi_conditions text,
  loi_sent_at timestamptz,
  loi_accepted_at timestamptz,
  contact_at timestamptz,
  legal_at timestamptz,
  spa_at timestamptz,
  payment_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hidden_profile_id, buyer_user_id)
);
GRANT SELECT ON public.deal_pipelines TO authenticated;
GRANT ALL ON public.deal_pipelines TO service_role;
ALTER TABLE public.deal_pipelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parties read pipeline" ON public.deal_pipelines FOR SELECT TO authenticated
USING (buyer_user_id = auth.uid() OR public.can_access_startup(auth.uid(), startup_id));
CREATE TRIGGER trg_deal_pipelines_updated BEFORE UPDATE ON public.deal_pipelines FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.deal_pipeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.deal_pipelines(id) ON DELETE CASCADE,
  event text NOT NULL,
  actor_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.deal_pipeline_events TO authenticated;
GRANT ALL ON public.deal_pipeline_events TO service_role;
ALTER TABLE public.deal_pipeline_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parties read pipeline events" ON public.deal_pipeline_events FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.deal_pipelines p WHERE p.id = pipeline_id
  AND (p.buyer_user_id = auth.uid() OR public.can_access_startup(auth.uid(), p.startup_id))));