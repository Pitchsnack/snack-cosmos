CREATE TABLE public.share_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sender_user_id uuid NOT NULL, email text NOT NULL,
 token text NOT NULL UNIQUE, sent_at timestamptz NOT NULL DEFAULT now(), joined_user_id uuid, joined_at timestamptz
);
GRANT ALL ON public.share_invitations TO service_role;
ALTER TABLE public.share_invitations ENABLE ROW LEVEL SECURITY;
CREATE INDEX share_invitations_open_email ON public.share_invitations (email) WHERE joined_at IS NULL;
CREATE INDEX share_invitations_sender_time ON public.share_invitations (sender_user_id, sent_at);
CREATE OR REPLACE FUNCTION public.claim_share_invitation(_uid uuid, _invitation_id uuid, _email text, _role text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv public.share_invitations%ROWTYPE;
BEGIN
 SELECT * INTO inv FROM public.share_invitations WHERE id=_invitation_id FOR UPDATE;
 IF NOT FOUND OR inv.joined_at IS NOT NULL OR inv.email <> lower(trim(_email)) OR _role NOT IN ('seller','buyer','advisor') THEN RETURN false; END IF;
 IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id=_uid AND lower(email)=inv.email AND email_confirmed_at IS NOT NULL) THEN RETURN false; END IF;
 UPDATE public.users SET account_role=_role WHERE id=_uid AND account_role IS NULL;
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE public.share_invitations SET joined_user_id=_uid, joined_at=now() WHERE email=inv.email AND joined_at IS NULL;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.claim_share_invitation(uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_share_invitation(uuid,uuid,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.mark_open_share_invitations() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT coalesce((SELECT gate_on FROM public.soft_launch_settings WHERE id=true),false) THEN
 UPDATE public.share_invitations SET joined_user_id=NEW.id,joined_at=now() WHERE email=lower(NEW.email) AND joined_at IS NULL;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.mark_open_share_invitations() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER mark_open_share_invitations AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.mark_open_share_invitations();