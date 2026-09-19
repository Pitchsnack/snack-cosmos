CREATE TABLE public.listed_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker text NOT NULL,
  name text NOT NULL,
  market public.peer_market NOT NULL,
  sector text,
  revenue_thb_m numeric,
  ebitda_margin_pct numeric,
  ev_ebitda numeric,
  pe numeric,
  pbv numeric,
  as_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX listed_companies_ticker_key ON public.listed_companies (upper(ticker));

CREATE TABLE public.peer_set_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  peer_set_id uuid NOT NULL REFERENCES public.peer_sets(id) ON DELETE CASCADE,
  listed_company_id uuid NOT NULL REFERENCES public.listed_companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (peer_set_id, listed_company_id)
);

CREATE INDEX peer_set_members_set_idx ON public.peer_set_members(peer_set_id);
CREATE INDEX peer_set_members_company_idx ON public.peer_set_members(listed_company_id);

INSERT INTO public.listed_companies (ticker, name, market, revenue_thb_m, ebitda_margin_pct, ev_ebitda, pe, pbv, as_at)
SELECT DISTINCT ON (upper(coalesce(nullif(trim(p.ticker), ''), p.company_name)))
  coalesce(nullif(trim(p.ticker), ''), p.company_name),
  p.company_name, p.market, p.revenue_thb_m, p.ebitda_margin_pct, p.ev_ebitda, p.pe, p.pbv, current_date
FROM public.peers p
ORDER BY upper(coalesce(nullif(trim(p.ticker), ''), p.company_name)), p.created_at;

INSERT INTO public.peer_set_members (peer_set_id, listed_company_id)
SELECT DISTINCT p.peer_set_id, lc.id
FROM public.peers p
JOIN public.listed_companies lc
  ON upper(lc.ticker) = upper(coalesce(nullif(trim(p.ticker), ''), p.company_name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.listed_companies TO authenticated;
GRANT ALL ON public.listed_companies TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.peer_set_members TO authenticated;
GRANT ALL ON public.peer_set_members TO service_role;

ALTER TABLE public.listed_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peer_set_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "listed_companies readable by authenticated"
  ON public.listed_companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "listed_companies writable by control"
  ON public.listed_companies FOR ALL TO authenticated
  USING (public.is_control(auth.uid()))
  WITH CHECK (public.is_control(auth.uid()));

CREATE POLICY "peer_set_members readable by authenticated"
  ON public.peer_set_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "peer_set_members writable by control"
  ON public.peer_set_members FOR ALL TO authenticated
  USING (public.is_control(auth.uid()))
  WITH CHECK (public.is_control(auth.uid()));