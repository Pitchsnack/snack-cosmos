
-- Browse advisors: enquiry conversations, enquiries, proposals, events, profile views.
CREATE TABLE public.advisor_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_profile_id uuid NOT NULL REFERENCES public.advisor_firms(id) ON DELETE CASCADE,
  client_side text NOT NULL CHECK (client_side IN ('seller','buyer')),
  client_org_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (firm_profile_id, client_side, client_org_id)
);
GRANT ALL ON public.advisor_conversations TO service_role;
ALTER TABLE public.advisor_conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.advisor_enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_profile_id uuid NOT NULL REFERENCES public.advisor_firms(id) ON DELETE CASCADE,
  client_org_id uuid NOT NULL,
  client_side text NOT NULL CHECK (client_side IN ('seller','buyer')),
  sent_by uuid NOT NULL,
  service_key text NOT NULL,
  need_text text NOT NULL,
  timing text CHECK (timing IN ('asap','month','quarter','exploring')),
  status text NOT NULL DEFAULT 'enquiry' CHECK (status IN ('enquiry','talking','proposal','engaged','done','declined','closed')),
  read_at timestamptz,
  declined_reason text CHECK (declined_reason IN ('no_service','booked','deal_size','other')),
  declined_at timestamptz,
  engaged_at timestamptz,
  done_at timestamptz,
  closed_reason text,
  closed_at timestamptz,
  conversation_id uuid NOT NULL REFERENCES public.advisor_conversations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX advisor_enquiries_one_open ON public.advisor_enquiries (firm_profile_id, client_side, client_org_id)
  WHERE status IN ('enquiry','talking','proposal','engaged');
CREATE INDEX advisor_enquiries_org_idx ON public.advisor_enquiries (client_side, client_org_id);
CREATE INDEX advisor_enquiries_conv_idx ON public.advisor_enquiries (conversation_id);
GRANT ALL ON public.advisor_enquiries TO service_role;
ALTER TABLE public.advisor_enquiries ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.advisor_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id uuid NOT NULL REFERENCES public.advisor_enquiries(id) ON DELETE CASCADE,
  service_key text NOT NULL,
  scope text NOT NULL,
  fee_type text NOT NULL CHECK (fee_type IN ('fixed','hourly','retainer','success','retainer_success','other')),
  amount_thb bigint,
  pct_min numeric,
  pct_max numeric,
  own_words text,
  fee_text text NOT NULL,
  timing text,
  valid_until date NOT NULL,
  letter_file jsonb,
  sent_by uuid NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','declined','expired','replaced')),
  answered_by uuid,
  answered_at timestamptz,
  consent_text text
);
CREATE INDEX advisor_proposals_enq_idx ON public.advisor_proposals (enquiry_id);
GRANT ALL ON public.advisor_proposals TO service_role;
ALTER TABLE public.advisor_proposals ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.advisor_enquiry_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.advisor_conversations(id) ON DELETE CASCADE,
  enquiry_id uuid NOT NULL REFERENCES public.advisor_enquiries(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('enquiry','proposal','accepted','proposal_declined','proposal_expired','declined','done','closed')),
  ref_id uuid,
  actor_user_id uuid,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX advisor_enquiry_events_conv_idx ON public.advisor_enquiry_events (conversation_id, created_at);
GRANT ALL ON public.advisor_enquiry_events TO service_role;
ALTER TABLE public.advisor_enquiry_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.firm_profile_views (
  firm_profile_id uuid NOT NULL REFERENCES public.advisor_firms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  day date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Bangkok')::date),
  PRIMARY KEY (firm_profile_id, user_id, day)
);
GRANT ALL ON public.firm_profile_views TO service_role;
ALTER TABLE public.firm_profile_views ENABLE ROW LEVEL SECURITY;

-- One review per engagement.
ALTER TABLE public.advisor_firm_reviews ADD COLUMN IF NOT EXISTS enquiry_id uuid REFERENCES public.advisor_enquiries(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS advisor_firm_reviews_enquiry_uniq ON public.advisor_firm_reviews (enquiry_id) WHERE enquiry_id IS NOT NULL;

-- First visit of Browse advisors, once per user.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS advisors_intro_seen_at timestamptz;

-- A firm that stops being Live closes its open enquiries (engaged ones stay).
CREATE OR REPLACE FUNCTION public.tg_close_enquiries_on_unpublish()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e record;
BEGIN
  IF OLD.status = 'live' AND NEW.status IS DISTINCT FROM 'live' THEN
    FOR e IN SELECT id, conversation_id FROM public.advisor_enquiries
      WHERE firm_profile_id = NEW.id AND status IN ('enquiry','talking','proposal') LOOP
      UPDATE public.advisor_proposals SET status = 'replaced' WHERE enquiry_id = e.id AND status = 'open';
      UPDATE public.advisor_enquiries SET status = 'closed', closed_reason = 'firm_unpublished', closed_at = now() WHERE id = e.id;
      INSERT INTO public.advisor_enquiry_events (conversation_id, enquiry_id, kind) VALUES (e.conversation_id, e.id, 'closed');
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER zz_close_enquiries_on_unpublish AFTER UPDATE OF status ON public.advisor_firms
  FOR EACH ROW EXECUTE FUNCTION public.tg_close_enquiries_on_unpublish();

-- Enquiry conversations ('e:<conversation id>') in the message read rule.
CREATE OR REPLACE FUNCTION public.can_read_message_thread(_uid uuid, _key text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; c record;
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;
  IF _key LIKE 'a:%' THEN
    RETURN substring(_key from 3) = _uid::text OR public.is_control(_uid);
  END IF;
  IF _key LIKE 'p:%' THEN
    SELECT * INTO p FROM public.deal_pipelines WHERE id::text = substring(_key from 3);
    IF NOT FOUND OR p.nda_approved_at IS NULL THEN RETURN false; END IF;
    RETURN p.buyer_user_id = _uid
      OR EXISTS (SELECT 1 FROM public.startup_ownership o WHERE o.startup_id = p.startup_id AND o.owning_agent_user_id = _uid)
      OR EXISTS (SELECT 1 FROM public.startup_users su WHERE su.startup_id = p.startup_id AND su.user_id = _uid);
  END IF;
  IF _key LIKE 'e:%' THEN
    SELECT * INTO c FROM public.advisor_conversations WHERE id::text = substring(_key from 3);
    IF NOT FOUND THEN RETURN false; END IF;
    IF EXISTS (SELECT 1 FROM public.advisor_firms f WHERE f.id = c.firm_profile_id AND f.owner_user_id = _uid) THEN RETURN true; END IF;
    IF c.client_side = 'seller' THEN
      RETURN EXISTS (SELECT 1 FROM public.startup_ownership o WHERE o.startup_id = c.client_org_id AND o.owning_agent_user_id = _uid)
        OR EXISTS (SELECT 1 FROM public.startup_users su WHERE su.startup_id = c.client_org_id AND su.user_id = _uid);
    END IF;
    RETURN EXISTS (SELECT 1 FROM public.buyer_profiles b WHERE b.investor_id = c.client_org_id AND b.user_id = _uid);
  END IF;
  RETURN false;
END $$;
