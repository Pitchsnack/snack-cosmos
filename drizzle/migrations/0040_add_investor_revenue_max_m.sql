-- Revenue band upper bound for the buying requirement (pairs with revenue_min_m).
ALTER TABLE public.investors ADD COLUMN revenue_max_m numeric;
COMMENT ON COLUMN public.investors.revenue_min_m IS 'Lower bound of the buying revenue band, in millions THB; legacy rows may hold a single minimum';
COMMENT ON COLUMN public.investors.revenue_max_m IS 'Upper bound of the buying revenue band, in millions THB; NULL = open-ended (e.g. 1B and above)';