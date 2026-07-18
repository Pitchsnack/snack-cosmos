
-- 1. Table
CREATE TABLE public.default_intake_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  default_startup_intake_agent_id uuid NOT NULL REFERENCES public.users(id),
  default_startup_intake_ai_agent_id uuid NOT NULL REFERENCES public.users(id),
  default_investor_intake_agent_id uuid NOT NULL REFERENCES public.users(id),
  default_investor_intake_ai_agent_id uuid NOT NULL REFERENCES public.users(id),
  updated_by_user_id uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Grants
GRANT SELECT, INSERT, UPDATE ON public.default_intake_settings TO authenticated;
GRANT ALL ON public.default_intake_settings TO service_role;

-- 3. RLS
ALTER TABLE public.default_intake_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY dis_select ON public.default_intake_settings
  FOR SELECT TO authenticated
  USING (public.user_in_tenant(auth.uid(), tenant_id));

CREATE POLICY dis_insert ON public.default_intake_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_control(auth.uid())
    OR public.is_tenant_admin_of(auth.uid(), tenant_id)
    OR public.is_master_agent_of(auth.uid(), tenant_id)
  );

CREATE POLICY dis_update ON public.default_intake_settings
  FOR UPDATE TO authenticated
  USING (
    public.is_control(auth.uid())
    OR public.is_tenant_admin_of(auth.uid(), tenant_id)
    OR public.is_master_agent_of(auth.uid(), tenant_id)
  )
  WITH CHECK (
    public.is_control(auth.uid())
    OR public.is_tenant_admin_of(auth.uid(), tenant_id)
    OR public.is_master_agent_of(auth.uid(), tenant_id)
  );

-- 4. updated_at trigger (reuses existing helper)
CREATE TRIGGER trg_dis_updated_at
BEFORE UPDATE ON public.default_intake_settings
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 5. Validation trigger: enforce tenant scope, active status, and AI domain
CREATE OR REPLACE FUNCTION public.tg_validate_default_intake_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
BEGIN
  -- Human Startup Agent: Human, Active, in tenant
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.user_tenants ut ON ut.user_id = u.id AND ut.tenant_id = NEW.tenant_id
    WHERE u.id = NEW.default_startup_intake_agent_id
      AND u.user_type = 'Human' AND u.status = 'Active'
  ) INTO v_ok;
  IF NOT v_ok THEN RAISE EXCEPTION 'default_startup_intake_agent_id invalid (must be Active Human in tenant)'; END IF;

  -- Human Investor Agent
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.user_tenants ut ON ut.user_id = u.id AND ut.tenant_id = NEW.tenant_id
    WHERE u.id = NEW.default_investor_intake_agent_id
      AND u.user_type = 'Human' AND u.status = 'Active'
  ) INTO v_ok;
  IF NOT v_ok THEN RAISE EXCEPTION 'default_investor_intake_agent_id invalid (must be Active Human in tenant)'; END IF;

  -- Startup AI Agent: AI, Active, in tenant, TENANT_STARTUP_AI role
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.user_tenants ut ON ut.user_id = u.id AND ut.tenant_id = NEW.tenant_id
    JOIN public.user_roles ur   ON ur.user_id = u.id AND ur.tenant_id = NEW.tenant_id
    JOIN public.roles r         ON r.id = ur.role_id
    WHERE u.id = NEW.default_startup_intake_ai_agent_id
      AND u.user_type = 'AI' AND u.status = 'Active'
      AND r.role_code = 'TENANT_STARTUP_AI'::public.app_role
  ) INTO v_ok;
  IF NOT v_ok THEN RAISE EXCEPTION 'default_startup_intake_ai_agent_id must be an Active Startup AI in tenant'; END IF;

  -- Investor AI Agent
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.user_tenants ut ON ut.user_id = u.id AND ut.tenant_id = NEW.tenant_id
    JOIN public.user_roles ur   ON ur.user_id = u.id AND ur.tenant_id = NEW.tenant_id
    JOIN public.roles r         ON r.id = ur.role_id
    WHERE u.id = NEW.default_investor_intake_ai_agent_id
      AND u.user_type = 'AI' AND u.status = 'Active'
      AND r.role_code = 'TENANT_INVESTOR_AI'::public.app_role
  ) INTO v_ok;
  IF NOT v_ok THEN RAISE EXCEPTION 'default_investor_intake_ai_agent_id must be an Active Investor AI in tenant'; END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_dis_validate
BEFORE INSERT OR UPDATE ON public.default_intake_settings
FOR EACH ROW EXECUTE FUNCTION public.tg_validate_default_intake_settings();
