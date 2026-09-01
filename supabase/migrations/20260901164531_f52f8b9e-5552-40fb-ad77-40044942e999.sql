
CREATE TABLE public.financial_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL REFERENCES public.startups(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  fiscal_year INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'THB',
  statement_basis VARCHAR DEFAULT 'standalone',
  source_name VARCHAR,
  source_reference VARCHAR,
  source_date DATE,
  verified_status VARCHAR DEFAULT 'unverified',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (startup_id, fiscal_year, statement_basis)
);

CREATE TABLE public.income_statement_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_statement_id UUID NOT NULL REFERENCES public.financial_statements(id) ON DELETE CASCADE,
  startup_id UUID NOT NULL REFERENCES public.startups(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  fiscal_year INTEGER NOT NULL,
  item_code VARCHAR NOT NULL,
  item_label VARCHAR NOT NULL,
  amount NUMERIC(20,2),
  percent_change NUMERIC(12,4),
  display_order INTEGER NOT NULL DEFAULT 0,
  is_total BOOLEAN NOT NULL DEFAULT false,
  source_reference VARCHAR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (financial_statement_id, item_code)
);

CREATE TABLE public.financial_position_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_statement_id UUID NOT NULL REFERENCES public.financial_statements(id) ON DELETE CASCADE,
  startup_id UUID NOT NULL REFERENCES public.startups(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  fiscal_year INTEGER NOT NULL,
  item_code VARCHAR NOT NULL,
  item_label VARCHAR NOT NULL,
  amount NUMERIC(20,2),
  percent_change NUMERIC(12,4),
  display_order INTEGER NOT NULL DEFAULT 0,
  is_total BOOLEAN NOT NULL DEFAULT false,
  source_reference VARCHAR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (financial_statement_id, item_code)
);

CREATE TABLE public.cash_flow_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_statement_id UUID NOT NULL REFERENCES public.financial_statements(id) ON DELETE CASCADE,
  startup_id UUID NOT NULL REFERENCES public.startups(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  fiscal_year INTEGER NOT NULL,
  section VARCHAR NOT NULL,
  item_code VARCHAR NOT NULL,
  item_label VARCHAR NOT NULL,
  amount NUMERIC(20,2),
  percent_change NUMERIC(12,4),
  display_order INTEGER NOT NULL DEFAULT 0,
  is_total BOOLEAN NOT NULL DEFAULT false,
  source_reference VARCHAR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (financial_statement_id, item_code)
);

CREATE TABLE public.financial_ratios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_statement_id UUID REFERENCES public.financial_statements(id) ON DELETE CASCADE,
  startup_id UUID NOT NULL REFERENCES public.startups(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  fiscal_year INTEGER NOT NULL,
  ratio_category VARCHAR NOT NULL,
  ratio_code VARCHAR NOT NULL,
  ratio_label VARCHAR NOT NULL,
  value NUMERIC(20,6),
  unit VARCHAR NOT NULL DEFAULT 'percent',
  display_order INTEGER NOT NULL DEFAULT 0,
  calculation_source VARCHAR DEFAULT 'imported',
  source_reference VARCHAR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (startup_id, fiscal_year, ratio_code)
);

CREATE INDEX idx_fs_startup_year ON public.financial_statements(startup_id, fiscal_year);
CREATE INDEX idx_isi_startup_year ON public.income_statement_items(startup_id, fiscal_year);
CREATE INDEX idx_fpi_startup_year ON public.financial_position_items(startup_id, fiscal_year);
CREATE INDEX idx_cfi_startup_year ON public.cash_flow_items(startup_id, fiscal_year);
CREATE INDEX idx_fr_startup_year ON public.financial_ratios(startup_id, fiscal_year);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_statements TO authenticated;
GRANT ALL ON public.financial_statements TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.income_statement_items TO authenticated;
GRANT ALL ON public.income_statement_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_position_items TO authenticated;
GRANT ALL ON public.financial_position_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_flow_items TO authenticated;
GRANT ALL ON public.cash_flow_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_ratios TO authenticated;
GRANT ALL ON public.financial_ratios TO service_role;

ALTER TABLE public.financial_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_statement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_position_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_flow_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_ratios ENABLE ROW LEVEL SECURITY;

CREATE POLICY fin_stmt_select ON public.financial_statements FOR SELECT TO authenticated USING (public.can_access_startup(auth.uid(), startup_id));
CREATE POLICY fin_stmt_write ON public.financial_statements FOR ALL TO authenticated USING (public.can_manage_startup(auth.uid(), tenant_id)) WITH CHECK (public.can_manage_startup(auth.uid(), tenant_id));

CREATE POLICY isi_select ON public.income_statement_items FOR SELECT TO authenticated USING (public.can_access_startup(auth.uid(), startup_id));
CREATE POLICY isi_write ON public.income_statement_items FOR ALL TO authenticated USING (public.can_manage_startup(auth.uid(), tenant_id)) WITH CHECK (public.can_manage_startup(auth.uid(), tenant_id));

CREATE POLICY fpi_select ON public.financial_position_items FOR SELECT TO authenticated USING (public.can_access_startup(auth.uid(), startup_id));
CREATE POLICY fpi_write ON public.financial_position_items FOR ALL TO authenticated USING (public.can_manage_startup(auth.uid(), tenant_id)) WITH CHECK (public.can_manage_startup(auth.uid(), tenant_id));

CREATE POLICY cfi_select ON public.cash_flow_items FOR SELECT TO authenticated USING (public.can_access_startup(auth.uid(), startup_id));
CREATE POLICY cfi_write ON public.cash_flow_items FOR ALL TO authenticated USING (public.can_manage_startup(auth.uid(), tenant_id)) WITH CHECK (public.can_manage_startup(auth.uid(), tenant_id));

CREATE POLICY fr_select ON public.financial_ratios FOR SELECT TO authenticated USING (public.can_access_startup(auth.uid(), startup_id));
CREATE POLICY fr_write ON public.financial_ratios FOR ALL TO authenticated USING (public.can_manage_startup(auth.uid(), tenant_id)) WITH CHECK (public.can_manage_startup(auth.uid(), tenant_id));

CREATE TRIGGER trg_fs_updated BEFORE UPDATE ON public.financial_statements FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_isi_updated BEFORE UPDATE ON public.income_statement_items FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_fpi_updated BEFORE UPDATE ON public.financial_position_items FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_cfi_updated BEFORE UPDATE ON public.cash_flow_items FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_fr_updated BEFORE UPDATE ON public.financial_ratios FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
