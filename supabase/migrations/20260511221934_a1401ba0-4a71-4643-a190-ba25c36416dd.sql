ALTER TABLE public.order_processing
  ADD COLUMN IF NOT EXISTS leasing_provider text,
  ADD COLUMN IF NOT EXISTS payment_method text;