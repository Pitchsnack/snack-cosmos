ALTER TABLE public.buyer_profiles ADD COLUMN IF NOT EXISTS investor_id uuid REFERENCES public.investors(id) ON DELETE SET NULL;
ALTER TABLE public.buyer_profiles ADD COLUMN IF NOT EXISTS pof_path text;
CREATE UNIQUE INDEX IF NOT EXISTS buyer_profiles_investor_id_key ON public.buyer_profiles(investor_id) WHERE investor_id IS NOT NULL;
COMMENT ON COLUMN public.buyer_profiles.investor_id IS 'The buyer firm''s record in Investors Directory; buyer Edit profile and Admin Edit investor write the same row.';