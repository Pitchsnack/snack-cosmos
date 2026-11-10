CREATE OR REPLACE FUNCTION public.nda_save_transition_history() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  INSERT INTO public.deal_pipeline_events(pipeline_id,event,actor_id) VALUES(NEW.id,'nda_requested',NEW.buyer_user_id);
 ELSIF NEW.status='active' AND OLD.status IN ('withdrawn','declined') THEN
  INSERT INTO public.deal_pipeline_events(pipeline_id,event,actor_id) VALUES(NEW.id,'nda_requested',NEW.buyer_user_id);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER nda_request_history AFTER INSERT OR UPDATE ON public.deal_pipelines FOR EACH ROW EXECUTE FUNCTION public.nda_save_transition_history();
CREATE OR REPLACE FUNCTION public.nda_decision_commit(_id uuid,_actor uuid,_approve boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.deal_pipelines;
BEGIN
 SELECT * INTO p FROM public.deal_pipelines WHERE id=_id FOR UPDATE;
 IF NOT FOUND OR NOT public.can_access_startup(_actor,p.startup_id) THEN RAISE EXCEPTION 'Only the seller can do this'; END IF;
 IF p.status<>'active' OR p.nda_approved_at IS NOT NULL THEN RAISE EXCEPTION 'This NDA has changed. The list is up to date.'; END IF;
 IF _approve THEN UPDATE public.deal_pipelines SET nda_approved_at=now(),nda_expires_at=now()+interval '730 days' WHERE id=_id;
 ELSE UPDATE public.deal_pipelines SET status='declined' WHERE id=_id; END IF;
 INSERT INTO public.deal_pipeline_events(pipeline_id,event,actor_id) VALUES(_id,CASE WHEN _approve THEN 'nda_approved' ELSE 'nda_declined' END,_actor);
END $$;
REVOKE ALL ON FUNCTION public.nda_save_transition_history() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.nda_decision_commit(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nda_decision_commit(uuid,uuid,boolean) TO service_role;