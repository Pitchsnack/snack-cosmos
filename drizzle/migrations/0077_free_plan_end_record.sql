ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS free_plan_name text,
  ADD COLUMN IF NOT EXISTS free_ended_on date;
COMMENT ON COLUMN public.subscriptions.free_ended_on IS 'Last free day of an access-code free plan that ran its full term (drives the one-time Subscription notice).';