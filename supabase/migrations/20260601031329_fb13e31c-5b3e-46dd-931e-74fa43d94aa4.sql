
-- =========================================================================
-- PRD 1 — Tenant Architecture & Multi-Tenant Foundation
-- =========================================================================

-- Shared updated_at trigger function ---------------------------------------
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 1. tenants ---------------------------------------------------------------
CREATE TABLE public.tenants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_code VARCHAR(100) NOT NULL UNIQUE,
  tenant_name VARCHAR(255) NOT NULL,
  status      VARCHAR(50)  NOT NULL DEFAULT 'Draft'
              CHECK (status IN ('Draft','Active','Suspended','Archived','Deleted')),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  created_by  UUID,
  updated_by  UUID
);

CREATE INDEX idx_tenants_status      ON public.tenants(status);
CREATE INDEX idx_tenants_tenant_code ON public.tenants(tenant_code);

CREATE TRIGGER trg_tenants_updated_at
BEFORE UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO anon, authenticated;
GRANT ALL ON public.tenants TO service_role;

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Interim open policies — PRD 2 (Auth & RBAC) replaces these.
CREATE POLICY "prd1_tenants_all_anon"          ON public.tenants FOR ALL TO anon          USING (true) WITH CHECK (true);
CREATE POLICY "prd1_tenants_all_authenticated" ON public.tenants FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 2. tenant_settings -------------------------------------------------------
CREATE TABLE public.tenant_settings (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branding_logo_url      TEXT,
  branding_primary_color VARCHAR(50),
  timezone               VARCHAR(100) NOT NULL DEFAULT 'UTC',
  configuration_json     JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
  created_by             UUID,
  updated_by             UUID,
  UNIQUE (tenant_id)
);

CREATE INDEX idx_tenant_settings_tenant_id ON public.tenant_settings(tenant_id);

CREATE TRIGGER trg_tenant_settings_updated_at
BEFORE UPDATE ON public.tenant_settings
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_settings TO anon, authenticated;
GRANT ALL ON public.tenant_settings TO service_role;

ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prd1_tenant_settings_all_anon"          ON public.tenant_settings FOR ALL TO anon          USING (true) WITH CHECK (true);
CREATE POLICY "prd1_tenant_settings_all_authenticated" ON public.tenant_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 3. tenant_subscription ---------------------------------------------------
CREATE TABLE public.tenant_subscription (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subscription_plan VARCHAR(100) NOT NULL DEFAULT 'Free',
  max_users         INTEGER      NOT NULL DEFAULT 5,
  max_startups      INTEGER      NOT NULL DEFAULT 10,
  max_investors     INTEGER      NOT NULL DEFAULT 10,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  created_by        UUID,
  updated_by        UUID,
  UNIQUE (tenant_id)
);

CREATE INDEX idx_tenant_subscription_tenant_id ON public.tenant_subscription(tenant_id);

CREATE TRIGGER trg_tenant_subscription_updated_at
BEFORE UPDATE ON public.tenant_subscription
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_subscription TO anon, authenticated;
GRANT ALL ON public.tenant_subscription TO service_role;

ALTER TABLE public.tenant_subscription ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prd1_tenant_subscription_all_anon"          ON public.tenant_subscription FOR ALL TO anon          USING (true) WITH CHECK (true);
CREATE POLICY "prd1_tenant_subscription_all_authenticated" ON public.tenant_subscription FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 4. tenant_features -------------------------------------------------------
CREATE TABLE public.tenant_features (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  feature_code VARCHAR(100) NOT NULL,
  enabled      BOOLEAN      NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  created_by   UUID,
  updated_by   UUID,
  UNIQUE (tenant_id, feature_code)
);

CREATE INDEX idx_tenant_features_tenant_id ON public.tenant_features(tenant_id);

CREATE TRIGGER trg_tenant_features_updated_at
BEFORE UPDATE ON public.tenant_features
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_features TO anon, authenticated;
GRANT ALL ON public.tenant_features TO service_role;

ALTER TABLE public.tenant_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prd1_tenant_features_all_anon"          ON public.tenant_features FOR ALL TO anon          USING (true) WITH CHECK (true);
CREATE POLICY "prd1_tenant_features_all_authenticated" ON public.tenant_features FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 5. audit_logs ------------------------------------------------------------
CREATE TABLE public.audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  entity_type  VARCHAR(100) NOT NULL,
  entity_id    UUID,
  action       VARCHAR(100) NOT NULL,
  performed_by UUID,
  old_value    JSONB,
  new_value    JSONB,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_tenant_id   ON public.audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_entity      ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at  ON public.audit_logs(created_at DESC);

GRANT SELECT, INSERT ON public.audit_logs TO anon, authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prd1_audit_logs_select_anon"          ON public.audit_logs FOR SELECT TO anon          USING (true);
CREATE POLICY "prd1_audit_logs_insert_anon"          ON public.audit_logs FOR INSERT TO anon          WITH CHECK (true);
CREATE POLICY "prd1_audit_logs_select_authenticated" ON public.audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "prd1_audit_logs_insert_authenticated" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);
