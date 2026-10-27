CREATE TABLE public.admin_contact_notes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 contact_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 author_user_id uuid NOT NULL REFERENCES public.users(id),
 body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 4000),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admin_contact_notes TO authenticated;
GRANT ALL ON public.admin_contact_notes TO service_role;
ALTER TABLE public.admin_contact_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_contact_notes_read ON public.admin_contact_notes FOR SELECT TO authenticated USING (public.is_control(auth.uid()) AND public.role_is(auth.uid(), 'admin'));
CREATE POLICY admin_contact_notes_insert ON public.admin_contact_notes FOR INSERT TO authenticated WITH CHECK (author_user_id = auth.uid() AND public.is_control(auth.uid()) AND public.role_is(auth.uid(), 'admin') AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = contact_user_id AND u.account_role IN ('buyer','seller','advisor')));
CREATE INDEX admin_contact_notes_contact_idx ON public.admin_contact_notes(contact_user_id, created_at DESC);