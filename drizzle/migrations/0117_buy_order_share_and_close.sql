ALTER TABLE public.share_invitations ADD COLUMN IF NOT EXISTS buy_order_id uuid NULL;
CREATE INDEX IF NOT EXISTS share_invitations_buy_order_idx ON public.share_invitations(buy_order_id) WHERE buy_order_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.close_due_buy_orders()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer;
BEGIN
  UPDATE public.buy_orders SET status='closed', closed_at=now()
   WHERE status='posted' AND closes_on IS NOT NULL AND closes_on <= (now() AT TIME ZONE 'Asia/Bangkok')::date;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.close_due_buy_orders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_due_buy_orders() TO service_role;