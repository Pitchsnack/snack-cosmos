CREATE TABLE public.company_info_th (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL UNIQUE REFERENCES public.startups(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  legal_name_th VARCHAR(255),
  registration_number VARCHAR(20),
  legal_entity_type_th VARCHAR(100),
  legal_entity_status_th VARCHAR(100),
  registration_date DATE,
  registration_date_th_raw VARCHAR(100),
  registered_capital_thb NUMERIC(18,2),
  registered_capital_th_raw VARCHAR(100),
  previous_registration_number VARCHAR(50),
  business_group_th VARCHAR(255),
  business_size VARCHAR(20),
  head_office_address_th TEXT,
  website VARCHAR(500),
  authorized_signatory_th TEXT,
  source_name VARCHAR(100) DEFAULT 'DBD Data Warehouse',
  source_url TEXT DEFAULT 'https://datawarehouse.dbd.go.th',
  retrieved_at TIMESTAMPTZ,
  manually_edited_at TIMESTAMPTZ,
  manually_edited_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.company_director_th (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_info_id UUID NOT NULL REFERENCES public.company_info_th(id) ON DELETE CASCADE,
  startup_id UUID NOT NULL REFERENCES public.startups(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  director_name_th VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.company_financial_submission_year_th (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_info_id UUID NOT NULL REFERENCES public.company_info_th(id) ON DELETE CASCADE,
  startup_id UUID NOT NULL REFERENCES public.startups(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  financial_year_be SMALLINT NOT NULL,
  financial_year_ce SMALLINT,
  is_latest BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_info_id, financial_year_be)
);

CREATE TABLE public.company_registered_business_th (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_info_id UUID NOT NULL UNIQUE REFERENCES public.company_info_th(id) ON DELETE CASCADE,
  startup_id UUID NOT NULL REFERENCES public.startups(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  business_code VARCHAR(20),
  business_description_th TEXT,
  business_objective_th TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.company_latest_business_th (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_info_id UUID NOT NULL UNIQUE REFERENCES public.company_info_th(id) ON DELETE CASCADE,
  startup_id UUID NOT NULL REFERENCES public.startups(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  financial_year_be SMALLINT,
  business_code VARCHAR(20),
  business_description_th TEXT,
  business_objective_th TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cith_startup ON public.company_info_th(startup_id);
CREATE INDEX idx_cdth_company ON public.company_director_th(company_info_id, display_order);
CREATE INDEX idx_cfsy_company ON public.company_financial_submission_year_th(company_info_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_info_th TO authenticated;
GRANT ALL ON public.company_info_th TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_director_th TO authenticated;
GRANT ALL ON public.company_director_th TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_financial_submission_year_th TO authenticated;
GRANT ALL ON public.company_financial_submission_year_th TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_registered_business_th TO authenticated;
GRANT ALL ON public.company_registered_business_th TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_latest_business_th TO authenticated;
GRANT ALL ON public.company_latest_business_th TO service_role;

ALTER TABLE public.company_info_th ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_director_th ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_financial_submission_year_th ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_registered_business_th ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_latest_business_th ENABLE ROW LEVEL SECURITY;

CREATE POLICY cith_select ON public.company_info_th FOR SELECT TO authenticated USING (public.can_access_startup(auth.uid(), startup_id));
CREATE POLICY cith_write ON public.company_info_th FOR ALL TO authenticated USING (public.can_manage_startup(auth.uid(), tenant_id)) WITH CHECK (public.can_manage_startup(auth.uid(), tenant_id));

CREATE POLICY cdth_select ON public.company_director_th FOR SELECT TO authenticated USING (public.can_access_startup(auth.uid(), startup_id));
CREATE POLICY cdth_write ON public.company_director_th FOR ALL TO authenticated USING (public.can_manage_startup(auth.uid(), tenant_id)) WITH CHECK (public.can_manage_startup(auth.uid(), tenant_id));

CREATE POLICY cfsy_select ON public.company_financial_submission_year_th FOR SELECT TO authenticated USING (public.can_access_startup(auth.uid(), startup_id));
CREATE POLICY cfsy_write ON public.company_financial_submission_year_th FOR ALL TO authenticated USING (public.can_manage_startup(auth.uid(), tenant_id)) WITH CHECK (public.can_manage_startup(auth.uid(), tenant_id));

CREATE POLICY crbth_select ON public.company_registered_business_th FOR SELECT TO authenticated USING (public.can_access_startup(auth.uid(), startup_id));
CREATE POLICY crbth_write ON public.company_registered_business_th FOR ALL TO authenticated USING (public.can_manage_startup(auth.uid(), tenant_id)) WITH CHECK (public.can_manage_startup(auth.uid(), tenant_id));

CREATE POLICY clbth_select ON public.company_latest_business_th FOR SELECT TO authenticated USING (public.can_access_startup(auth.uid(), startup_id));
CREATE POLICY clbth_write ON public.company_latest_business_th FOR ALL TO authenticated USING (public.can_manage_startup(auth.uid(), tenant_id)) WITH CHECK (public.can_manage_startup(auth.uid(), tenant_id));

CREATE TRIGGER trg_cith_updated BEFORE UPDATE ON public.company_info_th FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_cdth_updated BEFORE UPDATE ON public.company_director_th FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_cfsy_updated BEFORE UPDATE ON public.company_financial_submission_year_th FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_crbth_updated BEFORE UPDATE ON public.company_registered_business_th FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_clbth_updated BEFORE UPDATE ON public.company_latest_business_th FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();