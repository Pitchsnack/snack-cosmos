-- PRD 4.1 — Startup Tenant Denormalization

-- Step 1: Add nullable tenant_id columns
ALTER TABLE public.startup_users ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.startup_tags  ADD COLUMN IF NOT EXISTS tenant_id uuid;

-- Step 2: Backfill from parent startups
UPDATE public.startup_users su
SET tenant_id = s.tenant_id
FROM public.startups s
WHERE su.startup_id = s.id
  AND su.tenant_id IS DISTINCT FROM s.tenant_id;

UPDATE public.startup_tags st
SET tenant_id = s.tenant_id
FROM public.startups s
WHERE st.startup_id = s.id
  AND st.tenant_id IS DISTINCT FROM s.tenant_id;

-- Step 3: Validate (raise if any orphan rows)
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.startup_users WHERE tenant_id IS NULL;
  IF n > 0 THEN RAISE EXCEPTION 'startup_users has % rows with NULL tenant_id', n; END IF;
  SELECT count(*) INTO n FROM public.startup_tags  WHERE tenant_id IS NULL;
  IF n > 0 THEN RAISE EXCEPTION 'startup_tags has % rows with NULL tenant_id', n; END IF;
END $$;

-- Step 4: Enforce NOT NULL
ALTER TABLE public.startup_users ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.startup_tags  ALTER COLUMN tenant_id SET NOT NULL;

-- Step 5: Foreign keys to tenants(id)
ALTER TABLE public.startup_users
  ADD CONSTRAINT startup_users_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.startup_tags
  ADD CONSTRAINT startup_tags_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Step 6: Indexes for direct tenant filtering
CREATE INDEX IF NOT EXISTS idx_startup_users_tenant_id ON public.startup_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_startup_tags_tenant_id  ON public.startup_tags(tenant_id);

-- Step 7: Consistency trigger — ensure child tenant_id matches parent startup's tenant_id
CREATE OR REPLACE FUNCTION public.tg_enforce_startup_tenant_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE parent_tenant uuid;
BEGIN
  SELECT s.tenant_id INTO parent_tenant FROM public.startups s WHERE s.id = NEW.startup_id;
  IF parent_tenant IS NULL THEN
    RAISE EXCEPTION 'Parent startup % not found', NEW.startup_id;
  END IF;
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := parent_tenant;
  ELSIF NEW.tenant_id <> parent_tenant THEN
    RAISE EXCEPTION 'tenant_id (%) does not match parent startup tenant_id (%)', NEW.tenant_id, parent_tenant;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_tenant_match_startup_users ON public.startup_users;
CREATE TRIGGER enforce_tenant_match_startup_users
BEFORE INSERT OR UPDATE ON public.startup_users
FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_startup_tenant_match();

DROP TRIGGER IF EXISTS enforce_tenant_match_startup_tags ON public.startup_tags;
CREATE TRIGGER enforce_tenant_match_startup_tags
BEFORE INSERT OR UPDATE ON public.startup_tags
FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_startup_tenant_match();
