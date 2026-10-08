CREATE TABLE public.contact_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_user_id uuid NOT NULL,
  startup_id uuid NOT NULL,
  hidden_profile_id uuid NOT NULL,
  investor_id uuid NOT NULL,
  investor_user_id uuid,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','accepted','declined')),
  pipeline_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  UNIQUE (seller_user_id, investor_id)
);
GRANT SELECT ON public.contact_requests TO authenticated;
GRANT ALL ON public.contact_requests TO service_role;
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contact requests: parties and admin read" ON public.contact_requests FOR SELECT TO authenticated
  USING (seller_user_id = auth.uid() OR investor_user_id = auth.uid() OR public.is_account_admin(auth.uid()));