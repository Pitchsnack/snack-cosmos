ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS company_type text, ADD COLUMN IF NOT EXISTS company_type_source text NOT NULL DEFAULT 'account';

CREATE OR REPLACE FUNCTION public.company_type_for_relation(_rel text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN _rel = 'individual' THEN 'Individual' WHEN _rel IN ('corporate','agent') THEN 'Corporate Enterprise' ELSE NULL END
$$;

CREATE OR REPLACE FUNCTION public.buyer_relation_sets_company_type() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.investor_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.buyer_relation IS DISTINCT FROM OLD.buyer_relation OR NEW.investor_id IS DISTINCT FROM OLD.investor_id) THEN
    UPDATE public.investors SET company_type = public.company_type_for_relation(NEW.buyer_relation), company_type_source = 'account'
    WHERE id = NEW.investor_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_buyer_relation_company_type ON public.buyer_profiles;
CREATE TRIGGER trg_buyer_relation_company_type AFTER INSERT OR UPDATE OF buyer_relation, investor_id ON public.buyer_profiles
FOR EACH ROW EXECUTE FUNCTION public.buyer_relation_sets_company_type();

UPDATE public.investors i SET company_type = public.company_type_for_relation(bp.buyer_relation), company_type_source = 'account'
FROM public.buyer_profiles bp WHERE bp.investor_id = i.id;

UPDATE public.startups SET company_type = 'SME', company_type_source = 'account' WHERE company_type IS DISTINCT FROM 'SME';