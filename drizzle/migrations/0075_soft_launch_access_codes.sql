CREATE TABLE public.access_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^PS-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$'),
  client_name text NOT NULL CHECK (length(btrim(client_name)) > 0),
  invite_email text,
  role text NOT NULL CHECK (role IN ('seller','buyer','advisor','any')),
  free_plan text,
  free_months int NOT NULL DEFAULT 3 CHECK (free_months BETWEEN 1 AND 12),
  max_accounts int NOT NULL DEFAULT 3 CHECK (max_accounts BETWEEN 1 AND 50),
  ends_on date,
  switched_off_at timestamptz,
  switched_off_by uuid,
  note text,
  invite_sent_at timestamptz,
  invite_sent_by uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.access_codes TO authenticated;
GRANT ALL ON public.access_codes TO service_role;
ALTER TABLE public.access_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage access codes" ON public.access_codes FOR ALL TO authenticated
  USING (public.is_control(auth.uid())) WITH CHECK (public.is_control(auth.uid()));

CREATE TABLE public.access_devices (
  id text PRIMARY KEY,
  code_id uuid NOT NULL REFERENCES public.access_codes(id) ON DELETE CASCADE,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  visits int NOT NULL DEFAULT 1
);
GRANT SELECT ON public.access_devices TO authenticated;
GRANT ALL ON public.access_devices TO service_role;
ALTER TABLE public.access_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read access devices" ON public.access_devices FOR SELECT TO authenticated USING (public.is_control(auth.uid()));

CREATE TABLE public.access_failures (
  key text PRIMARY KEY,
  in_a_row int NOT NULL DEFAULT 0,
  hour_count int NOT NULL DEFAULT 0,
  hour_started_at timestamptz NOT NULL DEFAULT now(),
  paused_until timestamptz
);
GRANT ALL ON public.access_failures TO service_role;
ALTER TABLE public.access_failures ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.soft_launch_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  gate_on boolean NOT NULL DEFAULT false,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid,
  usual_free_plans jsonb NOT NULL DEFAULT '{"seller":"pro","buyer":"investor","advisor":"basic"}'::jsonb
);
INSERT INTO public.soft_launch_settings (id) VALUES (true);
GRANT SELECT, UPDATE ON public.soft_launch_settings TO authenticated;
GRANT ALL ON public.soft_launch_settings TO service_role;
ALTER TABLE public.soft_launch_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage soft launch" ON public.soft_launch_settings FOR ALL TO authenticated
  USING (public.is_control(auth.uid())) WITH CHECK (public.is_control(auth.uid()));

ALTER TABLE public.users ADD COLUMN access_code_id uuid REFERENCES public.access_codes(id);
ALTER TABLE public.subscriptions
  ADD COLUMN source text CHECK (source IN ('access_code')),
  ADD COLUMN access_code_id uuid REFERENCES public.access_codes(id),
  ADD COLUMN free_reminder_sent_at timestamptz,
  ADD COLUMN free_end_email_sent_at timestamptz,
  ADD COLUMN free_end_seen_at timestamptz,
  ADD COLUMN free_bar_hidden_on date;

CREATE OR REPLACE FUNCTION public.tg_guard_access_code_id() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_control(auth.uid())
     AND NEW.access_code_id IS DISTINCT FROM (CASE WHEN TG_OP='UPDATE' THEN OLD.access_code_id ELSE NULL END) THEN
    RAISE EXCEPTION 'access_code_id can only be set by the server';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_access_code_id BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.tg_guard_access_code_id();