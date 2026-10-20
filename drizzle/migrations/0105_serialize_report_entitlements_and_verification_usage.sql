CREATE OR REPLACE FUNCTION public.reports_open_plan(_buyer uuid,_pipeline uuid,_report text,_plan_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.deal_pipelines; s public.subscriptions; r public.plan_reports; used integer; a public.buyer_report_access; BEGIN
IF NOT public.reports_pipeline_nda(_pipeline,_buyer) THEN RAISE EXCEPTION 'An approved active NDA is required'; END IF;
SELECT * INTO d FROM public.deal_pipelines WHERE id=_pipeline;
PERFORM pg_advisory_xact_lock(hashtextextended(_buyer::text||':'||d.startup_id::text,0));
IF _report NOT IN ('verification','shareholders','statements','pnl','risk','credit') OR (_report='statements' AND _plan_key NOT IN ('fs5','fs3','fs1')) OR (_report<>'statements' AND _plan_key<>_report) THEN RAISE EXCEPTION 'Invalid report'; END IF;
SELECT * INTO a FROM public.buyer_report_access WHERE company_id=d.startup_id AND buyer_id=_buyer AND report_key=_report;
IF FOUND THEN RETURN jsonb_build_object('reopened',true); END IF;
SELECT * INTO s FROM public.subscriptions WHERE user_id=_buyer FOR UPDATE;
IF NOT FOUND OR s.status='ended' OR (s.term_end IS NOT NULL AND s.term_end<=now()) THEN RAISE EXCEPTION 'Choose an active plan'; END IF;
SELECT pr.* INTO r FROM public.plan_reports pr JOIN public.plans p ON p.id=pr.plan_id WHERE pr.plan_id=s.plan_id AND p.role='buyer' AND p.status='live' AND pr.report_key=_plan_key;
IF NOT FOUND OR r.mode='none' THEN RAISE EXCEPTION 'This report is not included in your plan'; END IF;
IF _report='verification' AND EXISTS(SELECT 1 FROM public.verification_access WHERE buyer_account_id=_buyer AND company_id=d.startup_id AND (via IN ('paid','contract') OR open_until>now())) THEN
INSERT INTO public.buyer_report_access(company_id,buyer_id,pipeline_id,report_key,via) VALUES(d.startup_id,_buyer,_pipeline,_report,'plan'); RETURN jsonb_build_object('reopened',true); END IF;
IF r.mode='number' THEN
IF _report='verification' THEN SELECT count(*) INTO used FROM public.verification_usage WHERE buyer_account_id=_buyer AND term_start=s.term_start AND returned_at IS NULL;
ELSE SELECT count(*) INTO used FROM public.plan_usage WHERE user_id=_buyer AND kind='report:'||_plan_key AND term_start=s.term_start; END IF;
IF used>=coalesce(r.per_term,0) THEN RAISE EXCEPTION 'No reports left in your plan'; END IF; END IF;
IF _report='verification' THEN
IF r.mode='number' THEN INSERT INTO public.verification_usage(buyer_account_id,company_id,term_start) VALUES(_buyer,d.startup_id,s.term_start) ON CONFLICT(buyer_account_id,company_id,term_start) DO UPDATE SET returned_at=NULL,consumed_at=now(); END IF;
INSERT INTO public.verification_access(company_id,buyer_account_id,via,opened_at,requested_at,open_until) VALUES(d.startup_id,_buyer,CASE WHEN r.mode='contract' THEN 'contract' ELSE 'plan' END,now(),now(),CASE WHEN r.mode='contract' THEN NULL ELSE s.term_end END) ON CONFLICT(company_id,buyer_account_id) DO UPDATE SET via=excluded.via,opened_at=excluded.opened_at,requested_at=excluded.requested_at,open_until=excluded.open_until;
INSERT INTO public.company_verifications(company_id,status,requested_by,started_at,ready_by) VALUES(d.startup_id,'checking',_buyer,now(),public.verification_business_due(now(),1)) ON CONFLICT(company_id) DO UPDATE SET status=CASE WHEN company_verifications.status IN ('not_ordered','waiting_payment') THEN 'checking' ELSE company_verifications.status END,started_at=coalesce(company_verifications.started_at,now()),ready_by=coalesce(company_verifications.ready_by,public.verification_business_due(now(),1));
ELSE
INSERT INTO public.plan_usage(user_id,kind,ref,term_start) SELECT _buyer,'report:'||_plan_key,d.startup_id::text,s.term_start WHERE NOT EXISTS(SELECT 1 FROM public.plan_usage WHERE user_id=_buyer AND kind='report:'||_plan_key AND ref=d.startup_id::text AND term_start=s.term_start);
INSERT INTO public.company_report_records(company_id,report_key,status,ready_by) VALUES(d.startup_id,_report,'in_progress',public.verification_business_due(now(),1)) ON CONFLICT(company_id,report_key) DO NOTHING;
END IF;
INSERT INTO public.buyer_report_access(company_id,buyer_id,pipeline_id,report_key,via) VALUES(d.startup_id,_buyer,_pipeline,_report,CASE WHEN r.mode='contract' THEN 'contract' ELSE 'plan' END);
RETURN jsonb_build_object('reopened',false); END; $$;
REVOKE ALL ON FUNCTION public.reports_open_plan(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.reports_open_plan(uuid,uuid,text,text) TO service_role;
COMMENT ON FUNCTION public.reports_open_plan(uuid,uuid,text,text) IS 'Atomic plan order/access. Serializes buyer+company, shares canonical verification accounting, and never fabricates report content.';