
-- 1. Extend startups
ALTER TABLE public.startups
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS company_type varchar(100),
  ADD COLUMN IF NOT EXISTS year_founded integer,
  ADD COLUMN IF NOT EXISTS email varchar(255),
  ADD COLUMN IF NOT EXISTS headquarters varchar(255),
  ADD COLUMN IF NOT EXISTS investment_stage varchar(50),
  ADD COLUMN IF NOT EXISTS product_tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS market_tags text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.startups
  DROP CONSTRAINT IF EXISTS startups_investment_stage_chk;
ALTER TABLE public.startups
  ADD CONSTRAINT startups_investment_stage_chk
  CHECK (investment_stage IS NULL OR investment_stage IN
    ('Pre-Seed','Seed','Series A','Series B','Series C','Growth','Other'));

-- Validation trigger (year + tag caps)
CREATE OR REPLACE FUNCTION public.tg_validate_startup()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.year_founded IS NOT NULL THEN
    IF NEW.year_founded < 1800 OR NEW.year_founded > EXTRACT(YEAR FROM now())::int THEN
      RAISE EXCEPTION 'year_founded out of range';
    END IF;
  END IF;
  IF NEW.product_tags IS NOT NULL AND array_length(NEW.product_tags, 1) > 5 THEN
    RAISE EXCEPTION 'product_tags exceeds 5 entries';
  END IF;
  IF NEW.market_tags IS NOT NULL AND array_length(NEW.market_tags, 1) > 5 THEN
    RAISE EXCEPTION 'market_tags exceeds 5 entries';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_validate_startup ON public.startups;
CREATE TRIGGER trg_validate_startup
  BEFORE INSERT OR UPDATE ON public.startups
  FOR EACH ROW EXECUTE FUNCTION public.tg_validate_startup();

CREATE INDEX IF NOT EXISTS idx_startups_product_tags ON public.startups USING gin (product_tags);
CREATE INDEX IF NOT EXISTS idx_startups_market_tags ON public.startups USING gin (market_tags);
CREATE INDEX IF NOT EXISTS idx_startups_stage ON public.startups (investment_stage);
CREATE INDEX IF NOT EXISTS idx_startups_industry ON public.startups (industry);
CREATE INDEX IF NOT EXISTS idx_startups_hq ON public.startups (headquarters);
CREATE INDEX IF NOT EXISTS idx_startups_company_type ON public.startups (company_type);

-- 2. startup_media
CREATE TABLE IF NOT EXISTS public.startup_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  startup_id uuid NOT NULL REFERENCES public.startups(id) ON DELETE CASCADE,
  slot smallint NOT NULL CHECK (slot BETWEEN 1 AND 3),
  image_url text NOT NULL,
  storage_path text,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (startup_id, slot)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.startup_media TO authenticated;
GRANT ALL ON public.startup_media TO service_role;
ALTER TABLE public.startup_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY sm_select ON public.startup_media FOR SELECT TO authenticated
  USING (public.can_access_startup(auth.uid(), startup_id));
CREATE POLICY sm_insert ON public.startup_media FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_startup(auth.uid(), tenant_id));
CREATE POLICY sm_update ON public.startup_media FOR UPDATE TO authenticated
  USING (public.can_manage_startup(auth.uid(), tenant_id))
  WITH CHECK (public.can_manage_startup(auth.uid(), tenant_id));
CREATE POLICY sm_delete ON public.startup_media FOR DELETE TO authenticated
  USING (public.can_manage_startup(auth.uid(), tenant_id));
CREATE TRIGGER trg_sm_tenant BEFORE INSERT OR UPDATE ON public.startup_media
  FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_startup_tenant_match();
CREATE TRIGGER trg_sm_updated BEFORE UPDATE ON public.startup_media
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3. startup_founders
CREATE TABLE IF NOT EXISTS public.startup_founders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  startup_id uuid NOT NULL REFERENCES public.startups(id) ON DELETE CASCADE,
  full_name varchar(255) NOT NULL,
  position varchar(255),
  linkedin_url text,
  bio text,
  photo_url text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.startup_founders TO authenticated;
GRANT ALL ON public.startup_founders TO service_role;
ALTER TABLE public.startup_founders ENABLE ROW LEVEL SECURITY;
CREATE POLICY sf_select ON public.startup_founders FOR SELECT TO authenticated
  USING (public.can_access_startup(auth.uid(), startup_id));
CREATE POLICY sf_insert ON public.startup_founders FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_startup(auth.uid(), tenant_id));
CREATE POLICY sf_update ON public.startup_founders FOR UPDATE TO authenticated
  USING (public.can_manage_startup(auth.uid(), tenant_id))
  WITH CHECK (public.can_manage_startup(auth.uid(), tenant_id));
CREATE POLICY sf_delete ON public.startup_founders FOR DELETE TO authenticated
  USING (public.can_manage_startup(auth.uid(), tenant_id));
CREATE TRIGGER trg_sf_tenant BEFORE INSERT OR UPDATE ON public.startup_founders
  FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_startup_tenant_match();
CREATE TRIGGER trg_sf_updated BEFORE UPDATE ON public.startup_founders
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX IF NOT EXISTS idx_sf_startup ON public.startup_founders (startup_id, display_order);

-- 4. startup_investors join
CREATE TABLE IF NOT EXISTS public.startup_investors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  startup_id uuid NOT NULL REFERENCES public.startups(id) ON DELETE CASCADE,
  investor_id uuid NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (startup_id, investor_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.startup_investors TO authenticated;
GRANT ALL ON public.startup_investors TO service_role;
ALTER TABLE public.startup_investors ENABLE ROW LEVEL SECURITY;
CREATE POLICY si_select ON public.startup_investors FOR SELECT TO authenticated
  USING (public.can_access_startup(auth.uid(), startup_id));
CREATE POLICY si_insert ON public.startup_investors FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_startup(auth.uid(), tenant_id));
CREATE POLICY si_delete ON public.startup_investors FOR DELETE TO authenticated
  USING (public.can_manage_startup(auth.uid(), tenant_id));

-- Enforce same-tenant for startup_id and investor_id
CREATE OR REPLACE FUNCTION public.tg_enforce_startup_investor_tenant()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s_tenant uuid; i_tenant uuid;
BEGIN
  SELECT tenant_id INTO s_tenant FROM public.startups WHERE id = NEW.startup_id;
  SELECT tenant_id INTO i_tenant FROM public.investors WHERE id = NEW.investor_id;
  IF s_tenant IS NULL OR i_tenant IS NULL THEN
    RAISE EXCEPTION 'startup or investor not found';
  END IF;
  IF s_tenant <> i_tenant THEN
    RAISE EXCEPTION 'startup and investor must belong to the same tenant';
  END IF;
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := s_tenant;
  ELSIF NEW.tenant_id <> s_tenant THEN
    RAISE EXCEPTION 'tenant_id must match startup tenant';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_si_tenant BEFORE INSERT OR UPDATE ON public.startup_investors
  FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_startup_investor_tenant();
CREATE TRIGGER trg_si_updated BEFORE UPDATE ON public.startup_investors
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
