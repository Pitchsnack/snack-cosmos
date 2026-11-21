ALTER TABLE public.buyer_profiles ADD COLUMN IF NOT EXISTS private_description_th text;

UPDATE public.buyer_profiles
SET private_description = NULL
WHERE private_description IS NOT NULL;

UPDATE public.investors
SET wizard = jsonb_set(wizard, '{bp,private_description}', 'null'::jsonb, true)
WHERE wizard ? 'bp' AND wizard->'bp' ? 'private_description';

UPDATE public.investors
SET wizard = jsonb_set(wizard, '{bp,private_description_th}', 'null'::jsonb, true)
WHERE wizard ? 'bp' AND wizard->'bp' ? 'private_description_th';