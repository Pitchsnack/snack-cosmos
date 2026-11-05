ALTER TABLE public.deal_pipelines ADD COLUMN loi_from text NOT NULL DEFAULT 'buyer', ADD COLUMN loi_revision integer NOT NULL DEFAULT 0, ADD COLUMN loi_changes jsonb, ADD COLUMN loi_send_consent jsonb, ADD COLUMN loi_accept_consent jsonb, ADD COLUMN workflow jsonb NOT NULL DEFAULT '{}';
ALTER TABLE public.deal_pipeline_events ADD COLUMN payload jsonb;
CREATE TABLE public.loi_decline_receipts (event_id uuid NOT NULL REFERENCES public.deal_pipeline_events(id), user_id uuid NOT NULL, seen_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(event_id,user_id));
GRANT SELECT, INSERT ON public.loi_decline_receipts TO authenticated;
GRANT ALL ON public.loi_decline_receipts TO service_role;
ALTER TABLE public.loi_decline_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_decline_receipts_read ON public.loi_decline_receipts FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY own_decline_receipts_insert ON public.loi_decline_receipts FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid() AND EXISTS(SELECT 1 FROM public.deal_pipeline_events e JOIN public.deal_pipelines p ON p.id=e.pipeline_id WHERE e.id=event_id AND e.event='loi_declined' AND ((e.payload->>'from'='buyer' AND p.buyer_user_id=auth.uid()) OR (e.payload->>'from'='seller' AND public.can_access_startup(auth.uid(),p.startup_id)))));
CREATE OR REPLACE FUNCTION public.pipeline_transition(_id uuid,_action text,_side text,_version integer,_terms jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.deal_pipelines; uid uuid:=auth.uid(); ts timestamptz:=now(); ev text; snap jsonb; ch jsonb; w jsonb; k text; c jsonb; event_id uuid; amt numeric; days integer;
BEGIN
 IF uid IS NULL OR _side NOT IN ('buyer','seller') THEN RAISE EXCEPTION 'Not authorised'; END IF;
 SELECT * INTO p FROM public.deal_pipelines WHERE id=_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Deal not found'; END IF;
 IF (_side='buyer' AND p.buyer_user_id<>uid) OR (_side='seller' AND NOT public.can_access_startup(uid,p.startup_id)) THEN RAISE EXCEPTION 'Not your side of this deal'; END IF;
 IF p.status IN ('ended','withdrawn','declined') THEN RAISE EXCEPTION 'This deal is closed'; END IF;
 IF p.nda_approved_at IS NULL OR (p.nda_expires_at IS NOT NULL AND p.nda_expires_at<=ts) THEN RAISE EXCEPTION 'An active approved NDA is required'; END IF;
 IF p.loi_revision<>_version THEN RAISE EXCEPTION 'This letter changed. Reopen it before acting'; END IF;
 snap:=jsonb_build_object('from',p.loi_from,'amount',p.loi_amount,'days',p.loi_exclusivity_days,'conditions',p.loi_conditions,'sentAt',p.loi_sent_at,'revision',p.loi_revision,'changes',p.loi_changes,'side',_side);
 w:=p.workflow;
 IF _action IN ('send','resend','changes') THEN
  amt:=(_terms->>'amount')::numeric; days:=(_terms->>'days')::integer;
  IF amt IS NULL OR amt<=0 OR amt>1000000000000000 OR days IS NULL OR days NOT BETWEEN 0 AND 365 OR length(coalesce(_terms->>'conditions',''))>2000 OR length(coalesce(_terms->>'note',''))>2000 THEN RAISE EXCEPTION 'Check the price, days and conditions'; END IF;
 END IF;
 IF _action IN ('send','resend') THEN
  IF p.loi_accepted_at IS NOT NULL OR (_action='send' AND (p.loi_sent_at IS NOT NULL OR (_side='seller' AND p.loi_requested_at IS NOT NULL))) OR (_action='resend' AND (p.loi_sent_at IS NULL OR p.loi_from<>_side OR p.loi_changes_requested_at IS NULL)) THEN RAISE EXCEPTION 'Only one letter can be open at a time'; END IF;
  IF length(coalesce(_terms->>'consent',''))<10 OR NOT coalesce((_terms->>'read')::boolean,false) THEN RAISE EXCEPTION 'Read the letter and tick to send'; END IF;
  UPDATE public.deal_pipelines SET loi_from=_side,loi_revision=loi_revision+1,loi_amount=amt,loi_exclusivity_days=days,loi_conditions=_terms->>'conditions',loi_sent_at=ts,loi_accepted_at=NULL,loi_accepted_by=NULL,loi_accept_consent=NULL,loi_changes=NULL,loi_changes_requested_at=NULL,loi_requested_at=NULL,loi_requested_by=NULL,loi_send_consent=jsonb_build_object('by',uid,'side',_side,'at',ts,'text',_terms->>'consent','read',true,'revision',p.loi_revision+1),updated_at=ts WHERE id=_id;
  ev:=CASE WHEN _action='resend' THEN 'loi_revised_sent' ELSE 'loi_sent' END;
  snap:=snap||jsonb_build_object('from',_side,'amount',amt,'days',days,'conditions',_terms->>'conditions','sentAt',ts,'revision',p.loi_revision+1,'previous',snap);
 ELSIF _action IN ('accept','decline','changes','accept_revised') THEN
  IF p.loi_sent_at IS NULL OR p.loi_accepted_at IS NOT NULL THEN RAISE EXCEPTION 'No letter to decide'; END IF;
  IF (_action='accept_revised' AND (p.loi_from<>_side OR p.loi_changes_requested_at IS NULL)) OR (_action<>'accept_revised' AND (p.loi_from=_side OR p.loi_changes_requested_at IS NOT NULL)) THEN RAISE EXCEPTION 'Not your turn to decide'; END IF;
  IF _action='changes' THEN
   IF amt=p.loi_amount AND days=p.loi_exclusivity_days AND coalesce(_terms->>'conditions','')=coalesce(p.loi_conditions,'') AND length(trim(coalesce(_terms->>'note','')))=0 THEN RAISE EXCEPTION 'Change a term or write a note'; END IF;
   ch:=jsonb_build_object('amount',amt,'days',days,'conditions',_terms->>'conditions','note',_terms->>'note','side',_side,'at',ts);
   UPDATE public.deal_pipelines SET loi_changes=ch,loi_changes_requested_at=ts,loi_revision=loi_revision+1,updated_at=ts WHERE id=_id;
   ev:='loi_changes_requested';snap:=snap||jsonb_build_object('changes',ch,'previous',snap);
  ELSIF _action='decline' THEN
   UPDATE public.deal_pipelines SET loi_sent_at=NULL,loi_amount=NULL,loi_conditions=NULL,loi_exclusivity_days=NULL,loi_changes=NULL,loi_changes_requested_at=NULL,loi_send_consent=NULL,loi_accept_consent=NULL,loi_accepted_by=NULL,loi_revision=loi_revision+1,updated_at=ts WHERE id=_id;
   ev:='loi_declined';
  ELSE
   IF length(coalesce(_terms->>'consent',''))<10 OR NOT coalesce((_terms->>'read')::boolean,false) THEN RAISE EXCEPTION 'Read the letter and tick to accept'; END IF;
   amt:=p.loi_amount;days:=p.loi_exclusivity_days;
   IF _action='accept_revised' THEN amt:=coalesce((p.loi_changes->>'amount')::numeric,amt);days:=coalesce((p.loi_changes->>'days')::integer,days);END IF;
   w:=w||jsonb_build_object('supportName',coalesce(_terms->>'supportName','Admin'),'supportAt',ts);
   UPDATE public.deal_pipelines SET loi_amount=amt,loi_exclusivity_days=days,loi_conditions=CASE WHEN _action='accept_revised' THEN coalesce(p.loi_changes->>'conditions',p.loi_conditions) ELSE p.loi_conditions END,loi_accepted_at=ts,loi_accepted_by=uid,loi_consent_text=_terms->>'consent',loi_accept_consent=jsonb_build_object('by',uid,'side',_side,'at',ts,'text',_terms->>'consent','read',true,'revised',_action='accept_revised'),exclusivity_until=ts+make_interval(days=>coalesce(days,0)),workflow=w,loi_revision=loi_revision+1,updated_at=ts WHERE id=_id;
   ev:=CASE WHEN _action='accept_revised' THEN 'loi_revised_accepted' ELSE 'loi_accepted' END;snap:=snap||jsonb_build_object('amount',amt,'days',days,'acceptedAt',ts);
   INSERT INTO public.deal_pipeline_events(pipeline_id,event,actor_id,payload) VALUES(_id,'deal_support_assigned',uid,jsonb_build_object('name',w->>'supportName','at',ts));
  END IF;
 ELSIF _action IN ('choice','unlock','receipt','payment') THEN
  IF p.loi_accepted_at IS NULL OR p.payment_at IS NOT NULL THEN RAISE EXCEPTION 'Accept the letter first'; END IF;
  IF _action IN ('choice','unlock') THEN
   k:=_terms->>'stage';IF k NOT IN ('valuation','legal') THEN RAISE EXCEPTION 'Invalid stage';END IF;
   c:=coalesce(w#>ARRAY['choices',_side,k],'{}');
   IF _action='choice' AND coalesce((c->>'locked')::boolean,false) AND _terms->>'choice' IS NOT NULL THEN RAISE EXCEPTION 'Unlock your choice first';END IF;
   IF _action='unlock' THEN c:=c||jsonb_build_object('locked',false);ELSE
    IF _terms->>'choice' IS NOT NULL AND _terms->>'choice' NOT IN ('pitchsnack','own','none') THEN RAISE EXCEPTION 'Invalid choice';END IF;
    c:=jsonb_build_object('value',_terms->>'choice','at',CASE WHEN _terms->>'choice' IS NULL THEN NULL ELSE ts END,'locked',_terms->>'choice' IS NOT NULL);
    IF k='valuation' THEN w:=w||jsonb_build_object('receipts',coalesce(w->'receipts','{}')-_side);END IF;
   END IF;
   w:=w||jsonb_build_object('choices',coalesce(w->'choices','{}')||jsonb_build_object(_side,coalesce(w#>ARRAY['choices',_side],'{}')||jsonb_build_object(k,c)));
   ev:=k||CASE WHEN _action='unlock' THEN '_choice_unlocked' ELSE '_choice' END;
  ELSIF _action='receipt' THEN
   IF w#>>ARRAY['choices',_side,'valuation','value'] IS DISTINCT FROM 'own' THEN RAISE EXCEPTION 'Choose your own valuer first';END IF;
   w:=w||jsonb_build_object('receipts',coalesce(w->'receipts','{}')||jsonb_build_object(_side,jsonb_build_object('at',ts,'fileName',_terms->>'fileName','filePath',_terms->>'filePath')));ev:='valuation_report_received';
  ELSE
   IF w#>>ARRAY['payment',_side] IS NOT NULL THEN RETURN jsonb_build_object('ok',true);END IF;
   w:=w||jsonb_build_object('payment',coalesce(w->'payment','{}')||jsonb_build_object(_side,ts));ev:='payment_confirmed';
  END IF;
  UPDATE public.deal_pipelines SET workflow=w,loi_revision=loi_revision+1,updated_at=ts WHERE id=_id;snap:=snap||_terms;
 ELSE RAISE EXCEPTION 'Unknown deal action'; END IF;
 INSERT INTO public.deal_pipeline_events(pipeline_id,event,actor_id,note,payload) VALUES(_id,ev,uid,_terms->>'consent',snap) RETURNING id INTO event_id;
 RETURN jsonb_build_object('ok',true,'event',ev,'eventId',event_id,'from',p.loi_from);
END $$;
REVOKE ALL ON FUNCTION public.pipeline_transition(uuid,text,text,integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pipeline_transition(uuid,text,text,integer,jsonb) TO authenticated;
COMMENT ON COLUMN public.deal_pipelines.contact_at IS 'Legacy Contact M&A milestone; new support assignment is workflow.supportAt.';
COMMENT ON COLUMN public.deal_pipelines.legal_at IS 'Legacy legal-folder milestone; not reinterpreted as an SPA drafted date.';
COMMENT ON COLUMN public.deal_pipelines.spa_at IS 'Legacy SPA draft milestone; not reinterpreted as a signed SPA date.';
COMMENT ON COLUMN public.deal_pipelines.payment_at IS 'Existing payment completion; new readiness is workflow.payment, not payment completion.';