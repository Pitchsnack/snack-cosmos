ALTER TABLE public.listing_invitations ADD COLUMN IF NOT EXISTS withdrawn_at timestamptz, ADD COLUMN IF NOT EXISTS withdrawn_by uuid;
COMMENT ON COLUMN public.listing_invitations.withdrawn_at IS 'Seller invitation withdrawn; retained with actor and date for NDA history.';
CREATE OR REPLACE FUNCTION public.nda_request_commit(_listing uuid, _startup uuid, _actor uuid, _invitation uuid, _message text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i public.listing_invitations; p public.deal_pipelines; ts timestamptz := now(); changed boolean := false;
BEGIN
 IF _invitation IS NOT NULL THEN
  SELECT * INTO i FROM public.listing_invitations WHERE id=_invitation FOR UPDATE;
  IF NOT FOUND OR i.hidden_profile_id<>_listing OR i.withdrawn_at IS NOT NULL OR i.closed_at IS NOT NULL THEN RAISE EXCEPTION 'This NDA has changed. The list is up to date.'; END IF;
 END IF;
 INSERT INTO public.deal_pipelines(hidden_profile_id,startup_id,buyer_user_id,buyer_message,status) VALUES(_listing,_startup,_actor,_message,'active') ON CONFLICT(hidden_profile_id,buyer_user_id) DO NOTHING RETURNING * INTO p;
 IF FOUND THEN changed:=true;
 ELSE
  SELECT * INTO p FROM public.deal_pipelines WHERE hidden_profile_id=_listing AND buyer_user_id=_actor FOR UPDATE;
  IF p.status IN ('withdrawn','declined') THEN UPDATE public.deal_pipelines SET status='active',nda_requested_at=ts,nda_approved_at=NULL,buyer_message=_message WHERE id=p.id; changed:=true; END IF;
 END IF;
 IF _invitation IS NOT NULL AND p.nda_approved_at IS NULL AND p.status NOT IN ('ended','revoked') THEN UPDATE public.listing_invitations SET pipeline_id=p.id,buyer_choice='open',viewed_at=coalesce(viewed_at,ts) WHERE id=_invitation; END IF;
 RETURN jsonb_build_object('id',p.id,'changed',changed);
END $$;
REVOKE ALL ON FUNCTION public.nda_request_commit(uuid,uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nda_request_commit(uuid,uuid,uuid,uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.nda_decision_commit(_id uuid,_actor uuid,_approve boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.deal_pipelines;
BEGIN
 SELECT * INTO p FROM public.deal_pipelines WHERE id=_id FOR UPDATE;
 IF NOT FOUND OR NOT public.can_access_startup(_actor,p.startup_id) THEN RAISE EXCEPTION 'Only the seller can do this'; END IF;
 IF p.status<>'active' OR p.nda_approved_at IS NOT NULL THEN RAISE EXCEPTION 'This NDA has changed. The list is up to date.'; END IF;
 IF _approve THEN UPDATE public.deal_pipelines SET nda_approved_at=now(),nda_expires_at=now()+interval '730 days' WHERE id=_id;
 ELSE UPDATE public.deal_pipelines SET status='declined' WHERE id=_id; END IF;
END $$;
REVOKE ALL ON FUNCTION public.nda_decision_commit(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nda_decision_commit(uuid,uuid,boolean) TO service_role;
CREATE OR REPLACE FUNCTION public.nda_withdraw_commit(_id uuid,_actor uuid,_side text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE i public.listing_invitations; p public.deal_pipelines; hp public.hidden_profiles; ts timestamptz:=now(); buyers uuid[]; buyer_code text; listing_code text; dest text;
BEGIN
 IF _side='seller' THEN
  SELECT * INTO i FROM public.listing_invitations WHERE id=_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_access_startup(_actor,i.startup_id) THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF i.closed_at IS NOT NULL OR i.withdrawn_at IS NOT NULL OR i.buyer_choice='not_interested' OR i.pipeline_id IS NOT NULL OR EXISTS(SELECT 1 FROM public.deal_pipelines p JOIN public.buyer_profiles b ON b.user_id=p.buyer_user_id WHERE p.hidden_profile_id=i.hidden_profile_id AND b.investor_id=i.investor_id AND p.status='active') THEN RAISE EXCEPTION 'This NDA has changed. The list is up to date.'; END IF;
  UPDATE public.listing_invitations SET withdrawn_at=ts,withdrawn_by=_actor WHERE id=i.id;
  SELECT * INTO hp FROM public.hidden_profiles WHERE id=i.hidden_profile_id;
  listing_code:=coalesce(hp.code_name,hp.ref_no,'Listing'); dest:='/marketplace/pipeline/invitations?open='||i.id;
  SELECT array_agg(DISTINCT user_id) INTO buyers FROM public.buyer_profiles WHERE investor_id=i.investor_id;
  INSERT INTO public.notifications(user_id,notification_type,title,message,link_url) SELECT u,'deal','NDA invitation withdrawn',listing_code||' withdrew the NDA invitation it sent you on '||to_char(i.sent_at AT TIME ZONE 'Asia/Bangkok','DD Mon YYYY')||'.',dest FROM unnest(coalesce(buyers,ARRAY[i.buyer_user_id])) u WHERE u IS NOT NULL AND u<>_actor;
  RETURN jsonb_build_object('id',i.id,'listing',listing_code,'date',i.sent_at,'users',coalesce(buyers,ARRAY[i.buyer_user_id]));
 ELSIF _side='buyer' THEN
  SELECT * INTO p FROM public.deal_pipelines WHERE id=_id FOR UPDATE;
  IF NOT FOUND OR p.buyer_user_id<>_actor THEN RAISE EXCEPTION 'No NDA request for this listing'; END IF;
  IF p.status<>'active' OR p.nda_approved_at IS NOT NULL THEN RAISE EXCEPTION 'This NDA has changed. The list is up to date.'; END IF;
  UPDATE public.deal_pipelines SET status='withdrawn' WHERE id=p.id;
  INSERT INTO public.deal_pipeline_events(pipeline_id,event,actor_id) VALUES(p.id,'nda_withdrawn',_actor);
  SELECT * INTO hp FROM public.hidden_profiles WHERE id=p.hidden_profile_id;
  SELECT coalesce(v.investor_type,'Investor') INTO buyer_code FROM public.buyer_profiles b JOIN public.investors v ON v.id=b.investor_id WHERE b.user_id=p.buyer_user_id LIMIT 1;
  listing_code:=coalesce(hp.code_name,hp.ref_no,'Listing');
  SELECT id INTO dest FROM public.listing_invitations WHERE pipeline_id=p.id ORDER BY sent_at DESC LIMIT 1;
  dest:='/marketplace/pipeline/invitations?open='||coalesce(dest,p.id::text);
  INSERT INTO public.notifications(user_id,notification_type,title,message,link_url) SELECT u,'deal','NDA request withdrawn',coalesce(buyer_code,'Investor')||' withdrew their NDA request for '||listing_code||'.',dest FROM (SELECT user_id u FROM public.startup_users WHERE startup_id=p.startup_id UNION SELECT owning_agent_user_id FROM public.startup_ownership WHERE startup_id=p.startup_id) team WHERE u IS NOT NULL AND u<>_actor;
  RETURN jsonb_build_object('id',p.id,'startup',p.startup_id,'listing',listing_code,'buyer',coalesce(buyer_code,'Investor'),'date',p.nda_requested_at);
 ELSE RAISE EXCEPTION 'Invalid side'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.nda_withdraw_commit(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nda_withdraw_commit(uuid,uuid,text) TO service_role;