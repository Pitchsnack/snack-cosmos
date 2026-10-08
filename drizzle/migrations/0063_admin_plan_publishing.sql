ALTER TABLE public.plans ADD COLUMN card_style text NOT NULL DEFAULT 'sage';
ALTER TABLE public.plans ADD COLUMN card_text jsonb NOT NULL DEFAULT '{"en":{"badge":"","intent":"","points":[]},"th":{"badge":"","intent":"","points":[]}}';
ALTER TABLE public.subscriptions ADD COLUMN price_locked_thb integer;
CREATE TABLE public.plan_history (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plan_id uuid NOT NULL REFERENCES public.plans(id), at timestamptz NOT NULL DEFAULT now(), by_user uuid, summary text NOT NULL, changes jsonb NOT NULL DEFAULT '{}');
GRANT SELECT ON public.plan_history TO authenticated;
GRANT ALL ON public.plan_history TO service_role;
ALTER TABLE public.plan_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan history admins" ON public.plan_history FOR SELECT TO authenticated USING (public.is_account_admin(auth.uid()) AND public.is_control(auth.uid()));
CREATE TABLE public.plan_changes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plan_id uuid NOT NULL REFERENCES public.plans(id), new_values jsonb NOT NULL, effective_at timestamptz NOT NULL, keep_price text NOT NULL DEFAULT 'renewal' CHECK(keep_price IN ('renewal','stay')), created_by uuid NOT NULL, status text NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','applied','cancelled')), created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.plan_changes TO authenticated;
GRANT ALL ON public.plan_changes TO service_role;
ALTER TABLE public.plan_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan changes admins" ON public.plan_changes FOR SELECT TO authenticated USING (public.is_account_admin(auth.uid()) AND public.is_control(auth.uid()));
CREATE UNIQUE INDEX one_scheduled_change_per_plan ON public.plan_changes(plan_id) WHERE status='scheduled';
UPDATE public.plans SET card_style=CASE WHEN role='seller' THEN CASE key WHEN 'entry' THEN 'sage' WHEN 'promo_pro' THEN 'amber_promo' WHEN 'pro' THEN 'blue' ELSE 'navy' END WHEN role='buyer' THEN CASE key WHEN 'basic' THEN 'sky' WHEN 'investor' THEN 'royal' ELSE 'deepnavy' END ELSE CASE key WHEN 'basic' THEN 'lightteal' ELSE 'deepteal' END END;
INSERT INTO public.plan_history(plan_id,summary) SELECT id,'Plan created' FROM public.plans;
CREATE OR REPLACE FUNCTION public.apply_plan_edit(_plan uuid,_values jsonb,_by uuid,_keep text DEFAULT 'renewal') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE oldrow public.plans%ROWTYPE; newrow public.plans%ROWTYPE; r jsonb; delta jsonb; summary_text text;
BEGIN
 SELECT * INTO oldrow FROM public.plans WHERE id=_plan FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found'; END IF;
 SELECT * INTO newrow FROM jsonb_populate_record(oldrow,_values-'reports'-'id'-'role'-'key'-'sort'-'updated_at');
 IF newrow.name IS NULL OR length(trim(newrow.name))=0 THEN RAISE EXCEPTION 'Give the plan a name.'; END IF;
 IF newrow.price_type='paid' AND coalesce(newrow.price_thb,0)<1 THEN RAISE EXCEPTION 'Enter a price above 0, or choose Free or On request.'; END IF;
 IF newrow.role='seller' AND newrow.completion_fee_pct IS NULL THEN RAISE EXCEPTION 'Enter the completion fee, for example 1.25.'; END IF;
 IF newrow.requests_mode='number' AND coalesce(newrow.requests_n,0)<1 THEN RAISE EXCEPTION 'Enter at least 1, or choose another option.'; END IF;
 IF newrow.verification_mode='paid' AND coalesce(newrow.verification_price_thb,0)<1 THEN RAISE EXCEPTION 'Enter the report price, or choose another option.'; END IF;
 IF newrow.price_thb IS DISTINCT FROM oldrow.price_thb OR newrow.price_type IS DISTINCT FROM oldrow.price_type OR newrow.completion_fee_pct IS DISTINCT FROM oldrow.completion_fee_pct THEN
 UPDATE public.subscriptions SET price_paid_thb=coalesce(price_paid_thb,oldrow.price_thb),price_locked_thb=CASE WHEN _keep='stay' THEN coalesce(price_locked_thb,price_paid_thb,oldrow.price_thb) ELSE price_locked_thb END WHERE plan_id=_plan;
 END IF;
 SELECT coalesce(jsonb_object_agg(e.key,jsonb_build_object('old',to_jsonb(oldrow)->e.key,'new',e.value)),'{}') INTO delta FROM jsonb_each(to_jsonb(newrow)) e WHERE e.value IS DISTINCT FROM to_jsonb(oldrow)->e.key;
 UPDATE public.plans SET name=newrow.name,status=newrow.status,price_type=newrow.price_type,price_thb=newrow.price_thb,term_months=newrow.term_months,completion_fee_pct=newrow.completion_fee_pct,value_cap_thb_m=newrow.value_cap_thb_m,requests_mode=newrow.requests_mode,requests_n=newrow.requests_n,clients_mode=newrow.clients_mode,clients_n=newrow.clients_n,users_mode=newrow.users_mode,users_n=newrow.users_n,mandates_mode=newrow.mandates_mode,mandates_n=newrow.mandates_n,has_data_room=newrow.has_data_room,has_manager=newrow.has_manager,has_valuation_video=newrow.has_valuation_video,has_site_visit=newrow.has_site_visit,has_shortlists=newrow.has_shortlists,has_screening=newrow.has_screening,verification_mode=newrow.verification_mode,verification_price_thb=newrow.verification_price_thb,badge_style=newrow.badge_style,card_style=newrow.card_style,card_text=newrow.card_text,updated_at=now() WHERE id=_plan;
 IF _values ? 'reports' THEN
 FOR r IN SELECT value FROM jsonb_array_elements(_values->'reports') LOOP
 IF r->>'mode'='number' AND coalesce((r->>'per_term')::integer,0)<1 THEN RAISE EXCEPTION 'Enter at least 1, or choose another option.'; END IF;
 SELECT delta || jsonb_build_object(r->>'report_key',jsonb_build_object('old',to_jsonb(pr),'new',r)) INTO delta FROM (SELECT 1) dummy LEFT JOIN public.plan_reports pr ON pr.plan_id=_plan AND pr.report_key=r->>'report_key';
 INSERT INTO public.plan_reports(plan_id,report_key,mode,per_term) VALUES(_plan,r->>'report_key',r->>'mode',(r->>'per_term')::integer) ON CONFLICT(plan_id,report_key) DO UPDATE SET mode=excluded.mode,per_term=excluded.per_term;
 END LOOP;
 END IF;
 summary_text:=coalesce(_values->>'_summary','Plan updated');
 INSERT INTO public.plan_history(plan_id,by_user,summary,changes) VALUES(_plan,_by,summary_text || CASE WHEN _keep='stay' THEN ' (current subscribers keep their price)' ELSE '' END,delta);
END $$;
REVOKE ALL ON FUNCTION public.apply_plan_edit(uuid,jsonb,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_plan_edit(uuid,jsonb,uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.apply_scheduled_plan_changes() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.plan_changes%ROWTYPE; n integer:=0;
BEGIN
 FOR c IN SELECT * FROM public.plan_changes WHERE status='scheduled' AND effective_at<=now() ORDER BY effective_at FOR UPDATE SKIP LOCKED LOOP
 PERFORM public.apply_plan_edit(c.plan_id,c.new_values,c.created_by,c.keep_price);
 UPDATE public.plan_changes SET status='applied' WHERE id=c.id; n:=n+1;
 END LOOP;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.apply_scheduled_plan_changes() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_scheduled_plan_changes() TO service_role;
CREATE EXTENSION IF NOT EXISTS pg_cron;