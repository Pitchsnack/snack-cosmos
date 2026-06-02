
-- ============ deals ============
CREATE TABLE public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  deal_name VARCHAR(255) NOT NULL,
  startup_id UUID NOT NULL,
  investor_id UUID NOT NULL,
  stage VARCHAR(50) NOT NULL DEFAULT 'Prospecting',
  visibility VARCHAR(50) NOT NULL DEFAULT 'Tenant Visible',
  investment_amount NUMERIC,
  probability INTEGER,
  expected_close_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID
);
CREATE INDEX idx_deals_tenant ON public.deals(tenant_id);
CREATE INDEX idx_deals_startup ON public.deals(startup_id);
CREATE INDEX idx_deals_investor ON public.deals(investor_id);
CREATE INDEX idx_deals_stage ON public.deals(stage);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deals TO authenticated;
GRANT ALL ON public.deals TO service_role;

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER deals_set_updated_at
BEFORE UPDATE ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ deal_ownership ============
CREATE TABLE public.deal_ownership (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  deal_id UUID NOT NULL UNIQUE,
  owning_agent_user_id UUID NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_deal_ownership_tenant ON public.deal_ownership(tenant_id);
CREATE INDEX idx_deal_ownership_agent ON public.deal_ownership(owning_agent_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_ownership TO authenticated;
GRANT ALL ON public.deal_ownership TO service_role;
ALTER TABLE public.deal_ownership ENABLE ROW LEVEL SECURITY;

-- ============ deal_ai_ownership ============
CREATE TABLE public.deal_ai_ownership (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  deal_id UUID NOT NULL UNIQUE,
  owning_ai_agent_id UUID NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_deal_ai_ownership_tenant ON public.deal_ai_ownership(tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_ai_ownership TO authenticated;
GRANT ALL ON public.deal_ai_ownership TO service_role;
ALTER TABLE public.deal_ai_ownership ENABLE ROW LEVEL SECURITY;

-- ============ deal_activity ============
CREATE TABLE public.deal_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  deal_id UUID NOT NULL,
  activity_type VARCHAR(100) NOT NULL,
  activity_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_deal_activity_deal ON public.deal_activity(deal_id);
CREATE INDEX idx_deal_activity_tenant ON public.deal_activity(tenant_id);

GRANT SELECT, INSERT ON public.deal_activity TO authenticated;
GRANT ALL ON public.deal_activity TO service_role;
ALTER TABLE public.deal_activity ENABLE ROW LEVEL SECURITY;

-- ============ deal_tags ============
CREATE TABLE public.deal_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  deal_id UUID NOT NULL,
  tag_name VARCHAR(100) NOT NULL
);
CREATE INDEX idx_deal_tags_deal ON public.deal_tags(deal_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_tags TO authenticated;
GRANT ALL ON public.deal_tags TO service_role;
ALTER TABLE public.deal_tags ENABLE ROW LEVEL SECURITY;

-- ============ deal_documents ============
CREATE TABLE public.deal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  deal_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  document_type VARCHAR(100),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_deal_documents_deal ON public.deal_documents(deal_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_documents TO authenticated;
GRANT ALL ON public.deal_documents TO service_role;
ALTER TABLE public.deal_documents ENABLE ROW LEVEL SECURITY;

-- ============ tenant-match trigger ============
CREATE OR REPLACE FUNCTION public.tg_enforce_deal_tenant_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE parent_tenant uuid;
BEGIN
  SELECT d.tenant_id INTO parent_tenant FROM public.deals d WHERE d.id = NEW.deal_id;
  IF parent_tenant IS NULL THEN
    RAISE EXCEPTION 'Parent deal % not found', NEW.deal_id;
  END IF;
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := parent_tenant;
  ELSIF NEW.tenant_id <> parent_tenant THEN
    RAISE EXCEPTION 'tenant_id (%) does not match parent deal tenant_id (%)', NEW.tenant_id, parent_tenant;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_deal_ownership_tenant_match
BEFORE INSERT OR UPDATE ON public.deal_ownership
FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_deal_tenant_match();

CREATE TRIGGER tg_deal_ai_ownership_tenant_match
BEFORE INSERT OR UPDATE ON public.deal_ai_ownership
FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_deal_tenant_match();

CREATE TRIGGER tg_deal_activity_tenant_match
BEFORE INSERT OR UPDATE ON public.deal_activity
FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_deal_tenant_match();

CREATE TRIGGER tg_deal_tags_tenant_match
BEFORE INSERT OR UPDATE ON public.deal_tags
FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_deal_tenant_match();

CREATE TRIGGER tg_deal_documents_tenant_match
BEFORE INSERT OR UPDATE ON public.deal_documents
FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_deal_tenant_match();

-- ============ security definer helpers ============
CREATE OR REPLACE FUNCTION public.can_manage_deal(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_control(_user_id)
    OR public.is_master_agent_of(_user_id, _tenant_id)
    OR public.is_tenant_admin_of(_user_id, _tenant_id);
$$;

CREATE OR REPLACE FUNCTION public.can_access_deal(_user_id uuid, _deal_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_control(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.deals d
      WHERE d.id = _deal_id
        AND (
          public.is_master_agent_of(_user_id, d.tenant_id)
          OR public.is_tenant_admin_of(_user_id, d.tenant_id)
          OR EXISTS (
            SELECT 1 FROM public.deal_ownership o
            WHERE o.deal_id = d.id AND o.owning_agent_user_id = _user_id
          )
          OR EXISTS (
            SELECT 1 FROM public.startup_users su
            WHERE su.startup_id = d.startup_id AND su.user_id = _user_id
          )
          OR EXISTS (
            SELECT 1 FROM public.investor_users iu
            WHERE iu.investor_id = d.investor_id AND iu.user_id = _user_id
          )
        )
    );
$$;

-- ============ RLS policies ============
CREATE POLICY prd6_deals_select ON public.deals
  FOR SELECT TO authenticated
  USING (public.can_access_deal(auth.uid(), id));

CREATE POLICY prd6_deals_insert ON public.deals
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_deal(auth.uid(), tenant_id));

CREATE POLICY prd6_deals_update ON public.deals
  FOR UPDATE TO authenticated
  USING (public.can_manage_deal(auth.uid(), tenant_id))
  WITH CHECK (public.can_manage_deal(auth.uid(), tenant_id));

CREATE POLICY prd6_deals_delete ON public.deals
  FOR DELETE TO authenticated
  USING (public.is_control(auth.uid()));

CREATE POLICY prd6_do_select ON public.deal_ownership
  FOR SELECT TO authenticated
  USING (public.can_access_deal(auth.uid(), deal_id));

CREATE POLICY prd6_do_write ON public.deal_ownership
  FOR ALL TO authenticated
  USING (public.can_manage_deal(auth.uid(), tenant_id))
  WITH CHECK (public.can_manage_deal(auth.uid(), tenant_id));

CREATE POLICY prd6_dao_select ON public.deal_ai_ownership
  FOR SELECT TO authenticated
  USING (public.can_access_deal(auth.uid(), deal_id));

CREATE POLICY prd6_dao_write ON public.deal_ai_ownership
  FOR ALL TO authenticated
  USING (public.can_manage_deal(auth.uid(), tenant_id))
  WITH CHECK (public.can_manage_deal(auth.uid(), tenant_id));

CREATE POLICY prd6_da_select ON public.deal_activity
  FOR SELECT TO authenticated
  USING (public.can_access_deal(auth.uid(), deal_id));

CREATE POLICY prd6_da_insert ON public.deal_activity
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_deal(auth.uid(), deal_id));

CREATE POLICY prd6_dt_select ON public.deal_tags
  FOR SELECT TO authenticated
  USING (public.can_access_deal(auth.uid(), deal_id));

CREATE POLICY prd6_dt_write ON public.deal_tags
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_tags.deal_id AND public.can_manage_deal(auth.uid(), d.tenant_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_tags.deal_id AND public.can_manage_deal(auth.uid(), d.tenant_id)));

CREATE POLICY prd6_dd_select ON public.deal_documents
  FOR SELECT TO authenticated
  USING (public.can_access_deal(auth.uid(), deal_id));

CREATE POLICY prd6_dd_write ON public.deal_documents
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_documents.deal_id AND public.can_manage_deal(auth.uid(), d.tenant_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_documents.deal_id AND public.can_manage_deal(auth.uid(), d.tenant_id)));
