ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS welcome_tour_seen_at timestamptz;

-- Existing accounts count as seen.
UPDATE public.user_profiles SET welcome_tour_seen_at = now() WHERE welcome_tour_seen_at IS NULL;
INSERT INTO public.user_profiles (user_id, welcome_tour_seen_at)
  SELECT u.id, now() FROM public.users u
  WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.user_id = u.id);

-- Users can't set the date themselves through ordinary writes; only mark_welcome_tour_seen() does.
CREATE OR REPLACE FUNCTION public.guard_welcome_tour_seen()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_setting('app.welcome_tour', true) = 'on' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN NEW.welcome_tour_seen_at := NULL;
  ELSE NEW.welcome_tour_seen_at := OLD.welcome_tour_seen_at; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER user_profiles_guard_welcome_tour BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_welcome_tour_seen();

CREATE OR REPLACE FUNCTION public.mark_welcome_tour_seen()
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); ts timestamptz;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  PERFORM set_config('app.welcome_tour', 'on', true);
  INSERT INTO public.user_profiles (user_id, welcome_tour_seen_at) VALUES (uid, now())
    ON CONFLICT (user_id) DO UPDATE SET welcome_tour_seen_at = COALESCE(public.user_profiles.welcome_tour_seen_at, now())
    RETURNING welcome_tour_seen_at INTO ts;
  PERFORM set_config('app.welcome_tour', 'off', true);
  RETURN ts;
END $$;
REVOKE ALL ON FUNCTION public.mark_welcome_tour_seen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_welcome_tour_seen() TO authenticated;