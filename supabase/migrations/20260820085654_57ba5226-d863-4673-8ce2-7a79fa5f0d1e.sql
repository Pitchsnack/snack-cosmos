CREATE TABLE IF NOT EXISTS public.investor_investors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  investor_id uuid NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  portfolio_investor_id uuid NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (investor_id, portfolio_investor_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.investor_investors TO authenticated;
GRANT ALL ON public.investor_investors TO service_role;

ALTER TABLE public.investor_investors ENABLE ROW LEVEL SECURITY;

CREATE POLICY ii_select ON public.investor_investors FOR SELECT TO authenticated
  USING (public.can_access_investor(auth.uid(), investor_id));
CREATE POLICY ii_insert ON public.investor_investors FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_investor(auth.uid(), tenant_id));
CREATE POLICY ii_update ON public.investor_investors FOR UPDATE TO authenticated
  USING (public.can_manage_investor(auth.uid(), tenant_id))
  WITH CHECK (public.can_manage_investor(auth.uid(), tenant_id));
CREATE POLICY ii_delete ON public.investor_investors FOR DELETE TO authenticated
  USING (public.can_manage_investor(auth.uid(), tenant_id));

CREATE OR REPLACE FUNCTION public.tg_enforce_investor_investor_tenant_match()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE parent_tenant uuid; child_tenant uuid;
BEGIN
  SELECT tenant_id INTO parent_tenant FROM public.investors WHERE id = NEW.investor_id;
  SELECT tenant_id INTO child_tenant FROM public.investors WHERE id = NEW.portfolio_investor_id;
  IF parent_tenant IS NULL OR child_tenant IS NULL THEN
    RAISE EXCEPTION 'parent or portfolio investor not found';
  END IF;
  IF parent_tenant <> child_tenant THEN
    RAISE EXCEPTION 'investor and portfolio investor must belong to the same tenant';
  END IF;
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := parent_tenant;
  ELSIF NEW.tenant_id <> parent_tenant THEN
    RAISE EXCEPTION 'tenant_id must match parent investor tenant';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ii_tenant_match
  BEFORE INSERT OR UPDATE ON public.investor_investors
  FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_investor_investor_tenant_match();

CREATE TRIGGER trg_ii_updated
  BEFORE UPDATE ON public.investor_investors
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_ii_investor ON public.investor_investors (investor_id);
CREATE INDEX IF NOT EXISTS idx_ii_portfolio_investor ON public.investor_investors (portfolio_investor_id);