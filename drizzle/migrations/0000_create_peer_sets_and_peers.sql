CREATE TYPE public.peer_market AS ENUM ('SET', 'mai');

CREATE TABLE public.peer_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_tag text NOT NULL UNIQUE,
  last_refreshed_at timestamptz,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.peers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  peer_set_id uuid NOT NULL REFERENCES public.peer_sets(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  ticker text,
  market public.peer_market NOT NULL,
  revenue_thb_m numeric,
  ebitda_margin_pct numeric,
  ev_ebitda numeric,
  pe numeric,
  pbv numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (peer_set_id, company_name)
);

CREATE INDEX peers_peer_set_id_idx ON public.peers(peer_set_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.peer_sets TO authenticated;
GRANT ALL ON public.peer_sets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.peers TO authenticated;
GRANT ALL ON public.peers TO service_role;

ALTER TABLE public.peer_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "peer_sets readable by authenticated"
  ON public.peer_sets FOR SELECT TO authenticated USING (true);
CREATE POLICY "peer_sets writable by control"
  ON public.peer_sets FOR ALL TO authenticated
  USING (public.is_control(auth.uid()))
  WITH CHECK (public.is_control(auth.uid()));

CREATE POLICY "peers readable by authenticated"
  ON public.peers FOR SELECT TO authenticated USING (true);
CREATE POLICY "peers writable by control"
  ON public.peers FOR ALL TO authenticated
  USING (public.is_control(auth.uid()))
  WITH CHECK (public.is_control(auth.uid()));