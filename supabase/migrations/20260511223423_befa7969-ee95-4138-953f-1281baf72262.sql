ALTER TABLE public.order_processing
  ADD COLUMN IF NOT EXISTS gross_margin numeric,
  ADD COLUMN IF NOT EXISTS margin_hardware numeric,
  ADD COLUMN IF NOT EXISTS margin_service numeric;