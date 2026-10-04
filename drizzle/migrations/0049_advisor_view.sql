ALTER TABLE public.users ADD COLUMN IF NOT EXISTS advisor_view boolean NOT NULL DEFAULT false;

CREATE TABLE public.advisor_favourites (
  user_id uuid NOT NULL,
  item_kind text NOT NULL CHECK (item_kind IN ('listing','investor')),
  item_id uuid NOT NULL,
  view text NOT NULL DEFAULT 'advisor',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_kind, item_id)
);
GRANT SELECT, INSERT, DELETE ON public.advisor_favourites TO authenticated;
GRANT ALL ON public.advisor_favourites TO service_role;
ALTER TABLE public.advisor_favourites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own advisor favourites read" ON public.advisor_favourites FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own advisor favourites insert" ON public.advisor_favourites FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own advisor favourites delete" ON public.advisor_favourites FOR DELETE TO authenticated USING (auth.uid() = user_id);