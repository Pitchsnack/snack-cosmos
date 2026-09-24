CREATE SEQUENCE IF NOT EXISTS public.hidden_profile_ref_seq START 1001;

CREATE TABLE public.hidden_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid NOT NULL UNIQUE REFERENCES public.startups(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  ref_no text NOT NULL DEFAULT ('PS-' || nextval('public.hidden_profile_ref_seq')::text),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','live')),
  published_at timestamptz,
  unpublished_at timestamptz,
  published_by uuid,
  code_name text NOT NULL,
  cover_art text,
  region text,
  headline text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  highlights text[] NOT NULL DEFAULT '{}',
  customers_summary text NOT NULL DEFAULT '',
  asking_price numeric,
  stake_pct numeric,
  deal_type text,
  structure text,
  reason text,
  handover text,
  process text,
  open_to text[] NOT NULL DEFAULT '{}',
  nda_approver text NOT NULL DEFAULT 'admin' CHECK (nda_approver IN ('seller','admin')),
  live jsonb,
  has_unpublished_changes boolean NOT NULL DEFAULT false,
  views integer NOT NULL DEFAULT 0,
  ndas_approved integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE UNIQUE INDEX hidden_profiles_code_name_uq ON public.hidden_profiles (lower(code_name));
CREATE INDEX hidden_profiles_tenant_idx ON public.hidden_profiles (tenant_id);
CREATE INDEX hidden_profiles_status_idx ON public.hidden_profiles (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hidden_profiles TO authenticated;
GRANT ALL ON public.hidden_profiles TO service_role;
GRANT USAGE ON SEQUENCE public.hidden_profile_ref_seq TO authenticated, service_role;

ALTER TABLE public.hidden_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Readers of the startup can read its hidden profile"
ON public.hidden_profiles FOR SELECT TO authenticated
USING (public.can_access_startup(auth.uid(), startup_id));

CREATE POLICY "Managers can insert hidden profiles"
ON public.hidden_profiles FOR INSERT TO authenticated
WITH CHECK (public.can_manage_startup(auth.uid(), tenant_id));

CREATE POLICY "Managers can update hidden profiles"
ON public.hidden_profiles FOR UPDATE TO authenticated
USING (public.can_manage_startup(auth.uid(), tenant_id))
WITH CHECK (public.can_manage_startup(auth.uid(), tenant_id));

CREATE POLICY "Managers can delete hidden profiles"
ON public.hidden_profiles FOR DELETE TO authenticated
USING (public.can_manage_startup(auth.uid(), tenant_id));

CREATE TRIGGER trg_hidden_profiles_updated BEFORE UPDATE ON public.hidden_profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER trg_hidden_profiles_tenant BEFORE INSERT OR UPDATE ON public.hidden_profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_startup_tenant_match();