-- PRD 5 — Investor Ownership Management
-- Mirrors PRD 4 startup architecture with tenant_id on every table from day one.

-- 1. investors
CREATE TABLE public.investors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  investor_name VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255),
  website_url TEXT,
  country VARCHAR(100),
  investor_type VARCHAR(100),
  aum VARCHAR(255),
  ticket_size VARCHAR(255),
  short_description TEXT,
  long_description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'Prospect',
  visibility VARCHAR(50) NOT NULL DEFAULT 'Tenant',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investors TO authenticated;
GRANT ALL ON public.investors TO service_role;

-- 2. investor_ownership
CREATE TABLE public.investor_ownership (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  investor_id UUID NOT NULL UNIQUE REFERENCES public.investors(id) ON DELETE CASCADE,
  owning_agent_user_id UUID NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investor_ownership TO authenticated;
GRANT ALL ON public.investor_ownership TO service_role;

-- 3. investor_ai_ownership
CREATE TABLE public.investor_ai_ownership (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  investor_id UUID NOT NULL UNIQUE REFERENCES public.investors(id) ON DELETE CASCADE,
  owning_ai_agent_id UUID NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investor_ai_ownership TO authenticated;
GRANT ALL ON public.investor_ai_ownership TO service_role;

-- 4. investor_users (portal users, separate from PRD 2 placeholder investor_user_assignments)
CREATE TABLE public.investor_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  investor_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (investor_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investor_users TO authenticated;
GRANT ALL ON public.investor_users TO service_role;

-- 5. investor_tags
CREATE TABLE public.investor_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  investor_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  tag_name VARCHAR(100) NOT NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investor_tags TO authenticated;
GRANT ALL ON public.investor_tags TO service_role;

-- 6. investor_activity
CREATE TABLE public.investor_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  investor_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  activity_type VARCHAR(100) NOT NULL,
  activity_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.investor_activity TO authenticated;
GRANT ALL ON public.investor_activity TO service_role;

-- Indexes
CREATE INDEX idx_investors_tenant ON public.investors(tenant_id);
CREATE INDEX idx_investor_ownership_tenant ON public.investor_ownership(tenant_id);
CREATE INDEX idx_investor_ai_ownership_tenant ON public.investor_ai_ownership(tenant_id);
CREATE INDEX idx_investor_users_tenant ON public.investor_users(tenant_id);
CREATE INDEX idx_investor_users_user ON public.investor_users(user_id);
CREATE INDEX idx_investor_tags_tenant ON public.investor_tags(tenant_id);
CREATE INDEX idx_investor_activity_tenant ON public.investor_activity(tenant_id);
CREATE INDEX idx_investor_activity_investor ON public.investor_activity(investor_id);

-- updated_at trigger
CREATE TRIGGER trg_investors_updated_at
  BEFORE UPDATE ON public.investors
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Tenant-match trigger (parent investor's tenant must match child rows)
CREATE OR REPLACE FUNCTION public.tg_enforce_investor_tenant_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE parent_tenant uuid;
BEGIN
  SELECT i.tenant_id INTO parent_tenant FROM public.investors i WHERE i.id = NEW.investor_id;
  IF parent_tenant IS NULL THEN
    RAISE EXCEPTION 'Parent investor % not found', NEW.investor_id;
  END IF;
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := parent_tenant;
  ELSIF NEW.tenant_id <> parent_tenant THEN
    RAISE EXCEPTION 'tenant_id (%) does not match parent investor tenant_id (%)', NEW.tenant_id, parent_tenant;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_investor_ownership_tenant_match
  BEFORE INSERT OR UPDATE ON public.investor_ownership
  FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_investor_tenant_match();
CREATE TRIGGER trg_investor_ai_ownership_tenant_match
  BEFORE INSERT OR UPDATE ON public.investor_ai_ownership
  FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_investor_tenant_match();
CREATE TRIGGER trg_investor_users_tenant_match
  BEFORE INSERT OR UPDATE ON public.investor_users
  FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_investor_tenant_match();
CREATE TRIGGER trg_investor_tags_tenant_match
  BEFORE INSERT OR UPDATE ON public.investor_tags
  FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_investor_tenant_match();
CREATE TRIGGER trg_investor_activity_tenant_match
  BEFORE INSERT OR UPDATE ON public.investor_activity
  FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_investor_tenant_match();

-- Access helpers
CREATE OR REPLACE FUNCTION public.can_manage_investor(_user_id uuid, _tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_control(_user_id)
    OR public.is_master_agent_of(_user_id, _tenant_id)
    OR public.is_tenant_admin_of(_user_id, _tenant_id);
$$;

CREATE OR REPLACE FUNCTION public.can_access_investor(_user_id uuid, _investor_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_control(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.investors i
      WHERE i.id = _investor_id
        AND (
          public.is_master_agent_of(_user_id, i.tenant_id)
          OR public.is_tenant_admin_of(_user_id, i.tenant_id)
          OR EXISTS (
            SELECT 1 FROM public.investor_ownership o
            WHERE o.investor_id = i.id AND o.owning_agent_user_id = _user_id
          )
          OR EXISTS (
            SELECT 1 FROM public.investor_users iu
            WHERE iu.investor_id = i.id AND iu.user_id = _user_id
          )
        )
    );
$$;

-- RLS
ALTER TABLE public.investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_ownership ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_ai_ownership ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY prd5_investors_select ON public.investors FOR SELECT TO authenticated
  USING (public.can_access_investor(auth.uid(), id));
CREATE POLICY prd5_investors_insert ON public.investors FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_investor(auth.uid(), tenant_id));
CREATE POLICY prd5_investors_update ON public.investors FOR UPDATE TO authenticated
  USING (public.can_manage_investor(auth.uid(), tenant_id))
  WITH CHECK (public.can_manage_investor(auth.uid(), tenant_id));
CREATE POLICY prd5_investors_delete ON public.investors FOR DELETE TO authenticated
  USING (public.is_control(auth.uid()));

CREATE POLICY prd5_io_select ON public.investor_ownership FOR SELECT TO authenticated
  USING (public.can_access_investor(auth.uid(), investor_id));
CREATE POLICY prd5_io_write ON public.investor_ownership FOR ALL TO authenticated
  USING (public.can_manage_investor(auth.uid(), tenant_id))
  WITH CHECK (public.can_manage_investor(auth.uid(), tenant_id));

CREATE POLICY prd5_iao_select ON public.investor_ai_ownership FOR SELECT TO authenticated
  USING (public.can_access_investor(auth.uid(), investor_id));
CREATE POLICY prd5_iao_write ON public.investor_ai_ownership FOR ALL TO authenticated
  USING (public.can_manage_investor(auth.uid(), tenant_id))
  WITH CHECK (public.can_manage_investor(auth.uid(), tenant_id));

CREATE POLICY prd5_iu_select ON public.investor_users FOR SELECT TO authenticated
  USING (public.can_access_investor(auth.uid(), investor_id));
CREATE POLICY prd5_iu_write ON public.investor_users FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.investors i WHERE i.id = investor_users.investor_id AND public.can_manage_investor(auth.uid(), i.tenant_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.investors i WHERE i.id = investor_users.investor_id AND public.can_manage_investor(auth.uid(), i.tenant_id)));

CREATE POLICY prd5_it_select ON public.investor_tags FOR SELECT TO authenticated
  USING (public.can_access_investor(auth.uid(), investor_id));
CREATE POLICY prd5_it_write ON public.investor_tags FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.investors i WHERE i.id = investor_tags.investor_id AND public.can_manage_investor(auth.uid(), i.tenant_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.investors i WHERE i.id = investor_tags.investor_id AND public.can_manage_investor(auth.uid(), i.tenant_id)));

CREATE POLICY prd5_ia_select ON public.investor_activity FOR SELECT TO authenticated
  USING (public.can_access_investor(auth.uid(), investor_id));
CREATE POLICY prd5_ia_insert ON public.investor_activity FOR INSERT TO authenticated
  WITH CHECK (public.can_access_investor(auth.uid(), investor_id));
