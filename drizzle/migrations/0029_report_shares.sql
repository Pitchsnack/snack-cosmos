CREATE TABLE public.report_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.startups(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL,
  pipeline_id uuid REFERENCES public.deal_pipelines(id) ON DELETE SET NULL,
  financials boolean NOT NULL DEFAULT false,
  valuation boolean NOT NULL DEFAULT false,
  allow_download boolean NOT NULL DEFAULT false,
  shared_at timestamptz NOT NULL DEFAULT now(),
  shared_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  revoked_at timestamptz,
  revoked_by uuid
);
CREATE UNIQUE INDEX report_shares_one_active ON public.report_shares(business_id, buyer_id) WHERE revoked_at IS NULL;
GRANT ALL ON public.report_shares TO service_role;
ALTER TABLE public.report_shares ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.report_share_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id uuid NOT NULL REFERENCES public.report_shares(id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN ('shared','changed','revoked')),
  actor_id uuid,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.report_share_events TO service_role;
ALTER TABLE public.report_share_events ENABLE ROW LEVEL SECURITY;