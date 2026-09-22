ALTER TABLE public.valuation_adjustments
  DROP CONSTRAINT IF EXISTS valuation_adjustments_type_check,
  DROP CONSTRAINT IF EXISTS valuation_adjustments_filing_line_check;

ALTER TABLE public.valuation_adjustments
  ADD CONSTRAINT valuation_adjustments_type_check CHECK (type IN (
    'booked_expense','one_off_expense','missing_cost','unrecorded_income',
    'below_market_related_party','revenue_elsewhere','one_off_income'
  )),
  ADD CONSTRAINT valuation_adjustments_filing_line_check CHECK (filing_line IN (
    'cost_of_goods_sold','selling_admin','other_expenses','revenue','other_income'
  ));

ALTER TABLE public.valuation_adjustments
  ADD COLUMN IF NOT EXISTS discount_pct numeric,
  ADD COLUMN IF NOT EXISTS costs_amount numeric;