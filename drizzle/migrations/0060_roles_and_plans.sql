ALTER TABLE public.users ADD COLUMN IF NOT EXISTS account_role text CHECK (account_role IN ('seller','buyer','advisor','admin'));
COMMENT ON COLUMN public.users.advisor_view IS 'DEPRECATED: replaced by account_role';
ALTER TABLE public.startups ADD COLUMN IF NOT EXISTS registration_verified_at timestamptz;

CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL CHECK (role IN ('seller','buyer','advisor')),
  key text NOT NULL, name text NOT NULL,
  status text NOT NULL DEFAULT 'live' CHECK (status IN ('live','hidden')),
  sort int NOT NULL DEFAULT 0,
  price_type text NOT NULL CHECK (price_type IN ('paid','free','on_request')),
  price_thb int, term_months int NOT NULL CHECK (term_months IN (1,3,6,12)),
  completion_fee_pct numeric, value_cap_thb_m numeric,
  requests_mode text NOT NULL DEFAULT 'none' CHECK (requests_mode IN ('none','number','unlimited','contract','bundles')), requests_n int,
  clients_mode text CHECK (clients_mode IN ('number','unlimited','contract')), clients_n int,
  users_mode text CHECK (users_mode IN ('number','unlimited','contract')), users_n int,
  mandates_mode text CHECK (mandates_mode IN ('number','unlimited','contract')), mandates_n int,
  has_data_room boolean NOT NULL DEFAULT false, has_manager boolean NOT NULL DEFAULT false,
  has_valuation_video boolean NOT NULL DEFAULT false, has_site_visit boolean NOT NULL DEFAULT false,
  has_shortlists boolean NOT NULL DEFAULT false, has_screening boolean NOT NULL DEFAULT false,
  verification_mode text CHECK (verification_mode IN ('included','paid','none')), verification_price_thb int,
  badge_style text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, key)
);
GRANT SELECT ON public.plans TO authenticated, anon;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans readable" ON public.plans FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "plans admin write" ON public.plans FOR ALL TO authenticated USING (public.is_control(auth.uid())) WITH CHECK (public.is_control(auth.uid()));
GRANT INSERT, UPDATE, DELETE ON public.plans TO authenticated;

CREATE TABLE public.plan_reports (
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  report_key text NOT NULL CHECK (report_key IN ('fs5','fs3','fs1','verification','pnl','risk','credit')),
  mode text NOT NULL CHECK (mode IN ('none','number','unlimited','contract')),
  per_term int,
  PRIMARY KEY (plan_id, report_key)
);
GRANT SELECT ON public.plan_reports TO authenticated, anon;
GRANT ALL ON public.plan_reports TO service_role;
ALTER TABLE public.plan_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan reports readable" ON public.plan_reports FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended')),
  term_start timestamptz NOT NULL DEFAULT now(),
  term_end timestamptz,
  price_paid_thb int, manager_user_id uuid, nda_credits int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own subscription" ON public.subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_control(auth.uid()));

CREATE TABLE public.plan_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  ref text,
  term_start timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX plan_usage_lookup ON public.plan_usage(user_id, kind, term_start);
GRANT SELECT ON public.plan_usage TO authenticated;
GRANT ALL ON public.plan_usage TO service_role;
ALTER TABLE public.plan_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own usage" ON public.plan_usage FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_control(auth.uid()));

-- Only admins change a role.
CREATE OR REPLACE FUNCTION public.tg_guard_account_role() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.account_role IS DISTINCT FROM OLD.account_role AND auth.uid() IS NOT NULL AND NOT public.is_control(auth.uid()) THEN
    NEW.account_role := OLD.account_role;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_account_role BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.tg_guard_account_role();

INSERT INTO public.plans (role,key,name,sort,price_type,price_thb,term_months,completion_fee_pct,value_cap_thb_m,requests_mode,requests_n,has_data_room,has_manager,has_valuation_video,has_site_visit,verification_mode,verification_price_thb,badge_style) VALUES
('seller','entry','Entry',1,'free',NULL,6,3.0,50,'none',NULL,false,false,false,false,'paid',3000,'entry'),
('seller','promo_pro','Promo Professional',2,'paid',9900,3,1.25,200,'number',5,true,false,false,false,'included',NULL,'blue'),
('seller','pro','Professional',3,'paid',39000,12,1.25,200,'number',20,true,false,false,false,'included',NULL,'blue'),
('seller','executive','Executive',4,'on_request',NULL,12,1.25,NULL,'unlimited',NULL,true,true,true,true,'included',NULL,'navy_gold');
INSERT INTO public.plans (role,key,name,sort,price_type,price_thb,term_months,value_cap_thb_m,requests_mode,requests_n,has_shortlists,has_screening,mandates_mode,mandates_n,users_mode,users_n,badge_style) VALUES
('buyer','basic','Basic',1,'paid',19000,6,50,'bundles',NULL,false,false,'number',1,'number',1,'sky'),
('buyer','investor','Investor',2,'paid',45000,12,200,'number',30,true,true,'number',1,'number',1,'royal'),
('buyer','institutional','Institutional',3,'on_request',NULL,12,NULL,'unlimited',NULL,true,true,'contract',NULL,'contract',NULL,'deepnavy_gold');
INSERT INTO public.plans (role,key,name,sort,price_type,price_thb,term_months,value_cap_thb_m,requests_mode,requests_n,clients_mode,clients_n,users_mode,users_n,badge_style) VALUES
('advisor','basic','Basic',1,'paid',45000,3,50,'number',10,'number',1,'number',1,'lightteal'),
('advisor','pro','Pro',2,'on_request',NULL,12,NULL,'number',40,'number',10,'number',3,'teal_gold');

INSERT INTO public.plan_reports (plan_id, report_key, mode, per_term)
SELECT p.id, r.k, CASE WHEN p.key='basic' THEN 'none' WHEN p.key='institutional' THEN 'contract' ELSE 'number' END,
  CASE WHEN p.key='investor' THEN r.n END
FROM public.plans p CROSS JOIN (VALUES ('fs5',2),('fs3',3),('fs1',5),('verification',10),('pnl',2),('risk',2),('credit',2)) r(k,n)
WHERE p.role='buyer';

-- Existing users, once.
UPDATE public.users u SET account_role = CASE
  WHEN EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.role_code IN ('TENANT_ADMIN','CONTROL')) THEN 'admin'
  WHEN u.advisor_view THEN 'advisor'
  WHEN EXISTS (SELECT 1 FROM public.startup_users s WHERE s.user_id=u.id) AND NOT EXISTS (SELECT 1 FROM public.buyer_profiles b WHERE b.user_id=u.id) THEN 'seller'
  WHEN EXISTS (SELECT 1 FROM public.buyer_profiles b WHERE b.user_id=u.id) AND NOT EXISTS (SELECT 1 FROM public.startup_users s WHERE s.user_id=u.id) THEN 'buyer'
  ELSE NULL END
WHERE u.account_role IS NULL;
INSERT INTO public.subscriptions (user_id, plan_id, term_start, term_end)
SELECT u.id, p.id, now(), now() + interval '6 months' FROM public.users u JOIN public.plans p ON p.role='seller' AND p.key='entry'
WHERE u.account_role='seller';