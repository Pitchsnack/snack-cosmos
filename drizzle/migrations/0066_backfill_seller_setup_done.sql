UPDATE public.startups SET setup_done_at = COALESCE(updated_at, now())
WHERE setup_done_at IS NULL
  AND id::text NOT IN (SELECT profile_id FROM public.signup_answers WHERE role = 'seller' AND profile_id IS NOT NULL);