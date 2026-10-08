CREATE TABLE public.contact_enquiries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 reference text NOT NULL UNIQUE,
 role text NOT NULL CHECK (role IN ('seller','buyer','partner','other')),
 topic text NOT NULL CHECK (topic IN ('selling','buying','partner','plans','verification','account','press','other')),
 name text NOT NULL, company text, email text NOT NULL, phone text, message text NOT NULL,
 language text NOT NULL DEFAULT 'th' CHECK (language IN ('th','en')),
 consent_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','replied','closed')),
 user_id uuid, ip_hash text
);
CREATE INDEX contact_enquiries_rate ON public.contact_enquiries (created_at, ip_hash, email);
GRANT SELECT ON public.contact_enquiries TO authenticated;
GRANT ALL ON public.contact_enquiries TO service_role;
ALTER TABLE public.contact_enquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contact enquiries admins read" ON public.contact_enquiries FOR SELECT TO authenticated USING (public.is_account_admin(auth.uid()) AND public.is_control(auth.uid()));