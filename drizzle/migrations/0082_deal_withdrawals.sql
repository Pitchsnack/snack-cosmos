ALTER TABLE public.deal_pipelines
  ADD COLUMN IF NOT EXISTS ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS ended_by_side text CHECK (ended_by_side IN ('seller','buyer')),
  ADD COLUMN IF NOT EXISTS ended_at_step integer;

CREATE TABLE public.deal_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL UNIQUE REFERENCES public.deal_pipelines(id) ON DELETE CASCADE,
  withdrawn_by uuid NOT NULL,
  side text NOT NULL CHECK (side IN ('seller','buyer')),
  reason_code text NOT NULL CHECK (reason_code IN ('offer_too_low','terms','other_buyer','not_selling','price_too_high','report_concerns','other_business','plans_changed','timing','other')),
  comment text CHECK (char_length(comment) <= 500),
  shared boolean NOT NULL DEFAULT true,
  withdrawn_at timestamptz NOT NULL DEFAULT now(),
  step_at_withdrawal integer NOT NULL,
  feedback_sent boolean NOT NULL DEFAULT false
);
GRANT ALL ON public.deal_withdrawals TO service_role;
ALTER TABLE public.deal_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.withdrawal_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_id uuid NOT NULL UNIQUE REFERENCES public.deal_withdrawals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  options text[] NOT NULL DEFAULT '{}',
  more_text text CHECK (char_length(more_text) <= 1000),
  improve_text text CHECK (char_length(improve_text) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.withdrawal_feedback TO authenticated;
GRANT ALL ON public.withdrawal_feedback TO service_role;
ALTER TABLE public.withdrawal_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read withdrawal feedback" ON public.withdrawal_feedback FOR SELECT TO authenticated USING (public.role_is(auth.uid(), 'admin'));