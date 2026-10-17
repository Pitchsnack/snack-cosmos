DO $$ BEGIN
  CREATE TYPE public.profile_run_by AS ENUM ('none','owner','pitchsnack');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.startups ADD COLUMN IF NOT EXISTS run_by public.profile_run_by NOT NULL DEFAULT 'owner',
  ADD COLUMN IF NOT EXISTS prepared_by uuid, ADD COLUMN IF NOT EXISTS prepared_at timestamptz, ADD COLUMN IF NOT EXISTS owner_relation text;
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS run_by public.profile_run_by NOT NULL DEFAULT 'owner',
  ADD COLUMN IF NOT EXISTS prepared_by uuid, ADD COLUMN IF NOT EXISTS prepared_at timestamptz, ADD COLUMN IF NOT EXISTS owner_relation text;
ALTER TABLE public.advisor_firms ADD COLUMN IF NOT EXISTS run_by public.profile_run_by NOT NULL DEFAULT 'owner',
  ADD COLUMN IF NOT EXISTS prepared_by uuid, ADD COLUMN IF NOT EXISTS prepared_at timestamptz, ADD COLUMN IF NOT EXISTS owner_relation text;

-- Backfill: non-Admin owner -> owner; only Admin owners -> pitchsnack; nobody -> none.
WITH people AS (
  SELECT s.id, u.account_role FROM public.startups s JOIN public.users u ON u.id = s.created_by
  UNION ALL SELECT su.startup_id, u.account_role FROM public.startup_users su JOIN public.users u ON u.id = su.user_id
), agg AS (
  SELECT id, bool_or(coalesce(account_role,'') <> 'admin') AS has_client, count(*) n FROM people GROUP BY id
)
UPDATE public.startups s SET run_by = CASE WHEN a.id IS NULL THEN 'none'::public.profile_run_by
  WHEN a.has_client THEN 'owner' ELSE 'pitchsnack' END,
  prepared_by = CASE WHEN a.has_client THEN NULL ELSE s.created_by END,
  prepared_at = CASE WHEN a.has_client THEN NULL ELSE s.created_at END
FROM public.startups s2 LEFT JOIN agg a ON a.id = s2.id WHERE s2.id = s.id;

WITH agg AS (
  SELECT bp.investor_id id, bool_or(coalesce(u.account_role,'') <> 'admin') has_client
  FROM public.buyer_profiles bp JOIN public.users u ON u.id = bp.user_id WHERE bp.investor_id IS NOT NULL GROUP BY bp.investor_id
)
UPDATE public.investors i SET run_by = CASE WHEN a.id IS NULL THEN 'none'::public.profile_run_by
  WHEN a.has_client THEN 'owner'
  WHEN i.tenant_id = (SELECT id FROM public.tenants WHERE tenant_code ILIKE 'control' LIMIT 1) THEN 'pitchsnack' ELSE 'none' END,
  prepared_by = CASE WHEN a.has_client THEN NULL ELSE i.created_by END,
  prepared_at = CASE WHEN a.has_client THEN NULL ELSE i.created_at END
FROM public.investors i2 LEFT JOIN agg a ON a.id = i2.id WHERE i2.id = i.id;

UPDATE public.advisor_firms f SET run_by = CASE WHEN f.owner_user_id IS NULL THEN 'none'::public.profile_run_by
  WHEN coalesce(u.account_role,'') <> 'admin' THEN 'owner' ELSE 'pitchsnack' END,
  prepared_by = CASE WHEN coalesce(u.account_role,'') = 'admin' THEN f.owner_user_id END,
  prepared_at = CASE WHEN coalesce(u.account_role,'') = 'admin' THEN f.created_at END
FROM public.advisor_firms f2 LEFT JOIN public.users u ON u.id = f2.owner_user_id WHERE f2.id = f.id;

-- New profiles: Admin-created start as 'none' (prepared), sign-up ones as 'owner'.
CREATE OR REPLACE FUNCTION public.tg_profile_run_by_default() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND public.account_role_of(auth.uid()) = 'admin' THEN
    NEW.run_by := 'none'; NEW.prepared_by := auth.uid(); NEW.prepared_at := now();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS zz_run_by_default ON public.startups;
CREATE TRIGGER zz_run_by_default BEFORE INSERT ON public.startups FOR EACH ROW EXECUTE FUNCTION public.tg_profile_run_by_default();
DROP TRIGGER IF EXISTS zz_run_by_default ON public.investors;
CREATE TRIGGER zz_run_by_default BEFORE INSERT ON public.investors FOR EACH ROW EXECUTE FUNCTION public.tg_profile_run_by_default();
DROP TRIGGER IF EXISTS zz_run_by_default ON public.advisor_firms;
CREATE TRIGGER zz_run_by_default BEFORE INSERT ON public.advisor_firms FOR EACH ROW EXECUTE FUNCTION public.tg_profile_run_by_default();

-- Non-Admin users can't change run_by / prepared fields.
CREATE OR REPLACE FUNCTION public.tg_profile_run_by_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND coalesce(public.account_role_of(auth.uid()),'') <> 'admin'
     AND (NEW.run_by IS DISTINCT FROM OLD.run_by OR NEW.prepared_by IS DISTINCT FROM OLD.prepared_by) THEN
    NEW.run_by := OLD.run_by; NEW.prepared_by := OLD.prepared_by; NEW.prepared_at := OLD.prepared_at;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS zz_run_by_guard ON public.startups;
CREATE TRIGGER zz_run_by_guard BEFORE UPDATE ON public.startups FOR EACH ROW EXECUTE FUNCTION public.tg_profile_run_by_guard();
DROP TRIGGER IF EXISTS zz_run_by_guard ON public.investors;
CREATE TRIGGER zz_run_by_guard BEFORE UPDATE ON public.investors FOR EACH ROW EXECUTE FUNCTION public.tg_profile_run_by_guard();
DROP TRIGGER IF EXISTS zz_run_by_guard ON public.advisor_firms;
CREATE TRIGGER zz_run_by_guard BEFORE UPDATE ON public.advisor_firms FOR EACH ROW EXECUTE FUNCTION public.tg_profile_run_by_guard();

CREATE TABLE public.profile_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('startup','investor','firm')),
  profile_id uuid NOT NULL,
  email text NOT NULL, first_name text NOT NULL, last_name text NOT NULL,
  owner_relation text, language text NOT NULL DEFAULT 'en' CHECK (language IN ('th','en')),
  sent_by text NOT NULL DEFAULT 'PitchSnack team', note text,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24),'hex'),
  created_by uuid, sent_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  opened_at timestamptz, accepted_at timestamptz, accepted_user_id uuid, cancelled_at timestamptz
);
CREATE UNIQUE INDEX profile_invitations_one_active ON public.profile_invitations(kind, profile_id) WHERE accepted_at IS NULL AND cancelled_at IS NULL;

CREATE TABLE public.managed_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('startup','investor','firm')),
  profile_id uuid NOT NULL,
  first_name text NOT NULL, last_name text NOT NULL, email text, phone text, owner_relation text,
  managed_by text NOT NULL DEFAULT 'PitchSnack team',
  agreed_in_writing boolean NOT NULL DEFAULT true, confirmed_by uuid,
  since timestamptz NOT NULL DEFAULT now(), ended_at timestamptz
);
CREATE UNIQUE INDEX managed_clients_one_active ON public.managed_clients(kind, profile_id) WHERE ended_at IS NULL;

CREATE TABLE public.profile_part_checks (
  kind text NOT NULL, profile_id uuid NOT NULL, part text NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now(), changed boolean NOT NULL DEFAULT false, checked_by uuid,
  PRIMARY KEY (kind, profile_id, part)
);

CREATE TABLE public.profile_field_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL, profile_id uuid NOT NULL, part text NOT NULL, field text NOT NULL,
  old_value text, new_value text, changed_by uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.profile_field_changes(kind, profile_id);

CREATE TABLE public.profile_handover_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL, profile_id uuid NOT NULL, event text NOT NULL, detail text,
  actor uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.profile_handover_events(kind, profile_id, created_at DESC);

GRANT ALL ON public.profile_invitations, public.managed_clients, public.profile_part_checks,
  public.profile_field_changes, public.profile_handover_events TO service_role;
ALTER TABLE public.profile_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.managed_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_part_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_field_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_handover_events ENABLE ROW LEVEL SECURITY;
-- No policies: only server code (after a Control Admin or owner check) touches these.