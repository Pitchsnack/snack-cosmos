
-- ============================================================
-- PRD 2 — Authentication, Authorization & RBAC
-- ============================================================

-- 1. ENUMS -----------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM (
    'CONTROL',
    'CONTROL_RESEARCH_AI',
    'CONTROL_STARTUP_DISCOVERY_AI',
    'CONTROL_INVESTOR_DISCOVERY_AI',
    'MASTER_AGENT',
    'MASTER_AGENT_AI',
    'TENANT_ADMIN',
    'TENANT_AGENT',
    'TENANT_STARTUP_AI',
    'TENANT_INVESTOR_AI',
    'TENANT_DEAL_AI',
    'STARTUP_USER',
    'INVESTOR_USER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.user_type AS ENUM ('Human', 'AI', 'System');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.user_status AS ENUM ('Pending','Active','Suspended','Locked','Archived','Deleted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.workspace_type AS ENUM ('CONTROL','MASTER_AGENT','TENANT','STARTUP','INVESTOR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.security_event_type AS ENUM (
    'LOGIN','LOGOUT','FAILED_LOGIN','PASSWORD_RESET','ROLE_CHANGE',
    'WORKSPACE_SWITCH','USER_INVITED','INVITE_ACCEPTED','INVITE_EXPIRED',
    'ACCOUNT_LOCKED','ACCOUNT_SUSPENDED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. ROLES TABLE ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_code public.app_role NOT NULL UNIQUE,
  role_name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.roles TO authenticated;
GRANT ALL ON public.roles TO service_role;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY prd2_roles_select_authenticated ON public.roles
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.roles (role_code, role_name, description) VALUES
  ('CONTROL','Control Administrator','Full platform access'),
  ('CONTROL_RESEARCH_AI','Control Research AI','Platform research agent'),
  ('CONTROL_STARTUP_DISCOVERY_AI','Control Startup Discovery AI','Platform startup discovery agent'),
  ('CONTROL_INVESTOR_DISCOVERY_AI','Control Investor Discovery AI','Platform investor discovery agent'),
  ('MASTER_AGENT','Master Agent','Cross-tenant operator'),
  ('MASTER_AGENT_AI','Master Agent AI','Cross-tenant agent'),
  ('TENANT_ADMIN','Tenant Administrator','Tenant administrator'),
  ('TENANT_AGENT','Tenant Agent','Tenant operator'),
  ('TENANT_STARTUP_AI','Tenant Startup AI','Tenant startup agent'),
  ('TENANT_INVESTOR_AI','Tenant Investor AI','Tenant investor agent'),
  ('TENANT_DEAL_AI','Tenant Deal AI','Tenant deal agent'),
  ('STARTUP_USER','Startup User','Startup portal user'),
  ('INVESTOR_USER','Investor User','Investor portal user')
ON CONFLICT (role_code) DO NOTHING;

-- 3. USERS TABLE -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  user_type public.user_type NOT NULL DEFAULT 'Human',
  status public.user_status NOT NULL DEFAULT 'Pending',
  primary_tenant_id UUID,
  primary_role_id UUID REFERENCES public.roles(id),
  ai_agent_id UUID,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID
);
CREATE INDEX IF NOT EXISTS idx_users_primary_tenant ON public.users(primary_tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 4. USER_ROLES ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id),
  tenant_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE (user_id, role_id, tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_tenant ON public.user_roles(tenant_id);
GRANT SELECT, INSERT, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 5. USER_TENANTS ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  workspace_type public.workspace_type NOT NULL DEFAULT 'TENANT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE (user_id, tenant_id, workspace_type)
);
CREATE INDEX IF NOT EXISTS idx_user_tenants_user ON public.user_tenants(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tenants_tenant ON public.user_tenants(tenant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_tenants TO authenticated;
GRANT ALL ON public.user_tenants TO service_role;
ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;

-- 6. WORKSPACE_CONTEXT ----------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  active_tenant_id UUID,
  active_role_id UUID REFERENCES public.roles(id),
  active_workspace_type public.workspace_type,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.workspace_context TO authenticated;
GRANT ALL ON public.workspace_context TO service_role;
ALTER TABLE public.workspace_context ENABLE ROW LEVEL SECURITY;

-- 7. MASTER_AGENT_TENANTS -------------------------------------
CREATE TABLE IF NOT EXISTS public.master_agent_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_agent_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (master_agent_user_id, tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_mat_user ON public.master_agent_tenants(master_agent_user_id);
CREATE INDEX IF NOT EXISTS idx_mat_tenant ON public.master_agent_tenants(tenant_id);
GRANT SELECT, INSERT, DELETE ON public.master_agent_tenants TO authenticated;
GRANT ALL ON public.master_agent_tenants TO service_role;
ALTER TABLE public.master_agent_tenants ENABLE ROW LEVEL SECURITY;

-- 8. STARTUP / INVESTOR ASSIGNMENTS (placeholders) ------------
CREATE TABLE IF NOT EXISTS public.startup_user_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  startup_id UUID NOT NULL,
  role VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sua_user ON public.startup_user_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_sua_startup ON public.startup_user_assignments(startup_id);
GRANT SELECT, INSERT, DELETE ON public.startup_user_assignments TO authenticated;
GRANT ALL ON public.startup_user_assignments TO service_role;
ALTER TABLE public.startup_user_assignments ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.investor_user_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  investor_id UUID NOT NULL,
  role VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_iua_user ON public.investor_user_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_iua_investor ON public.investor_user_assignments(investor_id);
GRANT SELECT, INSERT, DELETE ON public.investor_user_assignments TO authenticated;
GRANT ALL ON public.investor_user_assignments TO service_role;
ALTER TABLE public.investor_user_assignments ENABLE ROW LEVEL SECURITY;

-- 9. USER_SESSIONS --------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tenant_id UUID,
  login_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  logout_time TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON public.user_sessions(user_id);
GRANT SELECT, INSERT, UPDATE ON public.user_sessions TO authenticated;
GRANT ALL ON public.user_sessions TO service_role;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- 10. SECURITY_EVENTS -----------------------------------------
CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  tenant_id UUID,
  event_type public.security_event_type NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_security_events_user ON public.security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_tenant ON public.security_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON public.security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON public.security_events(created_at DESC);
GRANT SELECT, INSERT ON public.security_events TO authenticated;
GRANT ALL ON public.security_events TO service_role;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- 11. SECURITY-DEFINER HELPERS --------------------------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id AND r.role_code = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_control(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'CONTROL'::public.app_role);
$$;

CREATE OR REPLACE FUNCTION public.is_master_agent_of(_user_id uuid, _tenant uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.master_agent_tenants
    WHERE master_agent_user_id = _user_id AND tenant_id = _tenant
  );
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_admin_of(_user_id uuid, _tenant uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id
      AND ur.tenant_id = _tenant
      AND r.role_code = 'TENANT_ADMIN'::public.app_role
  );
$$;

CREATE OR REPLACE FUNCTION public.user_in_tenant(_user_id uuid, _tenant uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_control(_user_id)
    OR public.is_master_agent_of(_user_id, _tenant)
    OR EXISTS (
      SELECT 1 FROM public.user_tenants
      WHERE user_id = _user_id AND tenant_id = _tenant
    );
$$;

CREATE OR REPLACE FUNCTION public.active_tenant_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT active_tenant_id FROM public.workspace_context WHERE user_id = _user_id;
$$;

-- 12. AUTH.USERS → PUBLIC.USERS MIRROR -------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, email, status, user_type)
  VALUES (NEW.id, NEW.email, 'Pending', 'Human')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 13. UPDATED_AT TRIGGERS --------------------------------------
DROP TRIGGER IF EXISTS tg_users_updated ON public.users;
CREATE TRIGGER tg_users_updated BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
DROP TRIGGER IF EXISTS tg_roles_updated ON public.roles;
CREATE TRIGGER tg_roles_updated BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
DROP TRIGGER IF EXISTS tg_workspace_context_updated ON public.workspace_context;
CREATE TRIGGER tg_workspace_context_updated BEFORE UPDATE ON public.workspace_context
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 14. DROP PRD1 PERMISSIVE POLICIES ----------------------------
DROP POLICY IF EXISTS prd1_tenants_all_anon ON public.tenants;
DROP POLICY IF EXISTS prd1_tenants_all_authenticated ON public.tenants;
DROP POLICY IF EXISTS prd1_tenant_settings_all_anon ON public.tenant_settings;
DROP POLICY IF EXISTS prd1_tenant_settings_all_authenticated ON public.tenant_settings;
DROP POLICY IF EXISTS prd1_tenant_subscription_all_anon ON public.tenant_subscription;
DROP POLICY IF EXISTS prd1_tenant_subscription_all_authenticated ON public.tenant_subscription;
DROP POLICY IF EXISTS prd1_tenant_features_all_anon ON public.tenant_features;
DROP POLICY IF EXISTS prd1_tenant_features_all_authenticated ON public.tenant_features;
DROP POLICY IF EXISTS prd1_audit_logs_select_anon ON public.audit_logs;
DROP POLICY IF EXISTS prd1_audit_logs_select_authenticated ON public.audit_logs;
DROP POLICY IF EXISTS prd1_audit_logs_insert_anon ON public.audit_logs;
DROP POLICY IF EXISTS prd1_audit_logs_insert_authenticated ON public.audit_logs;

-- 15. PRD2 POLICIES: tenants ----------------------------------
CREATE POLICY prd2_tenants_select ON public.tenants
  FOR SELECT TO authenticated
  USING (public.user_in_tenant(auth.uid(), id));
CREATE POLICY prd2_tenants_insert ON public.tenants
  FOR INSERT TO authenticated
  WITH CHECK (public.is_control(auth.uid()));
CREATE POLICY prd2_tenants_update ON public.tenants
  FOR UPDATE TO authenticated
  USING (public.is_control(auth.uid()) OR public.is_tenant_admin_of(auth.uid(), id))
  WITH CHECK (public.is_control(auth.uid()) OR public.is_tenant_admin_of(auth.uid(), id));
CREATE POLICY prd2_tenants_delete ON public.tenants
  FOR DELETE TO authenticated
  USING (public.is_control(auth.uid()));

-- tenant_settings / subscription / features ------------------
CREATE POLICY prd2_tenant_settings_select ON public.tenant_settings
  FOR SELECT TO authenticated USING (public.user_in_tenant(auth.uid(), tenant_id));
CREATE POLICY prd2_tenant_settings_write ON public.tenant_settings
  FOR ALL TO authenticated
  USING (public.is_control(auth.uid()) OR public.is_tenant_admin_of(auth.uid(), tenant_id))
  WITH CHECK (public.is_control(auth.uid()) OR public.is_tenant_admin_of(auth.uid(), tenant_id));

CREATE POLICY prd2_tenant_subscription_select ON public.tenant_subscription
  FOR SELECT TO authenticated USING (public.user_in_tenant(auth.uid(), tenant_id));
CREATE POLICY prd2_tenant_subscription_write ON public.tenant_subscription
  FOR ALL TO authenticated
  USING (public.is_control(auth.uid()))
  WITH CHECK (public.is_control(auth.uid()));

CREATE POLICY prd2_tenant_features_select ON public.tenant_features
  FOR SELECT TO authenticated USING (public.user_in_tenant(auth.uid(), tenant_id));
CREATE POLICY prd2_tenant_features_write ON public.tenant_features
  FOR ALL TO authenticated
  USING (public.is_control(auth.uid()) OR public.is_tenant_admin_of(auth.uid(), tenant_id))
  WITH CHECK (public.is_control(auth.uid()) OR public.is_tenant_admin_of(auth.uid(), tenant_id));

-- audit_logs --------------------------------------------------
CREATE POLICY prd2_audit_logs_select ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_control(auth.uid()) OR (tenant_id IS NOT NULL AND public.user_in_tenant(auth.uid(), tenant_id)));
CREATE POLICY prd2_audit_logs_insert ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- users -------------------------------------------------------
CREATE POLICY prd2_users_select ON public.users
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_control(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_tenants ut
      WHERE ut.user_id = public.users.id
        AND public.is_tenant_admin_of(auth.uid(), ut.tenant_id)
    )
  );
CREATE POLICY prd2_users_update_self ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_control(auth.uid()))
  WITH CHECK (id = auth.uid() OR public.is_control(auth.uid()));

-- user_roles --------------------------------------------------
CREATE POLICY prd2_user_roles_select ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_control(auth.uid())
    OR (tenant_id IS NOT NULL AND public.is_tenant_admin_of(auth.uid(), tenant_id))
  );
CREATE POLICY prd2_user_roles_write ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_control(auth.uid()) OR (tenant_id IS NOT NULL AND public.is_tenant_admin_of(auth.uid(), tenant_id)))
  WITH CHECK (public.is_control(auth.uid()) OR (tenant_id IS NOT NULL AND public.is_tenant_admin_of(auth.uid(), tenant_id)));

-- user_tenants ------------------------------------------------
CREATE POLICY prd2_user_tenants_select ON public.user_tenants
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_control(auth.uid())
    OR public.is_tenant_admin_of(auth.uid(), tenant_id)
  );
CREATE POLICY prd2_user_tenants_write ON public.user_tenants
  FOR ALL TO authenticated
  USING (public.is_control(auth.uid()) OR public.is_tenant_admin_of(auth.uid(), tenant_id))
  WITH CHECK (public.is_control(auth.uid()) OR public.is_tenant_admin_of(auth.uid(), tenant_id));

-- workspace_context -------------------------------------------
CREATE POLICY prd2_workspace_context_select ON public.workspace_context
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_control(auth.uid()));
CREATE POLICY prd2_workspace_context_write ON public.workspace_context
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- master_agent_tenants ----------------------------------------
CREATE POLICY prd2_mat_select ON public.master_agent_tenants
  FOR SELECT TO authenticated
  USING (master_agent_user_id = auth.uid() OR public.is_control(auth.uid()));
CREATE POLICY prd2_mat_write ON public.master_agent_tenants
  FOR ALL TO authenticated
  USING (public.is_control(auth.uid()))
  WITH CHECK (public.is_control(auth.uid()));

-- user_sessions -----------------------------------------------
CREATE POLICY prd2_user_sessions_select ON public.user_sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_control(auth.uid()));
CREATE POLICY prd2_user_sessions_insert ON public.user_sessions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY prd2_user_sessions_update ON public.user_sessions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- security_events ---------------------------------------------
CREATE POLICY prd2_security_events_select ON public.security_events
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_control(auth.uid())
    OR (tenant_id IS NOT NULL AND public.is_tenant_admin_of(auth.uid(), tenant_id))
  );
CREATE POLICY prd2_security_events_insert ON public.security_events
  FOR INSERT TO authenticated WITH CHECK (true);

-- startup/investor assignments --------------------------------
CREATE POLICY prd2_sua_select ON public.startup_user_assignments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_control(auth.uid()));
CREATE POLICY prd2_sua_write ON public.startup_user_assignments
  FOR ALL TO authenticated
  USING (public.is_control(auth.uid())) WITH CHECK (public.is_control(auth.uid()));

CREATE POLICY prd2_iua_select ON public.investor_user_assignments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_control(auth.uid()));
CREATE POLICY prd2_iua_write ON public.investor_user_assignments
  FOR ALL TO authenticated
  USING (public.is_control(auth.uid())) WITH CHECK (public.is_control(auth.uid()));

-- Comments ---------------------------------------------------
COMMENT ON TABLE public.users IS 'PRD 2 — application-owned user profile, mirrors auth.users for humans';
COMMENT ON TABLE public.roles IS 'PRD 2 — catalog of application roles (no vendor RBAC)';
COMMENT ON TABLE public.workspace_context IS 'PRD 2 — server-of-truth for the currently active workspace per user';
