ALTER TABLE public.startups
  ADD COLUMN IF NOT EXISTS peer_basis text NOT NULL DEFAULT 'sector'
  CHECK (peer_basis IN ('sector','chosen'));

CREATE TABLE IF NOT EXISTS public.startup_peer_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid NOT NULL REFERENCES public.startups(id) ON DELETE CASCADE,
  listed_company_id uuid NOT NULL REFERENCES public.listed_companies(id) ON DELETE CASCADE,
  chosen_by uuid,
  chosen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (startup_id, listed_company_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.startup_peer_selections TO authenticated;
GRANT ALL ON public.startup_peer_selections TO service_role;

ALTER TABLE public.startup_peer_selections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "peer selections readable with the startup"
  ON public.startup_peer_selections FOR SELECT TO authenticated
  USING (public.can_access_startup(auth.uid(), startup_id));

CREATE POLICY "peer selections writable by startup managers"
  ON public.startup_peer_selections FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.startups s WHERE s.id = startup_id AND public.can_manage_startup(auth.uid(), s.tenant_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.startups s WHERE s.id = startup_id AND public.can_manage_startup(auth.uid(), s.tenant_id)));

CREATE INDEX IF NOT EXISTS startup_peer_selections_startup_idx ON public.startup_peer_selections(startup_id);