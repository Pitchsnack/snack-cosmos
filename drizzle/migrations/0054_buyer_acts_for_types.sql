ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS acts_for_types text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.signup_answers ADD COLUMN IF NOT EXISTS buyer_relation text;
ALTER TABLE public.signup_answers ADD COLUMN IF NOT EXISTS investor_types text[] NOT NULL DEFAULT '{}';
UPDATE public.investors i SET acts_for_types = ARRAY[i.investor_type]
FROM public.buyer_profiles bp
WHERE bp.investor_id = i.id AND bp.buyer_relation = 'agent' AND i.investor_type IS NOT NULL
  AND cardinality(i.acts_for_types) = 0;