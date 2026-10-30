ALTER TABLE public.buy_orders DROP CONSTRAINT buy_orders_description_check;
ALTER TABLE public.buy_orders ADD CONSTRAINT buy_orders_description_check CHECK (char_length(description) BETWEEN 10 AND 400);
UPDATE public.buy_orders SET profit = CASE WHEN profit IS NULL OR btrim(profit) = '' THEN 'not_stated' ELSE 'yes' END;
ALTER TABLE public.buy_orders ALTER COLUMN profit SET DEFAULT 'not_stated';
ALTER TABLE public.buy_orders ADD CONSTRAINT buy_orders_profit_check CHECK (profit IN ('yes','no','not_stated'));