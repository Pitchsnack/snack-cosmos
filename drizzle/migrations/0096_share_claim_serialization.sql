REVOKE ALL ON TABLE public.share_invitations FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.claim_share_invitation(_uid uuid, _invitation_id uuid, _email text, _role text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE inv public.share_invitations%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(lower(trim(_email)),0));
 SELECT * INTO inv FROM public.share_invitations WHERE id=_invitation_id FOR UPDATE;
 IF NOT FOUND OR inv.joined_at IS NOT NULL OR inv.email<>lower(trim(_email)) OR _role NOT IN ('seller','buyer','advisor') THEN RETURN false; END IF;
 IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id=_uid AND lower(trim(email))=inv.email AND email_confirmed_at IS NOT NULL) THEN RETURN false; END IF;
 UPDATE public.users SET account_role=_role WHERE id=_uid AND account_role IS NULL;
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE public.share_invitations SET joined_user_id=_uid,joined_at=now() WHERE email=inv.email AND joined_at IS NULL;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.claim_share_invitation(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_share_invitation(uuid,uuid,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.mark_open_share_invitations() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT coalesce((SELECT gate_on FROM public.soft_launch_settings WHERE id=true),false) THEN
 UPDATE public.share_invitations SET joined_user_id=NEW.id,joined_at=now() WHERE email=lower(trim(NEW.email)) AND joined_at IS NULL;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.mark_open_share_invitations() FROM PUBLIC,anon,authenticated;