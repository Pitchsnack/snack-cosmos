CREATE TABLE public.private_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.deal_pipelines(id) ON DELETE CASCADE,
  owner_org_id text NOT NULL,
  subject_org_id text NOT NULL,
  listing_id uuid,
  direction text NOT NULL CHECK (direction IN ('buyer_on_seller','seller_on_buyer')),
  generated jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  my_notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  edited_at timestamptz,
  UNIQUE (pipeline_id, direction)
);
GRANT ALL ON public.private_notes TO service_role;
ALTER TABLE public.private_notes ENABLE ROW LEVEL SECURITY;
-- No client policies: read/write only through server functions that check the owner side.