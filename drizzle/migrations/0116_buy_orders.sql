CREATE SEQUENCE IF NOT EXISTS public.buy_order_ref_seq START 1001;

CREATE TABLE public.buy_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref text NOT NULL UNIQUE DEFAULT ('BO-' || nextval('public.buy_order_ref_seq')::text),
  kind text NOT NULL CHECK (kind IN ('sealed','advertisement')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','waiting','sent_back','posted','closed')),
  investor_profile_id uuid NOT NULL,
  written_by_user_id uuid NOT NULL,
  sector text NOT NULL,
  name_on_card text NOT NULL CHECK (char_length(name_on_card) <= 40),
  description text NOT NULL CHECK (char_length(description) BETWEEN 10 AND 280),
  location text NOT NULL CHECK (location IN ('Thailand','Vietnam','Malaysia','Indonesia','Southeast Asia')),
  cities text NOT NULL DEFAULT 'Any',
  property_size text NOT NULL DEFAULT 'Any',
  factory_size text NOT NULL DEFAULT 'Any',
  products text,
  target_revenue text NOT NULL,
  price_range text NOT NULL,
  deal_types text[] NOT NULL DEFAULT '{}',
  must_have text[] NOT NULL DEFAULT '{}',
  nice_to_have text[] NOT NULL DEFAULT '{}',
  profit text,
  timing text,
  period_months integer NOT NULL DEFAULT 3 CHECK (period_months IN (3,6,12)),
  sent_to_admin_at timestamptz,
  admin_note text,
  sent_back_at timestamptz,
  posted_at timestamptz,
  posted_by_user_id uuid,
  closes_on date,
  closed_at timestamptz,
  extended_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.buy_orders TO service_role;
GRANT USAGE ON SEQUENCE public.buy_order_ref_seq TO service_role;
ALTER TABLE public.buy_orders ENABLE ROW LEVEL SECURITY;
CREATE INDEX buy_orders_status_idx ON public.buy_orders(status, posted_at DESC);
CREATE INDEX buy_orders_investor_idx ON public.buy_orders(investor_profile_id);
CREATE TRIGGER buy_orders_updated_at BEFORE UPDATE ON public.buy_orders FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.buy_order_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buy_order_id uuid NOT NULL REFERENCES public.buy_orders(id) ON DELETE CASCADE,
  business_id uuid NOT NULL,
  seller_user_id uuid NOT NULL,
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','nda_requested','not_a_fit')),
  applied_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by_user_id uuid,
  nda_request_id uuid,
  UNIQUE (buy_order_id, business_id)
);
GRANT ALL ON public.buy_order_applications TO service_role;
ALTER TABLE public.buy_order_applications ENABLE ROW LEVEL SECURITY;
CREATE INDEX buy_order_applications_seller_idx ON public.buy_order_applications(seller_user_id);

CREATE TABLE public.buy_order_views (
  buy_order_id uuid NOT NULL REFERENCES public.buy_orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  first_viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (buy_order_id, user_id)
);
GRANT ALL ON public.buy_order_views TO service_role;
ALTER TABLE public.buy_order_views ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.buy_orders IS 'Businesses Wanted buy orders; read and written only through server functions (buy-orders.functions.ts).';