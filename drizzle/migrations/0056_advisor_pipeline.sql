ALTER TABLE public.deal_pipelines ADD COLUMN IF NOT EXISTS wait_kind text NOT NULL DEFAULT 'decision';
ALTER TABLE public.deal_pipelines ADD COLUMN IF NOT EXISTS wait_task text;

CREATE TABLE public.advisor_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deal_pipelines(id) ON DELETE CASCADE,
  side text NOT NULL CHECK (side IN ('seller','buyer')),
  client_org_id uuid,
  firm_profile_id uuid NOT NULL REFERENCES public.advisor_firms(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL,
  invited_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','joined','declined','withdrawn')),
  answered_by uuid,
  answered_at timestamptz
);
CREATE UNIQUE INDEX advisor_invitations_one_open ON public.advisor_invitations(deal_id, side) WHERE status IN ('waiting','joined');
CREATE INDEX advisor_invitations_firm ON public.advisor_invitations(firm_profile_id);
GRANT ALL ON public.advisor_invitations TO service_role;
ALTER TABLE public.advisor_invitations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.advisor_ndas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deal_pipelines(id) ON DELETE CASCADE,
  firm_profile_id uuid NOT NULL REFERENCES public.advisor_firms(id) ON DELETE CASCADE,
  client_side text NOT NULL CHECK (client_side IN ('seller','buyer')),
  seller_org_id uuid,
  buyer_org_id uuid,
  signed_by uuid NOT NULL,
  signer_name text,
  signer_title text,
  consent_text text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  nda_text text NOT NULL,
  pdf_path text
);
GRANT ALL ON public.advisor_ndas TO service_role;
ALTER TABLE public.advisor_ndas ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.deal_advisors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deal_pipelines(id) ON DELETE CASCADE,
  side text NOT NULL CHECK (side IN ('seller','buyer')),
  firm_profile_id uuid NOT NULL REFERENCES public.advisor_firms(id) ON DELETE CASCADE,
  advisor_user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  invitation_id uuid REFERENCES public.advisor_invitations(id),
  advisor_nda_id uuid REFERENCES public.advisor_ndas(id),
  UNIQUE (deal_id, side),
  UNIQUE (deal_id, firm_profile_id)
);
GRANT ALL ON public.deal_advisors TO service_role;
ALTER TABLE public.deal_advisors ENABLE ROW LEVEL SECURITY;