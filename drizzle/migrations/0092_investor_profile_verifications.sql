CREATE TABLE public.investor_profile_verifications (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id        uuid NOT NULL UNIQUE REFERENCES public.investors(id) ON DELETE CASCADE,
  user_id            uuid NOT NULL,
  company_name       text,
  buyer_type         text,
  registration_no    text,
  work_email         text,
  website            text,
  linkedin           text,
  documents          text[] NOT NULL DEFAULT '{}',
  status             text NOT NULL DEFAULT 'unverified'
                     CHECK (status IN ('unverified','pending','verified','more_info','declined')),
  email_domain_match boolean,
  decision_note      text,
  assignee_id        uuid,
  submitted_at       timestamptz,
  decided_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.investor_profile_verifications TO authenticated;
GRANT ALL ON public.investor_profile_verifications TO service_role;
ALTER TABLE public.investor_profile_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner or Control read" ON public.investor_profile_verifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_control(auth.uid()));

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.investor_profile_verifications
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.investor_profile_verifications
  (investor_id, user_id, company_name, buyer_type, registration_no, work_email, website,
   linkedin, documents, status, email_domain_match, decision_note, assignee_id,
   submitted_at, decided_at)
SELECT bp.investor_id, bp.user_id, bv.company_name, bv.buyer_type, bv.registration_no,
       bv.work_email, bv.website, bv.linkedin, COALESCE(bv.documents, '{}'),
       COALESCE(bv.status, 'unverified'), bv.email_domain_match, bv.decision_note,
       bv.assignee_id, bv.submitted_at, bv.decided_at
FROM public.buyer_profiles bp
LEFT JOIN (
  SELECT DISTINCT ON (user_id) * FROM public.buyer_verifications
  ORDER BY user_id, updated_at DESC
) bv ON bv.user_id = bp.user_id
WHERE bp.investor_id IS NOT NULL
ON CONFLICT (investor_id) DO NOTHING;

INSERT INTO public.investor_profile_verifications (investor_id, user_id, status)
SELECT i.id, COALESCE(o.owning_agent_user_id, i.created_by),
       CASE WHEN i.wizard->'bp'->>'verification' IN ('pending','verified','more_info','declined')
            THEN i.wizard->'bp'->>'verification' ELSE 'unverified' END
FROM public.investors i
LEFT JOIN public.investor_ownership o ON o.investor_id = i.id
WHERE i.wizard->>'admin_profile' = 'true'
  AND COALESCE(o.owning_agent_user_id, i.created_by) IS NOT NULL
ON CONFLICT (investor_id) DO NOTHING;

INSERT INTO public.investor_profile_verifications (investor_id, user_id, status)
SELECT i.id, COALESCE(bp.user_id, o.owning_agent_user_id, i.created_by), 'unverified'
FROM public.investors i
LEFT JOIN public.buyer_profiles bp ON bp.investor_id = i.id
LEFT JOIN public.investor_ownership o ON o.investor_id = i.id
WHERE COALESCE(bp.user_id, o.owning_agent_user_id, i.created_by) IS NOT NULL
ON CONFLICT (investor_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.tg_investor_verification_entry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := COALESCE(NEW.created_by, auth.uid());
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'investor profile needs an owner (created_by)';
  END IF;
  INSERT INTO public.investor_profile_verifications (investor_id, user_id, status)
  VALUES (NEW.id, _uid, 'unverified')
  ON CONFLICT (investor_id) DO NOTHING;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.tg_investor_verification_entry() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER zz_investor_verification_entry AFTER INSERT ON public.investors
  FOR EACH ROW EXECUTE FUNCTION public.tg_investor_verification_entry();

CREATE OR REPLACE FUNCTION public.tg_buyer_link_verification_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.investor_id IS NOT NULL THEN
    INSERT INTO public.investor_profile_verifications (investor_id, user_id, status)
    VALUES (NEW.investor_id, NEW.user_id, 'unverified')
    ON CONFLICT (investor_id) DO UPDATE SET user_id = EXCLUDED.user_id;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.tg_buyer_link_verification_owner() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER zz_buyer_link_verification_owner AFTER INSERT OR UPDATE OF investor_id ON public.buyer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_buyer_link_verification_owner();

CREATE OR REPLACE FUNCTION public.investor_is_verified(_ids uuid[])
RETURNS TABLE(investor_id uuid, verified boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.investor_id, v.status = 'verified'
  FROM public.investor_profile_verifications v
  JOIN public.buyer_profiles bp ON bp.investor_id = v.investor_id
  WHERE v.investor_id = ANY(_ids) AND bp.approval_status = 'approved'
$$;
REVOKE EXECUTE ON FUNCTION public.investor_is_verified(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.investor_is_verified(uuid[]) TO authenticated, service_role;

COMMENT ON TABLE public.buyer_verifications IS
  'DEPRECATED: replaced by investor_profile_verifications (one entry per investor profile)';