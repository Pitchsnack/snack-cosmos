ALTER TABLE public.buy_orders
  ADD COLUMN name_on_card_th text CHECK (name_on_card_th IS NULL OR char_length(name_on_card_th) <= 40),
  ADD COLUMN description_th text CHECK (description_th IS NULL OR char_length(description_th) BETWEEN 10 AND 400),
  ADD COLUMN products_th text,
  ADD COLUMN must_have_th text[] NOT NULL DEFAULT '{}',
  ADD COLUMN nice_to_have_th text[] NOT NULL DEFAULT '{}',
  ADD COLUMN timing_th text,
  ADD COLUMN text_lang text NOT NULL DEFAULT 'en' CHECK (text_lang IN ('en','th'));
ALTER TABLE public.buy_orders DROP CONSTRAINT buy_orders_description_check;
ALTER TABLE public.buy_orders ADD CONSTRAINT buy_orders_description_check CHECK (char_length(description) = 0 OR char_length(description) BETWEEN 10 AND 400);