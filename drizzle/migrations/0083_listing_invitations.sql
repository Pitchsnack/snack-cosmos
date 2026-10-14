CREATE TABLE public.listing_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hidden_profile_id uuid NOT NULL,
  startup_id uuid NOT NULL,
  investor_id uuid NOT NULL,
  buyer_user_id uuid,
  sent_by uuid NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  viewed_at timestamptz,
  buyer_choice text NOT NULL DEFAULT 'open' CHECK (buyer_choice IN ('open','not_interested')),
  choice_at timestamptz,
  closed_at timestamptz,
  closed_reason text CHECK (closed_reason IN ('listing_not_live','profile_unpublished','nda_ended')),
  pipeline_id uuid,
  from_contact_request uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX listing_invitations_one_open ON public.listing_invitations (hidden_profile_id, investor_id) WHERE closed_at IS NULL;
CREATE INDEX listing_invitations_buyer ON public.listing_invitations (buyer_user_id);
CREATE INDEX listing_invitations_startup ON public.listing_invitations (startup_id);

GRANT SELECT ON public.listing_invitations TO authenticated;
GRANT ALL ON public.listing_invitations TO service_role;
ALTER TABLE public.listing_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invitations: parties and admin read" ON public.listing_invitations FOR SELECT TO authenticated
USING (sent_by = auth.uid() OR buyer_user_id = auth.uid() OR public.is_startup_member(auth.uid(), startup_id) OR public.is_account_admin(auth.uid()));

-- Existing seller contact requests become invitations (no notifications).
INSERT INTO public.listing_invitations (hidden_profile_id, startup_id, investor_id, buyer_user_id, sent_by, sent_at, viewed_at, buyer_choice, choice_at, pipeline_id, from_contact_request)
SELECT hidden_profile_id, startup_id, investor_id, investor_user_id, seller_user_id, created_at,
  CASE WHEN status = 'accepted' THEN decided_at END,
  CASE WHEN status = 'declined' THEN 'not_interested' ELSE 'open' END,
  CASE WHEN status = 'declined' THEN decided_at END,
  pipeline_id, id
FROM public.contact_requests;

COMMENT ON TABLE public.contact_requests IS 'DEPRECATED: seller contact requests replaced by listing_invitations';