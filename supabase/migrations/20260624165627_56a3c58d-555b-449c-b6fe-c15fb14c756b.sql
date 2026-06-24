
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
  IF _imported_by <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden: importer mismatch';
  END IF;

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

  SELECT * INTO _g FROM public.global_startups WHERE id = _global_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'global startup not found';
  END IF;
  IF _g.status NOT IN ('available','recommended') THEN
    RAISE EXCEPTION 'global startup is not importable (status=%)', _g.status;
  END IF;

  SELECT id INTO _existing
  FROM public.startups
  WHERE tenant_id = _tenant_id AND source_global_id = _global_id
  LIMIT 1;
  IF _existing IS NOT NULL THEN
    RAISE EXCEPTION 'already imported: tenant_startup_id=%', _existing
      USING ERRCODE = 'unique_violation';
  END IF;

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

  INSERT INTO public.startup_ownership (
    startup_id, tenant_id, owning_agent_user_id
  ) VALUES (
    _new_startup_id, _tenant_id, _owning_agent
  );

  INSERT INTO public.startup_ai_ownership (
    startup_id, tenant_id, owning_ai_agent_id
  ) VALUES (
    _new_startup_id, _tenant_id, _owning_ai_agent
  );

  INSERT INTO public.global_startup_imports (
    global_id, tenant_id, tenant_startup_id, imported_by, imported_at
  ) VALUES (
    _global_id, _tenant_id, _new_startup_id, _imported_by, now()
  );

  RETURN _new_startup_id;
END;
$$;
