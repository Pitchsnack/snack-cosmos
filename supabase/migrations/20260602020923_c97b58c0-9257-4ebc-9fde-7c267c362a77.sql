
-- ============ STARTUPS ============
CREATE TABLE public.startups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  startup_name VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255),
  website_url TEXT,
  country VARCHAR(100),
  industry VARCHAR(255),
  short_description TEXT,
  long_description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'Draft',
  visibility VARCHAR(50) NOT NULL DEFAULT 'Tenant',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT startups_status_chk CHECK (status IN ('Draft','Active','Fundraising','Due Diligence','Portfolio','Exited','Inactive','Archived')),
  CONSTRAINT startups_visibility_chk CHECK (visibility IN ('Private','Tenant','Shared','Archived'))
);
CREATE INDEX idx_startups_tenant ON public.startups(tenant_id);
CREATE INDEX idx_startups_status ON public.startups(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.startups TO authenticated;
GRANT ALL ON public.startups TO service_role;

-- ============ STARTUP OWNERSHIP (human) ============
CREATE TABLE public.startup_ownership (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL UNIQUE REFERENCES public.startups(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  owning_agent_user_id UUID NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_startup_ownership_tenant ON public.startup_ownership(tenant_id);
CREATE INDEX idx_startup_ownership_agent ON public.startup_ownership(owning_agent_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.startup_ownership TO authenticated;
GRANT ALL ON public.startup_ownership TO service_role;

-- ============ STARTUP AI OWNERSHIP ============
CREATE TABLE public.startup_ai_ownership (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL UNIQUE REFERENCES public.startups(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  owning_ai_agent_id UUID NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_startup_ai_ownership_tenant ON public.startup_ai_ownership(tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.startup_ai_ownership TO authenticated;
GRANT ALL ON public.startup_ai_ownership TO service_role;

-- ============ STARTUP USERS ============
CREATE TABLE public.startup_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL REFERENCES public.startups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(startup_id, user_id)
);
CREATE INDEX idx_startup_users_user ON public.startup_users(user_id);
CREATE INDEX idx_startup_users_startup ON public.startup_users(startup_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.startup_users TO authenticated;
GRANT ALL ON public.startup_users TO service_role;

-- ============ STARTUP TAGS ============
CREATE TABLE public.startup_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL REFERENCES public.startups(id) ON DELETE CASCADE,
  tag_name VARCHAR(100) NOT NULL,
  UNIQUE(startup_id, tag_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.startup_tags TO authenticated;
GRANT ALL ON public.startup_tags TO service_role;

-- ============ STARTUP ACTIVITY ============
CREATE TABLE public.startup_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL REFERENCES public.startups(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  activity_type VARCHAR(100) NOT NULL,
  activity_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_startup_activity_startup ON public.startup_activity(startup_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.startup_activity TO authenticated;
GRANT ALL ON public.startup_activity TO service_role;

-- ============ HELPER FN ============
CREATE OR REPLACE FUNCTION public.can_access_startup(_user_id UUID, _startup_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_control(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.startups s
      WHERE s.id = _startup_id
        AND (
          public.is_master_agent_of(_user_id, s.tenant_id)
          OR public.is_tenant_admin_of(_user_id, s.tenant_id)
          OR EXISTS (
            SELECT 1 FROM public.startup_ownership o
            WHERE o.startup_id = s.id AND o.owning_agent_user_id = _user_id
          )
          OR EXISTS (
            SELECT 1 FROM public.startup_users su
            WHERE su.startup_id = s.id AND su.user_id = _user_id
          )
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_startup(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_control(_user_id)
    OR public.is_master_agent_of(_user_id, _tenant_id)
    OR public.is_tenant_admin_of(_user_id, _tenant_id);
$$;

-- ============ RLS ============
ALTER TABLE public.startups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.startup_ownership ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.startup_ai_ownership ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.startup_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.startup_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.startup_activity ENABLE ROW LEVEL SECURITY;

-- startups
CREATE POLICY prd4_startups_select ON public.startups FOR SELECT TO authenticated
USING (public.can_access_startup(auth.uid(), id));

CREATE POLICY prd4_startups_insert ON public.startups FOR INSERT TO authenticated
WITH CHECK (public.can_manage_startup(auth.uid(), tenant_id));

CREATE POLICY prd4_startups_update ON public.startups FOR UPDATE TO authenticated
USING (public.can_manage_startup(auth.uid(), tenant_id))
WITH CHECK (public.can_manage_startup(auth.uid(), tenant_id));

CREATE POLICY prd4_startups_delete ON public.startups FOR DELETE TO authenticated
USING (public.is_control(auth.uid()));

-- startup_ownership
CREATE POLICY prd4_so_select ON public.startup_ownership FOR SELECT TO authenticated
USING (public.can_access_startup(auth.uid(), startup_id));

CREATE POLICY prd4_so_write ON public.startup_ownership FOR ALL TO authenticated
USING (public.can_manage_startup(auth.uid(), tenant_id))
WITH CHECK (public.can_manage_startup(auth.uid(), tenant_id));

-- startup_ai_ownership
CREATE POLICY prd4_sao_select ON public.startup_ai_ownership FOR SELECT TO authenticated
USING (public.can_access_startup(auth.uid(), startup_id));

CREATE POLICY prd4_sao_write ON public.startup_ai_ownership FOR ALL TO authenticated
USING (public.can_manage_startup(auth.uid(), tenant_id))
WITH CHECK (public.can_manage_startup(auth.uid(), tenant_id));

-- startup_users
CREATE POLICY prd4_su_select ON public.startup_users FOR SELECT TO authenticated
USING (public.can_access_startup(auth.uid(), startup_id));

CREATE POLICY prd4_su_write ON public.startup_users FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.startups s WHERE s.id = startup_id AND public.can_manage_startup(auth.uid(), s.tenant_id))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.startups s WHERE s.id = startup_id AND public.can_manage_startup(auth.uid(), s.tenant_id))
);

-- startup_tags
CREATE POLICY prd4_st_select ON public.startup_tags FOR SELECT TO authenticated
USING (public.can_access_startup(auth.uid(), startup_id));

CREATE POLICY prd4_st_write ON public.startup_tags FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.startups s WHERE s.id = startup_id AND public.can_manage_startup(auth.uid(), s.tenant_id))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.startups s WHERE s.id = startup_id AND public.can_manage_startup(auth.uid(), s.tenant_id))
);

-- startup_activity
CREATE POLICY prd4_sa_select ON public.startup_activity FOR SELECT TO authenticated
USING (public.can_access_startup(auth.uid(), startup_id));

CREATE POLICY prd4_sa_insert ON public.startup_activity FOR INSERT TO authenticated
WITH CHECK (public.can_access_startup(auth.uid(), startup_id));

-- updated_at triggers
CREATE TRIGGER trg_startups_updated_at
BEFORE UPDATE ON public.startups
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
