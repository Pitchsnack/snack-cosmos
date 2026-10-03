CREATE TABLE public.email_alert_settings (
  alert_key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_alert_settings TO authenticated;
GRANT ALL ON public.email_alert_settings TO service_role;
ALTER TABLE public.email_alert_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages alert settings" ON public.email_alert_settings FOR ALL TO authenticated
  USING (public.is_control(auth.uid())) WITH CHECK (public.is_control(auth.uid()));

CREATE TABLE public.email_alert_rules (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  quiet_enabled boolean NOT NULL DEFAULT true,
  quiet_start text NOT NULL DEFAULT '22:00',
  quiet_end text NOT NULL DEFAULT '07:00',
  message_mode text NOT NULL DEFAULT 'instant' CHECK (message_mode IN ('instant','daily')),
  daily_time text NOT NULL DEFAULT '09:00',
  match_threshold int NOT NULL DEFAULT 4 CHECK (match_threshold BETWEEN 1 AND 5),
  weekly_day int NOT NULL DEFAULT 1 CHECK (weekly_day BETWEEN 0 AND 6),
  weekly_time text NOT NULL DEFAULT '09:00',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.email_alert_rules (id) VALUES (1);
GRANT SELECT, INSERT, UPDATE ON public.email_alert_rules TO authenticated;
GRANT ALL ON public.email_alert_rules TO service_role;
ALTER TABLE public.email_alert_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages alert rules" ON public.email_alert_rules FOR ALL TO authenticated
  USING (public.is_control(auth.uid())) WITH CHECK (public.is_control(auth.uid()));

CREATE TABLE public.email_alert_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_key text NOT NULL,
  role text NOT NULL,
  user_id uuid,
  email text,
  subject text,
  status text NOT NULL CHECK (status IN ('sent','skipped','suppressed','failed','test')),
  reason text,
  ref_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_alert_log_created_idx ON public.email_alert_log (created_at DESC);
CREATE INDEX email_alert_log_ref_idx ON public.email_alert_log (ref_key);
GRANT SELECT ON public.email_alert_log TO authenticated;
GRANT ALL ON public.email_alert_log TO service_role;
ALTER TABLE public.email_alert_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin reads alert log" ON public.email_alert_log FOR SELECT TO authenticated
  USING (public.is_control(auth.uid()));