CREATE TABLE public.marketplace_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_key text NOT NULL,
  sender_id uuid NOT NULL,
  body text NOT NULL DEFAULT '',
  files jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX marketplace_messages_thread_idx ON public.marketplace_messages(thread_key, created_at DESC);

CREATE TABLE public.marketplace_message_reads (
  thread_key text NOT NULL,
  user_id uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_key, user_id)
);

GRANT SELECT ON public.marketplace_messages TO authenticated;
GRANT ALL ON public.marketplace_messages TO service_role;
GRANT SELECT ON public.marketplace_message_reads TO authenticated;
GRANT ALL ON public.marketplace_message_reads TO service_role;

ALTER TABLE public.marketplace_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_message_reads ENABLE ROW LEVEL SECURITY;

-- Thread keys: 'p:<deal_pipeline id>' (buyer + seller, NDA approved) or 'a:<user id>' (user + PitchSnack advisor).
CREATE OR REPLACE FUNCTION public.can_read_message_thread(_uid uuid, _key text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE p record;
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;
  IF _key LIKE 'a:%' THEN
    RETURN substring(_key from 3) = _uid::text OR public.is_control(_uid);
  END IF;
  IF _key LIKE 'p:%' THEN
    SELECT * INTO p FROM public.deal_pipelines WHERE id::text = substring(_key from 3);
    IF NOT FOUND OR p.nda_approved_at IS NULL THEN RETURN false; END IF;
    RETURN p.buyer_user_id = _uid
      OR EXISTS (SELECT 1 FROM public.startup_ownership o WHERE o.startup_id = p.startup_id AND o.owning_agent_user_id = _uid)
      OR EXISTS (SELECT 1 FROM public.startup_users su WHERE su.startup_id = p.startup_id AND su.user_id = _uid);
  END IF;
  RETURN false;
END $$;

CREATE POLICY "Participants read messages" ON public.marketplace_messages
  FOR SELECT TO authenticated USING (public.can_read_message_thread(auth.uid(), thread_key));
CREATE POLICY "Participants read receipts" ON public.marketplace_message_reads
  FOR SELECT TO authenticated USING (public.can_read_message_thread(auth.uid(), thread_key));

ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_message_reads;