
-- =========================================================================
-- 1. global_startups — Control-owned catalogue (no tenant_id)
-- =========================================================================
CREATE TABLE public.global_startups (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  sector       text,
  stage        text,
  description  text,
  website      text,
  tags         text[] NOT NULL DEFAULT '{}'::text[],
  status       text NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','available','recommended','archived')),
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.global_startups TO authenticated;
GRANT ALL ON public.global_startups TO service_role;

ALTER TABLE public.global_startups ENABLE ROW LEVEL SECURITY;

-- Control reads all; tenant roles read available/recommended only.
CREATE POLICY "global_startups_select_control_or_published"
  ON public.global_startups
  FOR SELECT
  TO authenticated
  USING (
    public.is_control(auth.uid())
    OR status IN ('available','recommended')
  );

-- Only Control may insert/update.
CREATE POLICY "global_startups_insert_control"
  ON public.global_startups
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_control(auth.uid()));

CREATE POLICY "global_startups_update_control"
  ON public.global_startups
  FOR UPDATE
  TO authenticated
  USING (public.is_control(auth.uid()))
  WITH CHECK (public.is_control(auth.uid()));

-- No DELETE policy. Archive via status.

CREATE INDEX idx_global_startups_status ON public.global_startups (status);
CREATE INDEX idx_global_startups_tags   ON public.global_startups USING gin (tags);

CREATE TRIGGER tg_global_startups_set_updated_at
  BEFORE UPDATE ON public.global_startups
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================================
-- 2. startups — duplicate import guard
-- (source_global_id + imported_at columns already exist)
-- =========================================================================
CREATE UNIQUE INDEX IF NOT EXISTS ux_startups_tenant_source_global
  ON public.startups (tenant_id, source_global_id)
  WHERE source_global_id IS NOT NULL;

-- =========================================================================
-- 3. global_startup_imports — Control-side ledger
-- =========================================================================
CREATE TABLE public.global_startup_imports (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  global_id         uuid NOT NULL,                -- reference-only, no FK
  tenant_id         uuid NOT NULL,                -- reference-only, no FK
  tenant_startup_id uuid NOT NULL,                -- reference-only, no FK
  imported_by       uuid NOT NULL,
  imported_at       timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.global_startup_imports TO authenticated;
GRANT ALL ON public.global_startup_imports TO service_role;
-- No INSERT/UPDATE/DELETE for authenticated: writes flow only through
-- the import RPC (service_role) below.

ALTER TABLE public.global_startup_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "global_startup_imports_select_control_or_member"
  ON public.global_startup_imports
  FOR SELECT
  TO authenticated
  USING (
    public.is_control(auth.uid())
    OR public.user_in_tenant(auth.uid(), tenant_id)
  );

CREATE INDEX idx_global_startup_imports_global ON public.global_startup_imports (global_id);
CREATE INDEX idx_global_startup_imports_tenant ON public.global_startup_imports (tenant_id);

-- =========================================================================
-- 4. fn_import_global_startup — atomic import boundary
-- =========================================================================
-- Runs as SECURITY DEFINER so it can bypass the read-only RLS on the
-- ledger. Re-asserts caller role + active tenant + ownership eligibility
-- before any write. Single transaction: tenant startup row +
-- startup_ownership + startup_ai_ownership + ledger row, or nothing.
CREATE OR REPLACE FUNCTION public.fn_import_global_startup(
  _global_id          uuid,
  _tenant_id          uuid,
  _owning_agent       uuid,
  _owning_ai_agent    uuid,
  _imported_by        uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _g               public.global_startups%ROWTYPE;
  _existing        uuid;
  _new_startup_id  uuid;
  _agent_ok        boolean;
  _ai_ok           boolean;
  _has_import_perm boolean;
BEGIN
  -- 1. Caller must be the recorded importer in this prototype.
  IF _imported_by <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden: importer mismatch';
  END IF;

  -- 2. Caller must hold a role with import permission for the active tenant.
  _has_import_perm :=
       public.is_master_agent_of(_imported_by, _tenant_id)
    OR public.is_tenant_admin_of(_imported_by, _tenant_id)
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = _imported_by
        AND ur.tenant_id = _tenant_id
        AND r.role_code = 'TENANT_AGENT'::public.app_role
    );

  IF NOT _has_import_perm THEN
    RAISE EXCEPTION 'forbidden: caller lacks global_startups.import for tenant';
  END IF;

  -- 3. Global startup must exist and be importable.
  SELECT * INTO _g FROM public.global_startups WHERE id = _global_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'global startup not found';
  END IF;
  IF _g.status NOT IN ('available','recommended') THEN
    RAISE EXCEPTION 'global startup is not importable (status=%)', _g.status;
  END IF;

  -- 4. Duplicate check (also enforced by ux_startups_tenant_source_global).
  SELECT id INTO _existing
  FROM public.startups
  WHERE tenant_id = _tenant_id AND source_global_id = _global_id
  LIMIT 1;
  IF _existing IS NOT NULL THEN
    RAISE EXCEPTION 'already imported: tenant_startup_id=%', _existing
      USING ERRCODE = 'unique_violation';
  END IF;

  -- 5. Owning Agent: human user in the tenant with an allowed role.
  _agent_ok := EXISTS (
    SELECT 1
    FROM public.users u
    JOIN public.user_tenants ut ON ut.user_id = u.id AND ut.tenant_id = _tenant_id
    JOIN public.user_roles ur   ON ur.user_id = u.id AND ur.tenant_id = _tenant_id
    JOIN public.roles r         ON r.id = ur.role_id
    WHERE u.id = _owning_agent
      AND u.user_type = 'Human'
      AND r.role_code IN (
        'MASTER_AGENT'::public.app_role,
        'TENANT_ADMIN'::public.app_role,
        'TENANT_AGENT'::public.app_role
      )
  );
  IF NOT _agent_ok THEN
    RAISE EXCEPTION 'invalid owning Agent for tenant';
  END IF;

  -- 6. Owning AI Agent: AI user in the tenant with an AI role.
  _ai_ok := EXISTS (
    SELECT 1
    FROM public.users u
    JOIN public.user_tenants ut ON ut.user_id = u.id AND ut.tenant_id = _tenant_id
    JOIN public.user_roles ur   ON ur.user_id = u.id AND ur.tenant_id = _tenant_id
    JOIN public.roles r         ON r.id = ur.role_id
    WHERE u.id = _owning_ai_agent
      AND u.user_type = 'AI'
      AND r.role_code IN (
        'MASTER_AGENT_AI'::public.app_role,
        'TENANT_STARTUP_AI'::public.app_role,
        'TENANT_INVESTOR_AI'::public.app_role,
        'TENANT_DEAL_AI'::public.app_role
      )
  );
  IF NOT _ai_ok THEN
    RAISE EXCEPTION 'invalid owning AI Agent for tenant';
  END IF;

  -- 7. Insert tenant startup copy.
  INSERT INTO public.startups (
    tenant_id, startup_name, website_url, industry,
    short_description, long_description,
    investment_stage, product_tags,
    status, visibility,
    source_global_id, imported_at,
    created_by, updated_by
  ) VALUES (
    _tenant_id,
    _g.name,
    NULLIF(_g.website, ''),
    NULLIF(_g.sector, ''),
    LEFT(COALESCE(_g.description, ''), 500),
    _g.description,
    CASE WHEN _g.stage IN ('Pre-Seed','Seed','Series A','Series B','Series C','Growth','Other')
         THEN _g.stage ELSE NULL END,
    COALESCE(_g.tags, '{}'::text[]),
    'Draft', 'Tenant',
    _global_id, now(),
    _imported_by, _imported_by
  )
  RETURNING id INTO _new_startup_id;

  -- 8. Ownership rows.
  INSERT INTO public.startup_ownership (
    startup_id, tenant_id, owning_agent_user_id, assigned_by, assigned_at
  ) VALUES (
    _new_startup_id, _tenant_id, _owning_agent, _imported_by, now()
  );

  INSERT INTO public.startup_ai_ownership (
    startup_id, tenant_id, owning_ai_agent_id, assigned_by, assigned_at
  ) VALUES (
    _new_startup_id, _tenant_id, _owning_ai_agent, _imported_by, now()
  );

  -- 9. Ledger row.
  INSERT INTO public.global_startup_imports (
    global_id, tenant_id, tenant_startup_id, imported_by, imported_at
  ) VALUES (
    _global_id, _tenant_id, _new_startup_id, _imported_by, now()
  );

  RETURN _new_startup_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_import_global_startup(uuid,uuid,uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_import_global_startup(uuid,uuid,uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_import_global_startup(uuid,uuid,uuid,uuid,uuid) TO service_role;
