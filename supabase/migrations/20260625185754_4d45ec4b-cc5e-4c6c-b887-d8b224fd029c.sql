
-- Migrate any rows currently using 'Inactive' status
UPDATE public.startups SET status = 'Archived' WHERE status = 'Inactive';

-- Status: drop 'Inactive'
ALTER TABLE public.startups DROP CONSTRAINT IF EXISTS startups_status_chk;
ALTER TABLE public.startups ADD CONSTRAINT startups_status_chk
  CHECK (status IN ('Draft','Active','Fundraising','Due Diligence','Portfolio','Exited','Archived'));

-- Investment stage: add 'Inactive'
ALTER TABLE public.startups DROP CONSTRAINT IF EXISTS startups_investment_stage_chk;
ALTER TABLE public.startups ADD CONSTRAINT startups_investment_stage_chk
  CHECK (investment_stage IS NULL OR investment_stage IN ('Pre-Seed','Seed','Series A','Series B','Series C','Growth','Other','Inactive'));
