ALTER TABLE public.deal_pipelines
  ADD COLUMN IF NOT EXISTS loi_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS loi_requested_by uuid,
  ADD COLUMN IF NOT EXISTS loi_request_note text,
  ADD COLUMN IF NOT EXISTS loi_request_price numeric,
  ADD COLUMN IF NOT EXISTS loi_request_days integer,
  ADD COLUMN IF NOT EXISTS loi_request_respond_by date;