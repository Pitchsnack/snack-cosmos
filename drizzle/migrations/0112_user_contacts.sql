CREATE TABLE public.user_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL DEFAULT auth.uid(),
  full_name text NOT NULL,
  email text,
  phone text,
  position text,
  department text,
  company text,
  website text,
  location text,
  contact_type text NOT NULL DEFAULT 'My Contact',
  status text NOT NULL DEFAULT 'Active',
  source text NOT NULL DEFAULT 'My Contact',
  tags text[] NOT NULL DEFAULT '{}',
  notes text,
  event text,
  last_contacted_at timestamptz,
  next_action text,
  next_action_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_contacts_type_chk CHECK (contact_type IN ('PitchSnack Connection','My Contact')),
  CONSTRAINT user_contacts_status_chk CHECK (status IN ('Active','Warm','Cold','Follow-Up Due','Do Not Contact')),
  CONSTRAINT user_contacts_source_chk CHECK (source IN ('PitchSnack Connection','My Contact','Imported','Referral','Introduction','Name Card')),
  CONSTRAINT user_contacts_name_len CHECK (char_length(full_name) BETWEEN 1 AND 100)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_contacts TO authenticated;
GRANT ALL ON public.user_contacts TO service_role;
ALTER TABLE public.user_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own contacts" ON public.user_contacts FOR ALL TO authenticated
  USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
CREATE INDEX user_contacts_owner_idx ON public.user_contacts (owner_user_id, updated_at DESC);
CREATE TRIGGER user_contacts_updated_at BEFORE UPDATE ON public.user_contacts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();