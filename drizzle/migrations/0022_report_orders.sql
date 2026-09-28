CREATE SEQUENCE IF NOT EXISTS public.report_order_ref_seq START 1042;
CREATE TABLE public.report_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref text NOT NULL UNIQUE DEFAULT ('RO-' || nextval('public.report_order_ref_seq')::text),
  startup_id uuid NOT NULL REFERENCES public.startups(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('financials','valuation','bundle')),
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'THB',
  status text NOT NULL DEFAULT 'paid' CHECK (status IN ('paid','generated','delivered','cancelled','refunded')),
  paid_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  payment_ref text,
  method text,
  ordered_by uuid,
  generated_at timestamptz,
  analyst_id uuid,
  delivered_at timestamptz,
  delivered_by uuid,
  invoice_no text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX report_orders_one_active ON public.report_orders(startup_id, kind) WHERE status NOT IN ('cancelled','refunded');
CREATE TABLE public.report_order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.report_orders(id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN ('paid','generated','published','overdue')),
  actor_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.report_orders TO authenticated;
GRANT ALL ON public.report_orders TO service_role;
GRANT SELECT, INSERT ON public.report_order_events TO authenticated;
GRANT ALL ON public.report_order_events TO service_role;
GRANT USAGE ON SEQUENCE public.report_order_ref_seq TO authenticated, service_role;
ALTER TABLE public.report_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_order_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ro read" ON public.report_orders FOR SELECT TO authenticated
  USING (public.is_control(auth.uid()) OR public.can_access_startup(auth.uid(), startup_id));
CREATE POLICY "ro admin write" ON public.report_orders FOR ALL TO authenticated
  USING (public.is_control(auth.uid())) WITH CHECK (public.is_control(auth.uid()));
CREATE POLICY "roe read" ON public.report_order_events FOR SELECT TO authenticated
  USING (public.is_control(auth.uid()) OR EXISTS (SELECT 1 FROM public.report_orders o WHERE o.id = order_id AND public.can_access_startup(auth.uid(), o.startup_id)));
CREATE POLICY "roe admin write" ON public.report_order_events FOR INSERT TO authenticated
  WITH CHECK (public.is_control(auth.uid()));