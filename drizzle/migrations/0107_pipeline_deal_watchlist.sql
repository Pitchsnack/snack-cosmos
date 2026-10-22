CREATE TABLE public.deal_watchlist (
 user_id uuid NOT NULL,
 deal_id uuid NOT NULL REFERENCES public.deal_pipelines(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (user_id, deal_id)
);
GRANT SELECT, INSERT, DELETE ON public.deal_watchlist TO authenticated;
GRANT ALL ON public.deal_watchlist TO service_role;
ALTER TABLE public.deal_watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY deal_watchlist_read ON public.deal_watchlist FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY deal_watchlist_delete ON public.deal_watchlist FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY deal_watchlist_insert ON public.deal_watchlist FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.deal_pipelines p WHERE p.id = deal_id AND p.status NOT IN ('ended','declined','withdrawn','revoked') AND (p.buyer_user_id = auth.uid() OR public.is_startup_member(auth.uid(), p.startup_id) OR EXISTS (SELECT 1 FROM public.startup_ownership o WHERE o.startup_id = p.startup_id AND o.owning_agent_user_id = auth.uid()))));
COMMENT ON TABLE public.deal_watchlist IS 'Private per-user Pipeline stars. NDA requests already use the same deal_pipelines id retained on approval.';