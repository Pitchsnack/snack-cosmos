ALTER TABLE public.startups ADD COLUMN IF NOT EXISTS sector_pick jsonb;
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS sector_picks jsonb;
ALTER TABLE public.advisor_firms ADD COLUMN IF NOT EXISTS sector_picks jsonb;
UPDATE public.investors SET sector_picks = jsonb_build_object('types', '["other"]'::jsonb, 'kinds', '{}'::jsonb, 'other', to_jsonb(array(SELECT x FROM unnest(preferred_industries) x WHERE x <> 'Sector Agnostic')))
  WHERE sector_picks IS NULL AND preferred_industries IS NOT NULL AND EXISTS (SELECT 1 FROM unnest(preferred_industries) x WHERE x <> 'Sector Agnostic');
UPDATE public.advisor_firms SET sector_picks = jsonb_build_object('types', '["other"]'::jsonb, 'kinds', '{}'::jsonb, 'other', to_jsonb(sectors))
  WHERE sector_picks IS NULL AND COALESCE(sector_agnostic, false) = false AND sectors IS NOT NULL AND cardinality(sectors) > 0;