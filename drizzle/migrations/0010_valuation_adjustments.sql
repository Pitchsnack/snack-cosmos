CREATE TABLE public.valuation_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid NOT NULL REFERENCES public.startups(id) ON DELETE CASCADE,
  tenant_id uuid,
  fiscal_year integer NOT NULL,
  stake text NOT NULL DEFAULT 'minority' CHECK (stake IN ('minority','controlling')),
  tax_rate numeric NOT NULL DEFAULT 20,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (startup_id, fiscal_year)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.valuation_settings TO authenticated;
GRANT ALL ON public.valuation_settings TO service_role;

ALTER TABLE public.valuation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY vs_select ON public.valuation_settings FOR SELECT TO authenticated
  USING (public.can_access_startup(auth.uid(), startup_id));
CREATE POLICY vs_write ON public.valuation_settings FOR ALL TO authenticated
  USING (public.can_manage_startup(auth.uid(), tenant_id))
  WITH CHECK (public.can_manage_startup(auth.uid(), tenant_id));

CREATE TABLE public.valuation_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid NOT NULL REFERENCES public.startups(id) ON DELETE CASCADE,
  tenant_id uuid,
  fiscal_year integer NOT NULL,
  description text NOT NULL,
  type text NOT NULL CHECK (type IN ('booked_expense','one_off_expense','missing_cost','unrecorded_income')),
  filing_line text CHECK (filing_line IN ('cost_of_goods_sold','selling_admin','other_expenses')),
  amount numeric NOT NULL CHECK (amount >= 0),
  recurs text NOT NULL DEFAULT 'yearly' CHECK (recurs IN ('yearly','one_off')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX valuation_adjustments_startup_year_idx
  ON public.valuation_adjustments (startup_id, fiscal_year);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.valuation_adjustments TO authenticated;
GRANT ALL ON public.valuation_adjustments TO service_role;

ALTER TABLE public.valuation_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY va_select ON public.valuation_adjustments FOR SELECT TO authenticated
  USING (public.can_access_startup(auth.uid(), startup_id));
CREATE POLICY va_write ON public.valuation_adjustments FOR ALL TO authenticated
  USING (public.can_manage_startup(auth.uid(), tenant_id))
  WITH CHECK (public.can_manage_startup(auth.uid(), tenant_id));