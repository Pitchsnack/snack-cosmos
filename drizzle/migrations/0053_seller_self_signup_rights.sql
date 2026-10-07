ALTER TABLE public.startups ADD COLUMN IF NOT EXISTS setup_done_at timestamptz;
ALTER TABLE public.startups ADD COLUMN IF NOT EXISTS setup_from_signup text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.is_startup_member(_user_id uuid, _startup_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.startup_users su WHERE su.startup_id = _startup_id AND su.user_id = _user_id);
$$;

-- Sellers (startup members) edit only businesses they belong to.
CREATE POLICY seller_member_update_startup ON public.startups FOR UPDATE TO authenticated
  USING (public.is_startup_member(auth.uid(), id)) WITH CHECK (public.is_startup_member(auth.uid(), id));

-- Members can't move a business to another workspace or change its directory visibility.
CREATE OR REPLACE FUNCTION public.tg_startup_member_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.can_manage_startup(auth.uid(), OLD.tenant_id) THEN RETURN NEW; END IF;
  NEW.tenant_id := OLD.tenant_id;
  NEW.visibility := OLD.visibility;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS startup_member_guard ON public.startups;
CREATE TRIGGER startup_member_guard BEFORE UPDATE ON public.startups FOR EACH ROW EXECUTE FUNCTION public.tg_startup_member_guard();

CREATE POLICY seller_member_founders ON public.startup_founders FOR ALL TO authenticated
  USING (public.is_startup_member(auth.uid(), startup_id)) WITH CHECK (public.is_startup_member(auth.uid(), startup_id));
CREATE POLICY seller_member_media ON public.startup_media FOR ALL TO authenticated
  USING (public.is_startup_member(auth.uid(), startup_id)) WITH CHECK (public.is_startup_member(auth.uid(), startup_id));
CREATE POLICY seller_member_investors ON public.startup_investors FOR ALL TO authenticated
  USING (public.is_startup_member(auth.uid(), startup_id)) WITH CHECK (public.is_startup_member(auth.uid(), startup_id));
CREATE POLICY seller_member_tags ON public.startup_tags FOR ALL TO authenticated
  USING (public.is_startup_member(auth.uid(), startup_id)) WITH CHECK (public.is_startup_member(auth.uid(), startup_id));

-- Public view: members save and submit; Admin-only decisions stay guarded by guard_listing_approval.
CREATE POLICY seller_member_hidden_insert ON public.hidden_profiles FOR INSERT TO authenticated
  WITH CHECK (public.is_startup_member(auth.uid(), startup_id));
CREATE POLICY seller_member_hidden_update ON public.hidden_profiles FOR UPDATE TO authenticated
  USING (public.is_startup_member(auth.uid(), startup_id)) WITH CHECK (public.is_startup_member(auth.uid(), startup_id));
CREATE POLICY seller_member_submit ON public.listing_submissions FOR INSERT TO authenticated
  WITH CHECK (public.is_startup_member(auth.uid(), startup_id) AND submitted_by = auth.uid());