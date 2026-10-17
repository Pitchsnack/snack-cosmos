CREATE TABLE public.sign_in_days (
 user_id uuid NOT NULL,
 day date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Bangkok')::date,
 first_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (user_id, day)
);
GRANT ALL ON public.sign_in_days TO service_role;
ALTER TABLE public.sign_in_days ENABLE ROW LEVEL SECURITY;
CREATE INDEX sign_in_days_day_idx ON public.sign_in_days(day);
CREATE OR REPLACE FUNCTION public.record_sign_in_day()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE recorded boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND account_role IN ('seller','buyer','advisor')) THEN RETURN false; END IF;
 INSERT INTO public.sign_in_days(user_id, day, first_at)
 VALUES(auth.uid(), (now() AT TIME ZONE 'Asia/Bangkok')::date, now())
 ON CONFLICT (user_id, day) DO NOTHING;
 recorded := FOUND;
 RETURN recorded;
END;
$$;
REVOKE ALL ON FUNCTION public.record_sign_in_day() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_sign_in_day() TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.prune_sign_in_days()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
 DELETE FROM public.sign_in_days WHERE day < ((now() AT TIME ZONE 'Asia/Bangkok')::date - interval '24 months')::date;
$$;
REVOKE ALL ON FUNCTION public.prune_sign_in_days() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_sign_in_days() TO service_role;
SELECT cron.schedule('analytics-sign-in-retention', '10 17 * * *', 'SELECT public.prune_sign_in_days()');